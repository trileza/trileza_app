import { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const meetingId = pathParts[pathParts.length - 1];

  if (!meetingId) {
    return new Response("Missing meeting ID", { status: 400 });
  }

  // Read from the edge environment only — no committed fallback credentials.
  const INSFORGE_URL = Deno.env.get("INSFORGE_URL") || Deno.env.get("VITE_INSFORGE_URL");
  const INSFORGE_ANON_KEY = Deno.env.get("INSFORGE_ANON_KEY") || Deno.env.get("VITE_INSFORGE_ANON_KEY");

  if (!INSFORGE_URL || !INSFORGE_ANON_KEY) {
    console.error("[share] Missing INSFORGE_URL / INSFORGE_ANON_KEY environment variables");
  }

  let title = "Trileza Live Broadcast";
  let hostName = "Academic Expert";
  let scheduledAt = "";
  let imageUrl = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop";

  try {
    // Without credentials we still serve the page, just with generic OG tags.
    const dbRes = INSFORGE_URL && INSFORGE_ANON_KEY
      ? await fetch(
        `${INSFORGE_URL}/rest/v1/live_sessions?dyte_meeting_id=eq.${meetingId}&select=*,profiles!live_sessions_tutor_id_fkey(full_name)`,
        {
          headers: {
            apikey: INSFORGE_ANON_KEY,
            Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
          },
        }
      )
      : null;

    if (dbRes && dbRes.ok) {
      const data = await dbRes.json();
      if (data && data.length > 0) {
        const session = data[0];
        title = session.title || title;
        hostName = session.profiles?.full_name || hostName;
        scheduledAt = session.scheduled_at 
          ? new Date(session.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
          : "";
        imageUrl = session.image_url || imageUrl;
      }
    }
  } catch (err) {
    console.error("Edge function failed to fetch meeting details:", err);
  }

  const description = `Join the live session hosted by ${hostName}. ${scheduledAt ? `Scheduled: ${scheduledAt}` : ""}`;
  const redirectUrl = `${url.origin}/live/${meetingId}`;

  // Return HTML with Open Graph tags and immediate client redirect
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta property="og:title" content="${title} • Trileza Live">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${redirectUrl}">
  <meta property="og:type" content="video.meeting">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</head>
<body>
  <p>Redirecting to live classroom...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=UTF-8",
    },
  });
};
