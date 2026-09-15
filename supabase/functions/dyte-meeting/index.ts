/**
 * RealtimeKit meeting service (Cloudflare RealtimeKit).
 *
 * The function slug stays `dyte-meeting` for compatibility: it is the name the
 * deployed function is registered under, and renaming it would break every
 * client build that has not shipped yet. Everything inside speaks RealtimeKit.
 *
 * ── Why this function authenticates ──────────────────────────────────────
 *
 * It previously took the caller's word for who they were. The browser sent
 * `participant.role`, and this function handed back a `group_call_host` token
 * whenever that string was "tutor", "mentor" or "management".
 *
 * Nothing verified it. The endpoint required no token at all, so anyone who
 * could reach the URL — signed in or not — could mint a host token for any
 * meeting id and get microphone control, recording, and the power to kick
 * participants out of someone else's class.
 *
 * Host status is now derived from the database: you are the host of a session
 * if you are its `tutor_id`, or if you hold a staff-level platform role. The
 * client's opinion is ignored entirely, and the name and avatar on the
 * participant come from the caller's own profile rather than the request body.
 */

import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, x-user-token'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

/** Platform roles that may host any session, not just their own. */
const STAFF_ROLES = new Set(['management', 'staff', 'admin', 'super_admin']);

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let action: string | null,
      title: string | undefined,
      meetingId: string | undefined,
      recordingId: string | undefined;

    if (req.method === 'GET') {
      const urlObj = new URL(req.url);
      action = urlObj.searchParams.get('action');
      recordingId = urlObj.searchParams.get('recordingId') ?? undefined;
      meetingId = urlObj.searchParams.get('meetingId') ?? undefined;
    } else {
      const body = await req.json();
      action = body.action;
      title = body.title;
      meetingId = body.meetingId;
      recordingId = body.recordingId;
    }

    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const appId = Deno.env.get('CLOUDFLARE_APP_ID');
    const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');

    if (!accountId || !appId || !apiToken) {
      throw new Error(
        'Cloudflare RealtimeKit credentials (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_APP_ID/CLOUDFLARE_API_TOKEN) are not configured in the backend environment.'
      );
    }

    const authHeader = `Bearer ${apiToken}`;
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}`;

    /** Calls the RealtimeKit API and unwraps its envelope. */
    const rtk = async (path: string, init: RequestInit = {}) => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          ...(init.headers || {})
        }
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          `RealtimeKit API error: ${JSON.stringify(result.errors) || response.statusText}`
        );
      }
      return result.data;
    };

    // ── The download proxy is a plain browser navigation ──────────────────
    // It is opened from an email link, so it carries no Authorization header
    // and cannot. The recording id is an unguessable Cloudflare UUID, and the
    // response is a redirect to a short-lived signed URL, so possession of the
    // link is the credential — the same model as the email itself.
    if (action === 'download') {
      if (!recordingId) return new Response('Missing recordingId parameter.', { status: 400 });
      return await handleDownload(baseUrl, authHeader, recordingId);
    }

    // ── Everything else requires a signed-in caller ───────────────────────
    const bearer = req.headers.get('Authorization')?.replace('Bearer ', '') || null;
    if (!bearer) return json({ error: 'Unauthorized' }, 401);

    const insforgeUrl = Deno.env.get('INSFORGE_BASE_URL');
    if (!insforgeUrl) throw new Error('INSFORGE_BASE_URL is not configured.');

    const asUser = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: bearer });
    const { data: userData, error: userError } = await asUser.auth.getCurrentUser();
    if (userError || !userData?.user?.id) return json({ error: 'Unauthorized' }, 401);

    const userId = userData.user.id as string;

    // Read the caller's own profile server-side. The display name and avatar
    // that appear in the meeting come from here, not from the request body, so
    // a participant cannot join under someone else's name.
    const { data: profile } = await asUser.database
      .from('profiles')
      .select('full_name, avatar_url, role')
      .eq('id', userId)
      .maybeSingle();

    const callerRole = String(profile?.role || '').toLowerCase();
    const isStaff = STAFF_ROLES.has(callerRole);

    /** True when this user owns the session behind `meetingId`, or is staff. */
    const isHostOf = async (id: string): Promise<boolean> => {
      if (isStaff) return true;
      const { data: session } = await asUser.database
        .from('live_sessions')
        .select('tutor_id')
        .eq('dyte_meeting_id', id)
        .maybeSingle();
      // A meeting with no session row is an ad-hoc call (a 1:1 from Messages).
      // There is no owner to check against, so nobody gets host rights.
      return Boolean(session?.tutor_id && session.tutor_id === userId);
    };

    // ─── CREATE MEETING ───
    // Only someone who can actually teach may spend account capacity.
    if (action === 'create_meeting') {
      const canCreate =
        isStaff || ['tutor', 'mentor', 'teacher', 'author'].includes(callerRole);
      if (!canCreate) return json({ error: 'Not permitted to create meetings' }, 403);

      const data = await rtk('/meetings', {
        method: 'POST',
        body: JSON.stringify({ title: title || 'Live Class' })
      });
      return json({ success: true, data });
    }

    // ─── ADD PARTICIPANT ───
    if (action === 'add_participant') {
      if (!meetingId) return json({ error: 'meetingId is required.' }, 400);

      const host = await isHostOf(meetingId);
      const presetName = host ? 'group_call_host' : 'group_call_participant';

      const data = await rtk(`/meetings/${meetingId}/participants`, {
        method: 'POST',
        body: JSON.stringify({
          preset_name: presetName,
          name: profile?.full_name || 'Participant',
          picture: profile?.avatar_url || undefined,
          custom_participant_id: userId
        })
      });
      return json({ success: true, data });
    }

    // ─── START RECORDING ─── host only
    if (action === 'start_recording') {
      if (!meetingId) return json({ error: 'meetingId is required to start recording.' }, 400);
      if (!(await isHostOf(meetingId))) return json({ error: 'Only the host may record' }, 403);

      const data = await rtk('/recordings', {
        method: 'POST',
        body: JSON.stringify({ meeting_id: meetingId })
      });
      return json({ success: true, data });
    }

    // ─── STOP RECORDING ─── host only
    if (action === 'stop_recording') {
      if (!recordingId) return json({ error: 'recordingId is required to stop recording.' }, 400);

      // Confirm ownership through the recording's own meeting, so a stray
      // meetingId in the body cannot be used to stop someone else's recording.
      const existing = await rtk(`/recordings/${recordingId}`, { method: 'GET' });
      const owningMeeting = existing?.meeting_id;
      if (!owningMeeting || !(await isHostOf(owningMeeting))) {
        return json({ error: 'Only the host may stop this recording' }, 403);
      }

      const data = await rtk(`/recordings/${recordingId}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'stop' })
      });

      // The recording link goes to the session's own host, looked up here.
      // It used to go to whatever address the request body carried, which
      // would have let any caller have someone else's recording mailed to them.
      await mailRecordingLink(asUser, req, recordingId, owningMeeting, userData.user.email);

      return json({ success: true, data });
    }

    // ─── CHECK RECORDING STATUS ───
    if (action === 'check_recording_status') {
      if (!recordingId) return json({ error: 'recordingId is required.' }, 400);
      const data = await rtk(`/recordings/${recordingId}`, { method: 'GET' });
      if (!data?.meeting_id || !(await isHostOf(data.meeting_id))) {
        return json({ error: 'Not permitted' }, 403);
      }
      return json({ success: true, data });
    }

    // ─── LIST PRESETS ─── staff only; it describes account configuration
    if (action === 'list_presets') {
      if (!isStaff) return json({ error: 'Not permitted' }, 403);
      const data = await rtk('/presets', { method: 'GET' });
      return json({ success: true, data });
    }

    return json({ error: `Invalid action: ${action}` }, 400);
  } catch (err: any) {
    console.error(`[RealtimeKit Service Error] ${err.message}`);
    return json({ error: err.message }, 400);
  }
}

