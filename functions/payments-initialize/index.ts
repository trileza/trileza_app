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

/** How long a borrow lasts. */
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
    const email = userData.user.email;
    if (!email) return json({ error: 'Your account has no email address.' }, 400);

    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      return json({ error: 'Payments are not configured on this backend.' }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const bookId: string | undefined = body.bookId;
    const type: string = body.type;

    if (!bookId) return json({ error: 'bookId is required' }, 400);
    if (!['purchase', 'borrow'].includes(type)) {
      return json({ error: "type must be 'purchase' or 'borrow'" }, 400);
    }

    // ── Price comes from the database, never the request ────────────────
    const { data: book } = await asUser.database
      .from('api_books')
      .select('id, title, author_id, retail_price, rental_price, status')
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

    // Already entitled? Charging again would be theft in the other direction.
    const { data: existing } = await asUser.database
      .from('api_user_library_access')
      .select('access_type, expires_at, returned_at')
      .eq('user_id', userId)
      .eq('book_id', bookId);

    const owns = (existing || []).some(
      (a: any) => (a.access_type === 'own' || a.access_type === 'gift') && !a.returned_at
    );
    if (owns) return json({ error: 'You already own this book.' }, 400);

    if (type === 'borrow') {
      const activeBorrow = (existing || []).some(
        (a: any) =>
          ['rent', 'borrow'].includes(a.access_type) &&
          !a.returned_at &&
          (!a.expires_at || new Date(a.expires_at) > new Date())
      );
      if (activeBorrow) return json({ error: 'You already have this book on loan.' }, 400);
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
          borrow_days: type === 'borrow' ? BORROW_DAYS : undefined
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
        metadata: { book_id: bookId, user_id: userId, type }
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
