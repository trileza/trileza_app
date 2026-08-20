import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, x-user-token'
};

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  try {
    let action, title, meetingId, participant, recordingId, hostEmail, sessionTitle;
    
    if (req.method === 'GET') {
      const urlObj = new URL(req.url);
      action = urlObj.searchParams.get('action');
      recordingId = urlObj.searchParams.get('recordingId');
      meetingId = urlObj.searchParams.get('meetingId');
    } else {
      const body = await req.json();
      action = body.action;
      title = body.title;
      meetingId = body.meetingId;
      participant = body.participant;
      recordingId = body.recordingId;
      hostEmail = body.hostEmail;
      sessionTitle = body.sessionTitle;
    }
    
    // Retrieve Cloudflare Credentials from environment variables
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const appId = Deno.env.get('CLOUDFLARE_APP_ID');
    const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    
    if (!accountId || !appId || !apiToken) {
      throw new Error('Cloudflare RealtimeKit credentials (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_APP_ID/CLOUDFLARE_API_TOKEN) are not configured in the backend environment.');
    }
    
    const authHeader = `Bearer ${apiToken}`;
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}`;
    
    // ─── ACTION: CREATE MEETING ───
    if (action === 'create_meeting') {
      console.log(`[RealtimeKit Service] Creating meeting: ${title}`);
      const response = await fetch(`${baseUrl}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          title: title || 'Live Class',
        })
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(`RealtimeKit API error: ${JSON.stringify(result.errors) || response.statusText}`);
      }
      
      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // ─── ACTION: ADD PARTICIPANT ───
    if (action === 'add_participant') {
      if (!meetingId || !participant) {
        throw new Error('meetingId and participant details are required.');
      }
      
      console.log(`[RealtimeKit Service] Adding participant ${participant.name} to meeting ${meetingId}`);
      
      // Determine the preset name based on user role (case-insensitive)
      const roleLower = participant.role?.toLowerCase() || '';
      const presetName = (roleLower === 'tutor' || roleLower === 'mentor' || roleLower === 'management') 
        ? 'group_call_host' 
        : 'group_call_participant';
        
      const response = await fetch(`${baseUrl}/meetings/${meetingId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          preset_name: presetName,
          custom_participant_id: participant.id
        })
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(`RealtimeKit API error: ${JSON.stringify(result.errors) || response.statusText}`);
      }
      
      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── ACTION: START RECORDING ───
    if (action === 'start_recording') {
      if (!meetingId) {
        throw new Error('meetingId is required to start recording.');
      }
      
      console.log(`[RealtimeKit Service] Starting recording for meeting ${meetingId}`);
      const response = await fetch(`${baseUrl}/recordings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          meeting_id: meetingId,
        })
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(`RealtimeKit API error: ${JSON.stringify(result.errors) || response.statusText}`);
      }
      
      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── ACTION: STOP RECORDING ───
    if (action === 'stop_recording') {
      if (!recordingId) {
        throw new Error('recordingId is required to stop recording.');
      }
      
      console.log(`[RealtimeKit Service] Stopping recording ID ${recordingId}`);
      const response = await fetch(`${baseUrl}/recordings/${recordingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          action: 'stop'
        })
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(`RealtimeKit API error: ${JSON.stringify(result.errors) || response.statusText}`);
      }
      
      // Send email to the host if they provided a hostEmail
      if (hostEmail) {
        try {
          const insforgeUrl = Deno.env.get('INSFORGE_URL') || '';
          const insforgeAnonKey = Deno.env.get('INSFORGE_ANON_KEY') || '';
          if (insforgeUrl && insforgeAnonKey) {
            const insforge = createClient({ baseUrl: insforgeUrl, anonKey: insforgeAnonKey });
            
            const reqUrl = new URL(req.url);
            const downloadLink = `${reqUrl.origin}${reqUrl.pathname}?action=download&recordingId=${recordingId}`;
            
            console.log(`[RealtimeKit Service] Sending recording email to ${hostEmail}`);
            await insforge.emails.send({
              to: hostEmail,
              subject: `Recording Link: ${sessionTitle || 'Live Class'}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: white;">
                  <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 24px; text-align: center; font-size: 20px; font-weight: 800;">Class Recording Saved Online</h2>
                  <p>Hello,</p>
                  <p>Your online class recording for <strong>${sessionTitle || 'Live Class'}</strong> is processing and has been saved to the cloud.</p>
                  <p>You can download the video file directly by clicking the link below:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${downloadLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block;">Download Recording</a>
                  </div>
                  <p>Or copy this link to your browser:</p>
                  <p style="word-break: break-all; color: #3b82f6;">${downloadLink}</p>
                  <p style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b;">
                    - Trileza Live Team
                  </p>
                </div>
              `
            });
          }
        } catch (emailErr) {
          console.error('[RealtimeKit Service] Failed to send recording email:', emailErr);
        }
      }
      
      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── ACTION: DOWNLOAD RECORDING PROXY (GET) ───
    if (action === 'download') {
      if (!recordingId) {
        return new Response('Missing recordingId parameter.', { status: 400 });
      }
      
      console.log(`[RealtimeKit Service] Fetching download details for recording ID ${recordingId}`);
      const response = await fetch(`${baseUrl}/recordings/${recordingId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        }
      });
      
      if (!response.ok) {
        return new Response(`Failed to fetch recording metadata from Cloudflare. Status: ${response.status}`, { status: 500 });
      }
      
      const result = await response.json();
      if (!result.success || !result.data) {
        return new Response('Recording not found or failed to retrieve from Cloudflare.', { status: 404 });
      }
      
      const recording = result.data;
      
      // If the recording is not completed yet, show a nice loading / refreshing screen
      if (recording.status !== 'completed') {
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Processing Recording</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
                .card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); text-align: center; max-width: 420px; width: 100%; border: 1px solid #e2e8f0; }
                h2 { color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 800; }
                .loader { border: 4px solid #f1f5f9; border-top: 4px solid #10b981; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; margin: 24px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                p { font-size: 14px; line-height: 1.6; color: #64748b; }
                .status-badge { background-color: #fef3c7; color: #d97706; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; tracking-wider: 0.05em; display: inline-block; margin-bottom: 12px; }
                button { background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; margin-top: 20px; transition: background 0.2s; font-size: 14px; }
                button:hover { background: #059669; }
              </style>
            </head>
            <body>
              <div class="card">
                <span class="status-badge">${recording.status || 'processing'}</span>
                <h2>Recording is Processing</h2>
                <div class="loader"></div>
                <p>Cloudflare is currently compiling your class recording. Once complete, your download will start automatically.</p>
                <p>Please refresh this page in a few minutes.</p>
                <button onclick="window.location.reload()">Check Status</button>
              </div>
            </body>
          </html>
        `, {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      const downloadUrl = recording.download_url;
      if (!downloadUrl) {
        return new Response('Recording is completed, but no download URL was provided by Cloudflare.', { status: 500 });
      }
      
      // Redirect the user directly to the Cloudflare download URL
      return new Response(null, {
        status: 302,
        headers: {
          'Location': downloadUrl
        }
      });
    }

    // ─── ACTION: CHECK RECORDING STATUS ───
    if (action === 'check_recording_status') {
      if (!recordingId) {
        throw new Error('recordingId is required to check recording status.');
      }
      
      console.log(`[RealtimeKit Service] Checking status of recording ID ${recordingId}`);
      const response = await fetch(`${baseUrl}/recordings/${recordingId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        }
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(`RealtimeKit API error: ${JSON.stringify(result.errors) || response.statusText}`);
      }
      
      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── ACTION: LIST PRESETS ───
    if (action === 'list_presets') {
      console.log(`[RealtimeKit Service] Listing presets`);
      const response = await fetch(`${baseUrl}/presets`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        }
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(`RealtimeKit API error: ${JSON.stringify(result.errors) || response.statusText}`);
      }
      
      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error(`Invalid action: ${action}`);
  } catch (err: any) {
    console.error(`[Dyte Service Error] ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
