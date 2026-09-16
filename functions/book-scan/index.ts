/**
 * Submits an uploaded book for plagiarism and AI-generation scanning.
 *
 * Called when a book is submitted for review. Copyleaks scans asynchronously
 * and calls back, so this records a pending row and returns; the result
 * arrives at book-scan-webhook.
 *
 * ── When no provider is configured ───────────────────────────────────────
 *
 * The scan is recorded as 'skipped' with the reason, rather than silently not
 * happening. A review queue that shows nothing is indistinguishable from one
 * showing a clean result, and a content manager would reasonably read the
 * absence as "checked, nothing found". Better to say plainly that nothing was
 * checked.
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
    const bookId: string | undefined = body.bookId;
    if (!bookId) return json({ error: 'bookId is required' }, 400);

    // Only the author or a content manager may spend a scan on a book. Scans
    // are billed per page, so an open endpoint is a way to run up a bill.
    const { data: book } = await asUser.database
      .from('api_books')
      .select('id, title, author_id, file_url, book_file_name, file_format')
      .eq('id', bookId)
      .maybeSingle();

    if (!book) return json({ error: 'Book not found' }, 404);
    if (book.author_id !== userId) {
      const { data: profile } = await asUser.database
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      const role = String(profile?.role || '').toLowerCase();
      if (!['admin', 'super_admin', 'management', 'staff'].includes(role)) {
        return json({ error: 'Not permitted to scan this book' }, 403);
      }
    }

    const asService = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: apiKey });

    // Don't pay twice for the same book while a scan is already in flight.
    const { data: inFlight } = await asService.database
      .from('book_scans')
      .select('id, status')
      .eq('book_id', bookId)
      .in('status', ['pending', 'running']);

    if (inFlight && inFlight.length > 0) {
      return json({ success: true, already_scanning: true, scan_id: inFlight[0].id });
    }

    const email = Deno.env.get('COPYLEAKS_EMAIL');
    const copyleaksKey = Deno.env.get('COPYLEAKS_API_KEY');

    // ── No provider configured ──
    if (!email || !copyleaksKey) {
      const { data: skipped } = await asService.database
        .from('book_scans')
        .insert([{
          book_id: bookId,
          provider: 'none',
          status: 'skipped',
          verdict: 'error',
          status_detail:
            'No scanning provider is configured. This book has NOT been checked for ' +
            'plagiarism or AI-generated content — review it manually.'
        }])
        .select()
        .single();

      return json({
        success: true,
        scanned: false,
        reason: 'Scanning is not configured on this backend.',
        scan_id: skipped?.id
      });
    }

    // ── Authenticate with Copyleaks ──
    // Their tokens are short-lived, so one is fetched per submission rather
    // than cached.
    const loginRes = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, key: copyleaksKey })
    });

    if (!loginRes.ok) {
      const detail = await loginRes.text();
      console.error('[book-scan] Copyleaks login failed:', detail.slice(0, 300));

      await asService.database.from('book_scans').insert([{
        book_id: bookId,
        status: 'failed',
        verdict: 'error',
        status_detail: `Could not authenticate with the scanning provider (HTTP ${loginRes.status}).`
      }]);

      return json({ error: 'Scanning provider rejected our credentials.' }, 502);
    }

    const { access_token: accessToken } = await loginRes.json();

    // ── Record the scan before submitting ──
    // The callback can arrive before a slow insert finishes, and a result with
    // no row to attach to is lost.
    const scanId = crypto.randomUUID();

    const { error: insertErr } = await asService.database
      .from('book_scans')
      .insert([{
        id: scanId,
        book_id: bookId,
        provider: 'copyleaks',
        scan_type: 'plagiarism_and_ai',
        external_scan_id: scanId,
        status: 'running'
      }]);

    if (insertErr) {
      console.error('[book-scan] could not record scan:', insertErr);
      return json({ error: 'Could not start the scan.' }, 500);
    }

    // ── Fetch the manuscript and submit it ──
    const key = toObjectKey(book.file_url || '');
    if (!key) {
      await asService.database
        .from('book_scans')
        .update({ status: 'failed', verdict: 'error', status_detail: 'The book has no file to scan.' })
        .eq('id', scanId);
      return json({ error: 'This book has no file to scan.' }, 400);
    }

    const fileRes = await fetch(
      `${insforgeUrl}/api/storage/buckets/book-files/objects/${encodeURIComponent(key)}`,
      { headers: { 'x-api-key': apiKey } }
    );

    if (!fileRes.ok) {
      await asService.database
        .from('book_scans')
        .update({
          status: 'failed',
          verdict: 'error',
          status_detail: `Could not read the book file (HTTP ${fileRes.status}).`
        })
        .eq('id', scanId);
      return json({ error: 'Could not read the book file.' }, 502);
    }

    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    const base64 = bytesToBase64(bytes);

    const siteUrl = Deno.env.get('SITE_URL') || '';
    const webhookBase =
      Deno.env.get('FUNCTIONS_BASE_URL') ||
      (siteUrl ? siteUrl.replace(/\/$/, '') : '');

    const submitRes = await fetch(`https://api.copyleaks.com/v3/scans/submit/file/${scanId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base64,
        filename: book.book_file_name || `${book.title}.${book.file_format === 'EPUB' ? 'epub' : 'pdf'}`,
        properties: {
          // Copyleaks posts each stage to its own path under this base.
          webhooks: { status: `${webhookBase}/book-scan-webhook?status={STATUS}&scanId=${scanId}` },
          // OCR so scanned PDFs are read rather than treated as images.
          pdf: { create: false },
          scanning: { exclude: { quotes: true, references: true } },
          aiGeneratedText: { detect: true }
        }
      })
    });

    if (!submitRes.ok) {
      const detail = await submitRes.text();
      console.error('[book-scan] submit failed:', detail.slice(0, 300));

      await asService.database
        .from('book_scans')
        .update({
          status: 'failed',
          verdict: 'error',
          status_detail: `The scanning provider rejected this file (HTTP ${submitRes.status}).`
        })
        .eq('id', scanId);

      return json({ error: 'Could not submit this book for scanning.' }, 502);
    }

    return json({ success: true, scanned: true, scan_id: scanId, status: 'running' });
  } catch (err: any) {
    console.error('[book-scan]', err?.message || err);
    return json({ error: err?.message || 'Scan failed to start.' }, 500);
  }
}

/** Pulls the object key out of a stored URL, or returns it unchanged. */
const toObjectKey = (value: string): string | null => {
  if (!value) return null;
  if (!value.startsWith('http')) return value;
  const at = value.indexOf('/objects/');
  if (at === -1) return null;
  const raw = value.slice(at + '/objects/'.length).split('?')[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/**
 * Base64 without blowing the stack.
 *
 * btoa(String.fromCharCode(...bytes)) throws on a large book: spreading a
 * multi-megabyte array exceeds the argument limit. Chunked instead.
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
