/**
 * Confirms a payment with Paystack, then grants the book.
 *
 * This is the step that was missing. The cart granted everything the moment
 * Paystack's popup fired onSuccess in the browser — the reference was never
 * checked against Paystack, so calling that callback from the console handed
 * over the whole cart for nothing.
 *
 * Nothing here trusts the caller beyond the reference string. The amount, the
 * status and the currency all come from Paystack's own record of the
 * transaction, and are compared against what we recorded when the charge was
 * opened.
 *
 * Safe to call repeatedly. The webhook and the browser callback race each
 * other by design — whichever arrives first completes the grant, and the other
 * finds the work already done.
 */

import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

const BORROW_DAYS = 14;

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const bearer = req.headers.get('Authorization')?.replace('Bearer ', '') || null;
    if (!bearer) return json({ error: 'Unauthorized' }, 401);

    const insforgeUrl = Deno.env.get('INSFORGE_BASE_URL');
    const apiKey = Deno.env.get('API_KEY');
    if (!insforgeUrl || !apiKey) throw new Error('Backend is not configured.');

    const asUser = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: bearer });
    const { data: userData, error: userError } = await asUser.auth.getCurrentUser();
    if (userError || !userData?.user?.id) return json({ error: 'Unauthorized' }, 401);

    const userId = userData.user.id as string;

    const body = await req.json().catch(() => ({}));
    const reference: string | undefined = body.reference;
    if (!reference) return json({ error: 'reference is required' }, 400);

    const result = await settlePayment({
      reference,
      insforgeUrl,
      apiKey,
      // A user may only settle their own payment. The webhook passes null,
      // because it speaks for Paystack rather than for a person.
      requireUserId: userId
    });

    return json(result.body, result.status);
  } catch (err: any) {
    console.error('[payments-verify]', err?.message || err);
    return json({ error: err?.message || 'Could not verify this payment.' }, 500);
  }
}

/**
 * Verifies one reference and grants what it paid for.
 *
 * Shared with the webhook so both routes apply identical rules — a webhook that
 * granted on softer terms than the browser callback would be the obvious way
 * in.
 */
export async function settlePayment(opts: {
  reference: string;
  insforgeUrl: string;
  apiKey: string;
  requireUserId: string | null;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { reference, insforgeUrl, apiKey, requireUserId } = opts;

  const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secretKey) {
    return { status: 503, body: { error: 'Payments are not configured on this backend.' } };
  }

  const asService = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: apiKey });

  // ── Our record of what was supposed to happen ─────────────────────────
  const { data: txn } = await asService.database
    .from('payment_transactions')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!txn) {
    // No ledger row means this reference was not issued by us. Refusing is
    // what stops a reference from another Paystack account being replayed.
    return { status: 404, body: { error: 'Unknown payment reference.' } };
  }

  if (requireUserId && txn.user_id !== requireUserId) {
    return { status: 403, body: { error: 'This payment belongs to another account.' } };
  }

  // Already settled. Return success rather than an error: the webhook and the
  // browser both call this, and the loser of that race has done nothing wrong.
  if (txn.status === 'completed') {
    return {
      status: 200,
      body: { success: true, already_processed: true, book_id: txn.book_id, type: txn.type }
    };
  }

  // ── What Paystack says actually happened ──────────────────────────────
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );

  const verifyBody = await verifyRes.json().catch(() => ({}));

  if (!verifyRes.ok || !verifyBody?.status) {
    return {
      status: 502,
      body: { error: verifyBody?.message || 'Could not reach the payment provider.' }
    };
  }

  const paid = verifyBody.data;

  if (paid?.status !== 'success') {
    await asService.database
      .from('payment_transactions')
      .update({
        status: paid?.status === 'abandoned' ? 'abandoned' : 'failed',
        metadata: { ...(txn.metadata || {}), paystack_status: paid?.status }
      })
      .eq('reference', reference);

    return { status: 402, body: { error: `Payment was not completed (${paid?.status}).` } };
  }

  // The amount and currency must match what we opened the charge for. Paystack
  // returns its own figures, so this catches a transaction that was altered
  // between initialize and payment.
  if (Number(paid.amount) !== Number(txn.amount_minor)) {
    console.error(
      `[settlePayment] amount mismatch on ${reference}: charged ${paid.amount}, expected ${txn.amount_minor}`
    );
    return { status: 409, body: { error: 'The amount paid does not match this order.' } };
  }

  if (String(paid.currency || 'NGN') !== String(txn.currency || 'NGN')) {
    return { status: 409, body: { error: 'Currency mismatch on this payment.' } };
  }

  // ── Mark paid, then entitle ───────────────────────────────────────────
  // Ordering matters: grant_book_access checks for a completed row, so the
  // ledger has to be updated first.
  const { error: updateErr } = await asService.database
    .from('payment_transactions')
    .update({
      status: 'completed',
      provider_reference: String(paid.id || ''),
      completed_at: new Date().toISOString(),
      metadata: { ...(txn.metadata || {}), channel: paid.channel, paid_at: paid.paid_at }
    })
    .eq('reference', reference);

  if (updateErr) {
    console.error('[settlePayment] could not mark completed:', updateErr);
    return { status: 500, body: { error: 'Payment verified but could not be recorded.' } };
  }

  if (!txn.book_id) {
    // A payment for something other than a book. Recorded, nothing to grant.
    return { status: 200, body: { success: true, type: txn.type } };
  }

  const accessType = txn.type === 'purchase' ? 'own' : 'rent';
  const expiresAt =
    txn.type === 'purchase'
      ? null
      : new Date(Date.now() + BORROW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: grantErr } = await asService.database.rpc('grant_book_access', {
    p_user_id: txn.user_id,
    p_book_id: txn.book_id,
    p_access_type: accessType,
    p_reference: reference,
    p_expires_at: expiresAt
  });

  if (grantErr) {
    // The money is taken and recorded; only the entitlement failed. Say so
    // plainly rather than implying the payment did not go through.
    console.error('[settlePayment] grant failed after payment:', grantErr);
    return {
      status: 500,
      body: {
        error:
          'Your payment went through but access could not be granted. Please contact support with this reference.',
        reference
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      book_id: txn.book_id,
      type: txn.type,
      access_type: accessType,
      expires_at: expiresAt
    }
  };
}
