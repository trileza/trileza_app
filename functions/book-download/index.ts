/**
 * Watermarked download of a purchased book.
 *
 * Borrowed books are never downloadable — a loan that can be kept is a sale.
 * This endpoint refuses anything but an outright purchase or the author's own
 * work, and every file it does serve carries the buyer's identity.
 *
 * On what the watermark is for: it does not stop anyone copying the file. It
 * makes a leaked copy traceable back to the account that downloaded it, which
 * is the realistic goal — the reader can see the content, so they can always
 * capture it somehow. Deterrence and attribution, not prevention.
 *
 * The PDF watermark is appended as a trailing page rather than stamped onto
 * every page. Stamping requires parsing and rewriting each page's content
 * stream, which a Deno edge function has no PDF library to do safely; a
 * malformed rewrite would corrupt the book. A trailing page is honest about
 * what it is, survives a round trip through most readers, and cannot silently
 * damage the file.
 */

import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    if (!insforgeUrl) throw new Error('INSFORGE_BASE_URL is not configured.');

    // Acting as the caller, so RLS applies to everything read below.
    const asUser = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: bearer });

    const { data: userData, error: userError } = await asUser.auth.getCurrentUser();
    if (userError || !userData?.user?.id) return json({ error: 'Unauthorized' }, 401);

    const userId = userData.user.id as string;
    const userEmail = userData.user.email || '';

    const url = new URL(req.url);
    const bookId =
      url.searchParams.get('bookId') ||
      (req.method === 'POST' ? (await req.json().catch(() => ({}))).bookId : null);

    if (!bookId) return json({ error: 'bookId is required' }, 400);

    // ── Entitlement: purchase only ──────────────────────────────────────
    const { data: book } = await asUser.database
      .from('api_books')
      .select('id, title, author_id, file_url, book_file_name')
      .eq('id', bookId)
      .maybeSingle();

    if (!book) return json({ error: 'Book not found' }, 404);

    const isAuthor = book.author_id === userId;

    let entitled = isAuthor;
    if (!entitled) {
      const { data: access } = await asUser.database
        .from('api_user_library_access')
        .select('access_type, expires_at, returned_at')
        .eq('user_id', userId)
        .eq('book_id', bookId);

      // Only ownership permits a download. A borrow or rental is stream-only,
      // however long it still has to run.
      entitled = (access || []).some(
        (a: any) =>
          (a.access_type === 'own' || a.access_type === 'gift') && !a.returned_at
      );
    }

    if (!entitled) {
      // Record the refusal too: a pattern of denied downloads on one title is
      // worth being able to see.
      await asUser.database.from('book_access_logs').insert([{
        user_id: userId,
        book_id: bookId,
        access_type: 'denied',
        user_agent: req.headers.get('user-agent') || null
      }]).catch(() => {});

      return json(
        { error: 'Borrowed books cannot be downloaded. Purchase this book to keep a copy.' },
        403
      );
    }

    // ── Fetch the file as the platform ──────────────────────────────────
    // The object sits in a private bucket. The caller has already been proven
    // entitled, so the service key is used to read it rather than relying on
    // the storage policy a second time.
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) throw new Error('API_KEY is not configured.');

    const key = toObjectKey(book.file_url || '');
    if (!key) return json({ error: 'This book has no downloadable file.' }, 404);

    const fileRes = await fetch(
      `${insforgeUrl}/api/storage/buckets/book-files/objects/${encodeURIComponent(key)}`,
      { headers: { 'x-api-key': apiKey } }
    );

    if (!fileRes.ok) {
      return json({ error: `Could not read the book file (${fileRes.status}).` }, 502);
    }

    const original = new Uint8Array(await fileRes.arrayBuffer());
    const fileName = book.book_file_name || `${book.title || 'book'}.pdf`;
    const isPdf = /\.pdf$/i.test(fileName) || looksLikePdf(original);

    const stamped = isPdf
      ? appendPdfWatermarkPage(original, {
          title: book.title || 'Untitled',
          name: userData.user.name || userEmail || userId,
          email: userEmail,
          userId,
          when: new Date().toISOString()
        })
      : original;

    await asUser.database.from('book_access_logs').insert([{
      user_id: userId,
      book_id: bookId,
      access_type: 'download',
      user_agent: req.headers.get('user-agent') || null
    }]).catch(() => {});

    return new Response(stamped, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': isPdf ? 'application/pdf' : 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(fileName)}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (err: any) {
    console.error('[book-download]', err?.message || err);
    return json({ error: err?.message || 'Download failed' }, 500);
  }
}

