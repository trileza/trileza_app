/**
 * Starts a Paystack transaction for a book.
 *
 * The amount is computed here, from the book's price in the database. The
 * client sends only what it wants to buy, never what it costs — previously the
 * cart passed its own total straight to Paystack, so a modified page could have
 * bought a ₦20,000 book for ₦1.
 *
 * The reference is generated here too. It used to be Date.now() on the client,
 * which is guessable, collides between users buying in the same millisecond,
 * and lets the caller choose a value it might later replay.
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

/** What a borrow costs, as a fraction of the book's retail price. */
const BORROW_RATE = 0.10;

// The borrow term is no longer a constant. It lives on the book as
// borrow_days (default 5, per the proposal), so an author-approved different
// term needs no code change.

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
    const email = userData.user.email;
    if (!email) return json({ error: 'Your account has no email address.' }, 400);

    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      return json({ error: 'Payments are not configured on this backend.' }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const bookId: string | undefined = body.bookId;
    const type: string = body.type;
    // Who the licence is for. Absent means the buyer themselves; present means
    // a mentor sponsoring a mentee, which is the product's core transaction.
    const beneficiaryId: string = body.beneficiaryId || userId;
    const requestId: string | undefined = body.requestId;

    if (!bookId) return json({ error: 'bookId is required' }, 400);
    if (!['purchase', 'borrow'].includes(type)) {
      return json({ error: "type must be 'purchase' or 'borrow'" }, 400);
    }

    // ── Price comes from the database, never the request ────────────────
    const { data: book } = await asUser.database
      .from('api_books')
      .select('id, title, author_id, retail_price, rental_price, status, allow_purchase, allow_borrow, allow_mentor_gift, allow_borrow_to_own, borrow_days')
      .eq('id', bookId)
      .maybeSingle();

    if (!book) return json({ error: 'Book not found' }, 404);
    if (book.status !== 'published') {
      return json({ error: 'This book is not available for sale.' }, 403);
    }
    if (book.author_id === userId) {
      return json({ error: 'You already have access to your own book.' }, 400);
    }

    const retail = Number(book.retail_price || 0);
    const rental = Number(book.rental_price || 0);

    // A borrow is a tenth of retail unless the book carries its own rental
    // price. Falling back to the rate keeps books priced before rental_price
    // existed from being borrowable for nothing.
    const amountNaira =
      type === 'purchase' ? retail : rental > 0 ? rental : Math.round(retail * BORROW_RATE);

    if (!(amountNaira > 0)) {
      return json(
        { error: 'This book is free — no payment is needed. Add it from the library.' },
        400
      );
    }

    // ── Role rules (proposal section 2) ─────────────────────────────────
    // Enforced here, not only in the UI: a mentee cannot borrow at all, and
    // only a mentor may pay on someone else's behalf.
    const sponsoring = beneficiaryId !== userId;

    // The author decides which routes their book is available through
    // (proposal section 12). Selecting the flags without checking them would
    // let a disabled route be used anyway.
    if (type === 'purchase' && !sponsoring && book.allow_purchase === false) {
      return json({ error: 'This book is not available for purchase.' }, 403);
    }
    if (type === 'purchase' && sponsoring && book.allow_mentor_gift === false) {
      return json({ error: 'The author has not enabled buying this book for someone else.' }, 403);
    }
    if (type === 'borrow' && book.allow_borrow === false) {
      return json({ error: 'This book is not available to borrow.' }, 403);
    }

    const { data: actions } = await asUser.database.rpc('book_actions_for_user', {
      p_user_id: userId,
      p_book_id: bookId
    });
    const act = Array.isArray(actions) ? actions[0] : actions;

    if (type === 'borrow' && !sponsoring) {
      // The rule the whole model rests on. A mentee who wants a book buys it,
      // or asks a mentor to borrow it for them.
      return json({
        error: 'Borrowing is arranged by a mentor for a mentee. Buy this book, or ask your mentor.'
      }, 403);
    }

    if (sponsoring) {
      if (!act?.is_mentor) {
        return json({ error: 'Only a mentor can pay for someone else.' }, 403);
      }
      // And only for their own mentee — otherwise a mentor could issue
      // licences to any account on the platform.
      const { data: pair } = await asUser.database
        .from('mentor_mentees')
        .select('id')
        .eq('mentor_id', userId)
        .eq('mentee_id', beneficiaryId)
        .eq('status', 'active')
        .maybeSingle();

      if (!pair) {
        return json({ error: 'That person is not one of your mentees.' }, 403);
      }
    }

    // ── Is the BENEFICIARY already entitled? ────────────────────────────
    // Checked against whoever receives the licence, not whoever pays — a
    // mentor may well already own a book they are buying for a mentee.
    const { data: existing } = await asUser.database
      .from('book_licenses')
      .select('license_type, status, expires_at')
      .eq('beneficiary_id', beneficiaryId)
      .eq('book_id', bookId);

    const owns = (existing || []).some(
      (l: any) => ['owned', 'granted'].includes(l.license_type) && ['active', 'owned'].includes(l.status)
    );
    if (owns) {
      return json({
        error: sponsoring ? 'Your mentee already owns this book.' : 'You already own this book.'
      }, 400);
    }

    if (type === 'borrow') {
      const onLoan = (existing || []).some(
        (l: any) =>
          l.license_type === 'borrowed' &&
          ['active', 'expiring'].includes(l.status) &&
          (!l.expires_at || new Date(l.expires_at) > new Date())
      );
      // Not blocked for borrow-to-own: repeat borrowing is how credit
      // accumulates, and the licence is extended rather than duplicated.
      if (onLoan && !book.allow_borrow_to_own) {
        return json({
          error: sponsoring ? 'Your mentee already has this on loan.' : 'You already have this on loan.'
        }, 400);
      }
    }

    // Minor units. Paystack bills in kobo, and integers avoid the rounding
    // drift that floats accumulate once a royalty is split off the amount.
    const amountMinor = Math.round(amountNaira * 100);

    // Unguessable, unique, and ours. crypto.randomUUID is available in Deno.
    const reference = `tz_${type}_${crypto.randomUUID().replace(/-/g, '')}`;

    // ── Record it before charging ───────────────────────────────────────
    // Written with the service key: payment_transactions has no INSERT policy
    // for `authenticated`, deliberately, so a browser can never author its own
    // payment record.
    // The service key is passed as edgeFunctionToken — that is how this
    // backend grants a function service-role access, and how the existing
    // admin functions do it.
    const asService = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: apiKey });

    const { error: insertErr } = await asService.database
      .from('payment_transactions')
      .insert([{
        user_id: userId,
        book_id: bookId,
        type: type === 'purchase' ? 'purchase' : 'borrow',
        amount_minor: amountMinor,
        currency: 'NGN',
        reference,
        provider: 'paystack',
        status: 'pending',
        metadata: {
          book_title: book.title,
          author_id: book.author_id,
          // Recorded on the payment so the licence can be issued to the right
          // person when the webhook arrives, long after this request is gone.
          beneficiary_id: beneficiaryId,
          sponsored: sponsoring,
          request_id: requestId || undefined,
          borrow_days: type === 'borrow' ? Number(book.borrow_days || 5) : undefined
        }
      }]);

    if (insertErr) {
      console.error('[payments-initialize] ledger insert failed:', insertErr);
      return json({ error: 'Could not start this payment. Please try again.' }, 500);
    }

    // ── Ask Paystack to open a transaction ──────────────────────────────
    const siteUrl = Deno.env.get('SITE_URL') || '';
    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: amountMinor,
        reference,
        currency: 'NGN',
        callback_url: siteUrl ? `${siteUrl}/payment/callback` : undefined,
        metadata: { book_id: bookId, user_id: userId, beneficiary_id: beneficiaryId, type }
      })
    });

    const initBody = await initRes.json().catch(() => ({}));

    if (!initRes.ok || !initBody?.status) {
      // Leave no dangling 'pending' row for a charge that never opened.
      await asService.database
        .from('payment_transactions')
        .update({ status: 'failed' })
        .eq('reference', reference);

      console.error('[payments-initialize] Paystack rejected:', initBody);
      return json({ error: initBody?.message || 'Payment provider rejected this request.' }, 502);
    }

    return json({
      success: true,
      reference,
      amount_minor: amountMinor,
      currency: 'NGN',
      authorization_url: initBody.data?.authorization_url,
      access_code: initBody.data?.access_code
    });
  } catch (err: any) {
    console.error('[payments-initialize]', err?.message || err);
    return json({ error: err?.message || 'Could not start this payment.' }, 500);
  }
}
