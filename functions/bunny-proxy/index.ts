/**
 * Proxies the Bunny Stream API so the account key never reaches a browser.
 *
 * ── Why this authenticates ───────────────────────────────────────────────
 *
 * It did not. Every action — including list-videos and delete-video — ran for
 * any caller who could reach the URL. Verified against the live deployment:
 *
 *     curl -X POST .../bunny-proxy -d '{"action":"list-videos"}'
 *     -> {"data":{"totalItems":0,...}}
 *
 * It returned an empty list only because the library is empty. With real
 * course video in it, anyone could enumerate every video, mint a signed
 * playback URL for any of them, or delete them outright — the function holds
 * the library key, so it was doing the deleting on the caller's behalf.
 */
import { createClient } from 'npm:@insforge/sdk';

/** Actions that change or expose the library, rather than serving playback. */
const PRIVILEGED = new Set(['create-video', 'get-upload-signature', 'list-videos', 'delete-video']);

/** Who may manage video: the people who publish courses. */
const TEACHING_ROLES = new Set([
  'tutor', 'mentor', 'teacher', 'author',
  'management', 'staff', 'admin', 'super_admin'
]);

export default async function(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    // ── Every action needs a signed-in caller ──
    const bearer = req.headers.get('Authorization')?.replace('Bearer ', '') || null;
    if (!bearer) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const insforgeUrl = Deno.env.get('INSFORGE_BASE_URL');
    if (!insforgeUrl) throw new Error('INSFORGE_BASE_URL is not configured.');

    const asUser = createClient({ baseUrl: insforgeUrl, edgeFunctionToken: bearer });
    const { data: userData, error: userError } = await asUser.auth.getCurrentUser();
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Managing the library needs a teaching role ──
    // Playback (get-signed-url, get-video) is left to any signed-in user:
    // entitlement to a course is enforced where the video is rendered, and a
    // signed URL is short-lived.
    if (PRIVILEGED.has(action)) {
      const { data: profile } = await asUser.database
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!TEACHING_ROLES.has(String(profile?.role || '').toLowerCase())) {
        return new Response(
          JSON.stringify({ error: 'Not permitted to manage video.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Credentials come from the function environment only — never inline.
    // Set BUNNY_API_KEY / BUNNY_LIBRARY_ID / BUNNY_PULL_ZONE as function secrets.
    const apiKey = Deno.env.get('BUNNY_API_KEY');
    const libraryId = Deno.env.get('BUNNY_LIBRARY_ID');
    const pullZone = Deno.env.get('BUNNY_PULL_ZONE');

    if (!apiKey || !libraryId || !pullZone) {
      console.error('[bunny-proxy] Missing BUNNY_API_KEY / BUNNY_LIBRARY_ID / BUNNY_PULL_ZONE');
      return new Response(
        JSON.stringify({ error: 'Video service is not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create-video') {
      const { title, collectionId } = payload;
      const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
        method: 'POST',
        headers: {
          'AccessKey': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: title || 'Untitled Video', collectionId })
      });

      if (!res.ok) {
        const errorText = await res.text();
        return new Response(JSON.stringify({ error: `Bunny API Error: ${errorText}` }), {
          status: res.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get-upload-signature') {
      const { videoId, expiration } = payload;
      if (!videoId) {
        return new Response(JSON.stringify({ error: 'Missing videoId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const expires = expiration || Math.floor(Date.now() / 1000) + 7200; // 2 hours default
      const message = libraryId + apiKey + expires + videoId;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(message));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      return new Response(JSON.stringify({
        data: {
          signature,
          expiration: expires,
          libraryId,
          videoId,
          pullZone
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get-signed-url') {
      const { videoId } = payload;
      if (!videoId) {
        return new Response(JSON.stringify({ error: 'Missing videoId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Bunny CDN token authentication.
      //
      // Three things were wrong here and each one alone made every signed URL
      // fail with 403, so course video never played from a token-protected
      // zone:
      //
      //   1. It signed with BUNNY_API_KEY. Bunny validates against the pull
      //      zone's *token authentication key*, which is a different secret —
      //      set BUNNY_TOKEN_KEY to the zone's ZoneSecurityKey.
      //   2. It used HMAC-SHA256. Bunny hashes a plain concatenation:
      //      sha256(key + path + expires).
      //   3. It wrote `bcdn_token=...` into the path before the filename.
      //      Bunny reads `token` and `expires` as query parameters.
      //
      // The signed path must be the full path being requested, so HLS segment
      // requests inherit the same token.
      const tokenKey = Deno.env.get('BUNNY_TOKEN_KEY');
      if (!tokenKey) {
        console.error('[bunny-proxy] Missing BUNNY_TOKEN_KEY (pull zone token authentication key)');
        return new Response(
          JSON.stringify({ error: 'Video security is not configured.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const expires = Math.floor(Date.now() / 1000) + 86400; // 24 hours
      const signedPath = `/${videoId}/playlist.m3u8`;

      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(tokenKey + signedPath + expires)
      );
      const token = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const signedUrl = `https://${pullZone}${signedPath}?token=${token}&expires=${expires}`;
      const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=true&loop=false&muted=false&preload=true`;

      return new Response(JSON.stringify({
        data: {
          signedUrl,
          embedUrl,
          libraryId,
          pullZone,
          videoId
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list-videos') {
      const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
        method: 'GET',
        headers: {
          'AccessKey': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        return new Response(JSON.stringify({ error: `Bunny API Error: ${errorText}` }), {
          status: res.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get-video') {
      const { videoId } = payload;
      const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
        method: 'GET',
        headers: {
          'AccessKey': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        return new Response(JSON.stringify({ error: `Bunny API Error: ${errorText}` }), {
          status: res.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete-video') {
      const { videoId } = payload;
      const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'AccessKey': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        return new Response(JSON.stringify({ error: `Bunny API Error: ${errorText}` }), {
          status: res.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[Bunny Proxy Error]:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