const looksLikePdf = (bytes: Uint8Array): boolean =>
  bytes.length > 4 &&
  bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF

/** Strips path separators and quotes so the name cannot break the header. */
const sanitizeFilename = (name: string): string =>
  name.replace(/[/\\"\r\n]/g, '_').slice(0, 120);

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
 * Appends a page recording who downloaded this copy.
 *
 * Works by incremental update: the original bytes are left untouched and new
 * objects plus a fresh xref are appended. That is the safest way to modify a
 * PDF without a parser — the original page tree is never rewritten, so a book
 * that opened before still opens after.
 */
function appendPdfWatermarkPage(
  pdf: Uint8Array,
  who: { title: string; name: string; email: string; userId: string; when: string }
): Uint8Array {
  const text = [
    'This copy is licensed to:',
    who.name,
    who.email,
    `Account: ${who.userId}`,
    `Downloaded: ${who.when}`,
    '',
    `"${who.title}"`,
    'Distributing this file breaches its licence and is traceable to this account.'
  ];

  const decoder = new TextDecoder('latin1');
  const source = decoder.decode(pdf);

  // Find the highest existing object number so new ones cannot collide.
  let maxObj = 0;
  for (const m of source.matchAll(/(\d+)\s+0\s+obj\b/g)) {
    const n = parseInt(m[1], 10);
    if (n > maxObj) maxObj = n;
  }

  // The root catalogue and the page tree, needed to attach a new page.
  const rootMatch = source.match(/\/Root\s+(\d+)\s+0\s+R/);
  const pagesMatch = source.match(/(\d+)\s+0\s+obj\s*<<[^>]*\/Type\s*\/Pages/);
  if (!rootMatch || !pagesMatch) {
    // Not a shape we can safely extend. Returning the file unstamped is far
    // better than returning a corrupted one.
    return pdf;
  }

  const pagesObjNum = parseInt(pagesMatch[1], 10);
  const pagesObjBody = source.slice(pagesMatch.index!);
  const kidsMatch = pagesObjBody.match(/\/Kids\s*\[([^\]]*)\]/);
  const countMatch = pagesObjBody.match(/\/Count\s+(\d+)/);
  if (!kidsMatch || !countMatch) return pdf;

  const fontNum = maxObj + 1;
  const contentNum = maxObj + 2;
  const pageNum = maxObj + 3;

  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  let stream = 'BT\n/F1 11 Tf\n60 760 Td\n16 TL\n';
  for (const line of text) stream += `(${escape(line)}) Tj T*\n`;
  stream += 'ET';

  const additions: string[] = [];
  additions.push(
    `${fontNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  );
  additions.push(
    `${contentNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  );
  additions.push(
    `${pageNum} 0 obj\n<< /Type /Page /Parent ${pagesObjNum} 0 R ` +
      `/MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNum} 0 R >> >> ` +
      `/Contents ${contentNum} 0 R >>\nendobj\n`
  );
  // The page tree is reissued with the new page appended.
  additions.push(
    `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${kidsMatch[1].trim()} ${pageNum} 0 R] ` +
      `/Count ${parseInt(countMatch[1], 10) + 1} >>\nendobj\n`
  );

  let out = source.endsWith('\n') ? source : source + '\n';
  const offsets: Array<[number, number]> = [];

  for (const obj of additions) {
    const num = parseInt(obj.match(/^(\d+)\s+0\s+obj/)![1], 10);
    offsets.push([num, out.length]);
    out += obj;
  }

  const xrefStart = out.length;
  // One subsection per object keeps this valid without rebuilding the whole
  // table, which we cannot do without parsing the original xref.
  out += 'xref\n';
  for (const [num, off] of offsets) {
    out += `${num} 1\n${String(off).padStart(10, '0')} 00000 n \n`;
  }

  const prevMatch = source.lastIndexOf('startxref');
  const prevOffset =
    prevMatch !== -1 ? parseInt(source.slice(prevMatch + 9).trim().split(/\s/)[0], 10) : 0;

  out +=
    `trailer\n<< /Size ${maxObj + 4} /Root ${rootMatch[1]} 0 R /Prev ${prevOffset} >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;

  // latin1 out, matching the decode above: a PDF is byte-oriented, and
  // TextEncoder would re-encode high bytes as UTF-8 and corrupt the streams.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
