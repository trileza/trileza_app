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

    const apiKey = '54a68871-34b2-4ef7-be18c84d4297-c7b9-4443';
    const libraryId = '711161';
    const pullZone = 'vz-5d94ab2c-5c7.b-cdn.net';

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

      const expires = Math.floor(Date.now() / 1000) + 86400; // 24 hours
      const tokenPath = `/${videoId}/`;
      
      const tokenKey = apiKey;
      const message = tokenPath + expires;
      
      const encoder = new TextEncoder();
      const keyData = encoder.encode(tokenKey);
      const messageData = encoder.encode(message);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const base64String = btoa(String.fromCharCode(...hashArray));
      const token = 'HS256-' + base64String
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

      const signedUrl = `https://${pullZone}/bcdn_token=${token}&expires=${expires}&token_path=${encodeURIComponent(tokenPath)}/${videoId}/playlist.m3u8`;
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
