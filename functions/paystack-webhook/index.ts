/**
 * Paystack webhook.
 *
 * This is the authoritative path. The browser callback is a convenience — it
 * makes the UI update promptly — but a customer who closes the tab the instant
 * their card is charged still gets their book, because Paystack calls here
 * regardless.
 *
 * Two things this previously got wrong:
 *
 *   It was not idempotent. Paystack retries on any non-2xx response, and the
 *   handler inserted an enrolment with no check for an already-processed
 *   reference, so a retry enrolled the customer twice — and once earnings are
 *   attached to a grant, would have paid the author twice.
 *
 *   It handled only course purchases. Books had no path through it at all, so
 *   every book relied entirely on the browser saying the payment succeeded.
 *
 * The settle logic is duplicated from payments-verify rather than shared,
 * because edge functions deploy as isolated modules and cannot import one
 * another. Both must be changed together; a webhook that granted on softer
 * terms than the browser callback would be the obvious way in.
 */

import { createClient } from 'npm:@insforge/sdk';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-paystack-signature'
};

// The borrow term lives on the book (borrow_days, default 5) and is applied
// by issue_book_license, so there is no constant to drift out of step.

/**
 * The author's share of a sale or borrow fee.
 *
 * Passed to record_book_earning rather than hardcoded in SQL, and stored on
 * each earning row, so changing it later affects new earnings only and never
 * rewrites what an author has already earned.
 */
const AUTHOR_RATE = 0.60;

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      console.error('[paystack-webhook] PAYSTACK_SECRET_KEY is not set.');
      // 500 so Paystack retries once the key is configured, rather than
      // treating a misconfiguration as a permanently rejected event.
      return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';
    const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex');

    // Constant-time compare. A plain !== leaks, through timing, how much of a
    // forged signature was correct.
    if (!safeEqualHex(expected, signature)) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const event = JSON.parse(rawBody);

    // Anything else is acknowledged so Paystack stops retrying it.
    if (event.event !== 'charge.success') {
      return ok({ ignored: event.event });
    }

    const insforgeUrl = Deno.env.get('INSFORGE_BASE_URL');
    const apiKey = Deno.env.get('API_KEY');
    if (!insforgeUrl || !apiKey) throw new Error('Backend is not configured.');

    const asService = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: apiKey });

    const paid = event.data || {};
    const reference: string = paid.reference || '';
    if (!reference) return ok({ ignored: 'no reference' });

    const { data: txn } = await asService.database
      .from('payment_transactions')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    // Not a book payment of ours. Could be a course or subscription handled
    // elsewhere; acknowledge rather than make Paystack retry forever.
    if (!txn) {
      await handleLegacyCoursePurchase(asService, paid);
      return ok({ ignored: 'reference not in book ledger', reference });
    }

    // The idempotency gate. A retry lands here and stops.
    if (txn.status === 'completed') {
      return ok({ already_processed: true, reference });
    }

    // Trust the signed payload for status, but check the figures against what
    // the charge was opened for.
    if (Number(paid.amount) !== Number(txn.amount_minor)) {
      console.error(
        `[paystack-webhook] amount mismatch on ${reference}: got ${paid.amount}, expected ${txn.amount_minor}`
      );
      // 200: retrying will not change a mismatched amount.
      return ok({ error: 'amount mismatch', reference });
    }

    // Grant BEFORE marking the ledger completed.
    //
    // The other order strands the customer: if the grant fails, the row still
    // reads 'completed', so every retry short-circuits at the idempotency gate
    // above and reports already_processed while no entitlement exists. The
    // money is taken and the book never arrives, and no retry can repair it.
    //
    // Granting first is safe because grant_book_access is itself idempotent —
    // a retry that gets past a transient failure returns the existing row
    // rather than issuing a second one.
    if (txn.book_id) {
      // The licence goes to the beneficiary recorded when the charge opened,
      // which is the mentee for a sponsorship and the payer otherwise. Reading
      // it from the payment rather than assuming the payer is what makes
      // "Mary paid, John reads" work.
      const beneficiaryId = txn.metadata?.beneficiary_id || txn.user_id;

      const { error: grantErr } = await asService.database.rpc('issue_book_license', {
        p_book_id: txn.book_id,
        p_beneficiary_id: beneficiaryId,
        p_payer_id: txn.user_id,
        p_license_type: txn.type === 'purchase' ? 'owned' : 'borrowed',
        p_transaction_id: reference,
        p_amount_minor: Number(txn.amount_minor || 0)
      });

      // Close the request that prompted this, if there was one.
      if (!grantErr && txn.metadata?.request_id) {
        await asService.database
          .from('book_requests')
          .update({
            status: 'fulfilled',
            fulfilled_as: txn.type === 'purchase' ? 'purchase' : 'borrow',
            resolved_at: new Date().toISOString()
          })
          .eq('id', txn.metadata.request_id);
      }

      if (grantErr) {
        console.error('[paystack-webhook] grant failed, leaving ledger pending:', grantErr);
        // 500 so Paystack retries. The ledger stays 'pending', so the next
        // delivery runs this again rather than being swallowed as already
        // processed.
        return new Response(JSON.stringify({ error: 'grant failed' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }

    await asService.database
      .from('payment_transactions')
      .update({
        status: 'completed',
        provider_reference: String(paid.id || ''),
        completed_at: new Date().toISOString(),
        metadata: { ...(txn.metadata || {}), channel: paid.channel, paid_at: paid.paid_at }
      })
      .eq('reference', reference);

    // Credit the author. After the ledger is completed, because
    // record_book_earning only pays out on a confirmed payment.
    //
    // A failure here does not fail the webhook: the reader has paid and been
    // granted their book, and holding that hostage to a bookkeeping error
    // would be the wrong trade. The earning is recoverable — it is idempotent
    // and keyed on the transaction, so a repair job can replay it — while a
    // 500 here would make Paystack retry a delivery that has already done its
    // real work.
    if (txn.book_id) {
      const { error: earnErr } = await asService.database.rpc('record_book_earning', {
        p_transaction_id: reference,
        p_author_rate: AUTHOR_RATE
      });

      if (earnErr) {
        console.error(
          `[paystack-webhook] earning not recorded for ${reference} — needs replay:`,
          earnErr
        );
      }
    }

    return ok({ processed: true, reference });
  } catch (err: any) {
    console.error('[paystack-webhook]', err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || 'Webhook failed' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify({ status: 'success', ...body }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

/** Constant-time comparison of two hex digests of the same length. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * The course-enrolment path this webhook used to handle.
 *
 * Kept so existing course checkouts keep working, but now guarded against the
 * double-enrolment a retry previously caused.
 */
async function handleLegacyCoursePurchase(asService: any, paid: any): Promise<void> {
  const metadata = paid.metadata || {};
  if (metadata.type !== 'course_purchase') return;

  const { student_id, course_id } = metadata;
  if (!student_id || !course_id) return;

  const { data: already } = await asService.database
    .from('enrollments')
    .select('id')
    .eq('user_id', student_id)
    .eq('item_id', course_id)
    .maybeSingle();

  if (already) return;

  const { data: course } = await asService.database
    .from('courses')
    .select('title, thumbnail_url')
    .eq('id', course_id)
    .maybeSingle();

  await asService.database.from('enrollments').insert([{
    user_id: student_id,
    item_id: course_id,
    item_type: 'course',
    item_title: course?.title || 'Course Purchase',
    item_thumbnail: course?.thumbnail_url || '',
    status: 'enrolled',
    amount: Number(paid.amount || 0) / 100
  }]);
}