/**
 * Emails the host a link to the finished recording.
 *
 * Failures here are logged and swallowed: the recording has already stopped
 * successfully by this point, and failing the request would tell the host their
 * recording failed when it did not.
 */
async function mailRecordingLink(
  client: any,
  req: Request,
  recordingId: string,
  meetingId: string,
  fallbackEmail?: string
): Promise<void> {
  try {
    const { data: session } = await client.database
      .from('live_sessions')
      .select('title, tutor_id')
      .eq('dyte_meeting_id', meetingId)
      .maybeSingle();

    let hostEmail = fallbackEmail;
    if (session?.tutor_id) {
      const { data: host } = await client.database
        .from('profiles')
        .select('email')
        .eq('id', session.tutor_id)
        .maybeSingle();
      if (host?.email) hostEmail = host.email;
    }
    if (!hostEmail) return;

    const reqUrl = new URL(req.url);
    const downloadLink = `${reqUrl.origin}${reqUrl.pathname}?action=download&recordingId=${recordingId}`;
    const sessionTitle = session?.title || 'Live Class';

    await client.emails.send({
      to: hostEmail,
      subject: `Recording ready: ${sessionTitle}`,
      html: `
        <div style="font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
          <div style="font-size:24px;font-weight:800;letter-spacing:-0.04em;color:#10b981;margin-bottom:28px;">trileza</div>
          <h2 style="color:#0f172a;margin:0 0 20px;font-size:20px;font-weight:800;">Your recording is ready</h2>
          <p style="color:#475569;line-height:1.6;">Your recording of <strong>${sessionTitle}</strong> has been saved.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${downloadLink}" style="background:#10b981;color:#ffffff;padding:14px 28px;text-decoration:none;font-weight:700;border-radius:10px;display:inline-block;">Download recording</a>
          </div>
          <p style="color:#64748b;font-size:13px;">Or paste this into your browser:</p>
          <p style="word-break:break-all;color:#10b981;font-size:13px;">${downloadLink}</p>
          <p style="margin-top:36px;border-top:1px solid #e2e8f0;padding-top:20px;font-size:12px;color:#94a3b8;">Trileza Live</p>
        </div>
      `
    });
  } catch (emailErr) {
    console.error('[RealtimeKit Service] Failed to send recording email:', emailErr);
  }
}

