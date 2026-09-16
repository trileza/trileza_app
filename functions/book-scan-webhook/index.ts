/**
 * Receives scan results from Copyleaks.
 *
 * Copyleaks posts each stage of a scan to the webhook URL given at submission,
 * substituting {STATUS} with `completed`, `error` or `creditsChecked`. Only a
 * completed scan carries scores.
 *
 * ── On authentication ────────────────────────────────────────────────────
 *
 * Copyleaks does not sign its callbacks the way Paystack does. What protects
 * this endpoint is that the scan id is a UUID we generated and told only
 * Copyleaks: a caller who does not have it can do nothing, and one who does
 * can only report a result for a scan that already exists and is still
 * running.
 *
 * That is weaker than a signature, so the endpoint is deliberately narrow. It
 * cannot create a scan, cannot publish a book, and cannot clear a review a
 * person has already resolved — record_scan_result refuses to touch a
 * completed scan. The worst a forged callback achieves is flagging a book for
 * human review, which is the safe direction to fail in.
 */

import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify({ status: 'success', ...body }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const scanId = url.searchParams.get('scanId');
    const stage = url.searchParams.get('status');

    if (!scanId) return ok({ ignored: 'no scanId' });

    const insforgeUrl = Deno.env.get('INSFORGE_BASE_URL');
    const apiKey = Deno.env.get('API_KEY');
    if (!insforgeUrl || !apiKey) throw new Error('Backend is not configured.');

    const asService = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: apiKey });

    const { data: scan } = await asService.database
      .from('book_scans')
      .select('id, book_id, status')
      .eq('external_scan_id', scanId)
      .maybeSingle();

    // A scan id we never issued. Acknowledge so the provider stops retrying,
    // but record nothing.
    if (!scan) return ok({ ignored: 'unknown scan id', scanId });

    const payload = await req.json().catch(() => ({}));

    // ── The scan failed on their side ──
    if (stage === 'error') {
      await asService.database
        .from('book_scans')
        .update({
          status: 'failed',
          verdict: 'error',
          status_detail:
            payload?.error?.message ||
            'The scanning provider could not process this file. Review it manually.',
          completed_at: new Date().toISOString()
        })
        .eq('id', scan.id);

      return ok({ recorded: 'error', scanId });
    }

    // Anything that is not a finished scan carries no scores.
    if (stage !== 'completed') {
      return ok({ ignored: `stage ${stage}`, scanId });
    }

    // ── Pull the scores out ──
    // Copyleaks reports similarity as matched word counts rather than a
    // percentage, so it has to be derived.
    const results = payload?.results || {};
    const stats = payload?.scannedDocument || {};
    const totalWords = Number(stats.totalWords || 0);

    const matchedWords =
      Number(results?.score?.identicalWords || 0) +
      Number(results?.score?.minorChangedWords || 0) +
      Number(results?.score?.relatedMeaningWords || 0);

    const plagiarismScore =
      totalWords > 0 ? Math.min(100, (matchedWords / totalWords) * 100) : 0;

    // aiScore is 0..1 from Copyleaks; the column is a percentage.
    const aiRaw = payload?.aiDetection?.summary?.ai;
    const aiScore = aiRaw === undefined || aiRaw === null ? null : Math.min(100, Number(aiRaw) * 100);

    // Keep the sources a reviewer needs to judge the match, not the whole
    // payload — these rows are read in a dashboard.
    const sources = (payload?.results?.internet || [])
      .slice(0, 20)
      .map((s: any) => ({
        url: s.url,
        title: s.title,
        matched_words: s.matchedWords,
        percent:
          totalWords > 0 ? Number(((Number(s.matchedWords || 0) / totalWords) * 100).toFixed(2)) : 0
      }));

    const { error: recordErr } = await asService.database.rpc('record_scan_result', {
      p_external_scan_id: scanId,
      p_plagiarism_score: Number(plagiarismScore.toFixed(2)),
      p_ai_score: aiScore === null ? null : Number(aiScore.toFixed(2)),
      p_matched_sources: sources
    });

    if (recordErr) {
      console.error('[book-scan-webhook] could not record result:', recordErr);
      // 500 so Copyleaks retries. record_scan_result is idempotent, so a
      // retry that succeeds cannot double-apply.
      return new Response(JSON.stringify({ error: 'could not record' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    return ok({
      recorded: true,
      scanId,
      plagiarism: Number(plagiarismScore.toFixed(2)),
      ai: aiScore === null ? null : Number(aiScore.toFixed(2))
    });
  } catch (err: any) {
    console.error('[book-scan-webhook]', err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || 'Webhook failed' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