/** Redirects to the finished recording, or shows a processing page. */
async function handleDownload(
  baseUrl: string,
  authHeader: string,
  recordingId: string
): Promise<Response> {
  const response = await fetch(`${baseUrl}/recordings/${recordingId}`, {
    method: 'GET',
    headers: { Authorization: authHeader }
  });

  if (!response.ok) {
    return new Response(`Failed to fetch recording metadata. Status: ${response.status}`, {
      status: 500
    });
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    return new Response('Recording not found.', { status: 404 });
  }

  const recording = result.data;

  if (recording.status !== 'completed') {
    return new Response(processingPage(recording.status), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (!recording.download_url) {
    return new Response('Recording completed, but no download URL was provided.', { status: 500 });
  }

  return new Response(null, { status: 302, headers: { Location: recording.download_url } });
}

const processingPage = (status: string) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Processing recording — Trileza</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
      body { font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f8fafc; color:#334155; padding:16px; }
      .card { background:#fff; padding:40px; border-radius:20px; box-shadow:0 10px 25px -5px rgba(0,0,0,.08); text-align:center; max-width:420px; width:100%; border:1px solid #e2e8f0; }
      .brand { font-size:22px; font-weight:800; letter-spacing:-.04em; color:#10b981; margin-bottom:24px; }
      h2 { color:#0f172a; margin:0; font-size:20px; font-weight:800; }
      .loader { border:4px solid #f1f5f9; border-top:4px solid #10b981; border-radius:50%; width:44px; height:44px; animation:spin 1s linear infinite; margin:24px auto; }
      @keyframes spin { to { transform:rotate(360deg); } }
      p { font-size:14px; line-height:1.6; color:#64748b; }
      .badge { background:#ecfdf5; color:#059669; padding:4px 12px; border-radius:9999px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; display:inline-block; margin-bottom:16px; }
      button { background:#10b981; color:#fff; border:none; padding:12px 24px; border-radius:10px; font-weight:700; cursor:pointer; margin-top:20px; font-size:14px; font-family:inherit; }
      button:hover { background:#059669; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">trileza</div>
      <span class="badge">${status || 'processing'}</span>
      <h2>Recording is processing</h2>
      <div class="loader"></div>
      <p>Your recording is being compiled. This usually takes a few minutes.</p>
      <button onclick="window.location.reload()">Check status</button>
    </div>
  </body>
</html>`;
