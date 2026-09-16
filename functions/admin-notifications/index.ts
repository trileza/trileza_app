import { createClient } from 'npm:@insforge/sdk';

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
    const { action, email, roles } = body;

    const authHeader = req.headers.get('Authorization');
    const userToken = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!userToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Verify caller is a super admin
    const adminToken = Deno.env.get('API_KEY');
    const adminClient = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
      edgeFunctionToken: adminToken!
    });

    const userClient = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
      edgeFunctionToken: userToken
    });

    const { data: userData, error: userError } = await userClient.auth.getCurrentUser();
    const user = userData?.user;
    if (userError || !user) throw new Error('Unauthorized');

    const { data: adminData } = await adminClient.database
      .from('admin_users')
      .select('roles, suspended')
      .eq('user_id', user.id)
      .single();

    if (!adminData || adminData.suspended || !(adminData.roles as string[])?.includes('super_admin')) {
      return new Response(JSON.stringify({ error: 'Only Super Admins can perform this action' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('[Admin Notifications] RESEND_API_KEY not configured.');
      return new Response(JSON.stringify({ success: true, warning: 'RESEND_API_KEY not configured' }), {
        headers: corsHeaders
      });
    }

    const roleText = roles ? roles.map((r: string) => r.replace('_', ' ').toUpperCase()).join(', ') : '';

    // Where the deployed site lives. Was hardcoded to a netlify.app address
    // that no longer exists, which would have sent approved admins to a dead
    // sign-in page.
    const siteUrl = Deno.env.get('SITE_URL');
    if (!siteUrl) {
      throw new Error('SITE_URL is not configured; cannot build a working admin portal link.');
    }

    let htmlContent = '';
    let subject = '';

    if (action === 'approved') {
      subject = "Your Admin Application Has Been Approved";
      htmlContent = `
        <h2>Your Admin Application Has Been Approved!</h2>
        <p>Congratulations! Your request to become an administrator on Trileza has been approved.</p>
        <p>You now have access to the following role(s): <strong>${roleText}</strong>.</p>
        <p>Please log in to the admin portal at <a href="${siteUrl}/gate">${siteUrl.replace(/^https?:\/\//, '')}/gate</a> to access your dashboard.</p>
        <p><em>Note: Two-Factor Authentication (2FA) is mandatory for all administrators. You will be prompted to set it up or enter your code on your next login.</em></p>
      `;
    } else if (action === 'rejected') {
      subject = "Update on Your Admin Application";
      htmlContent = `
        <h2>Update on Your Admin Application</h2>
        <p>Thank you for applying for an administrator role on Trileza.</p>
        <p>Your application was reviewed and unfortunately was not approved at this time.</p>
        <p>You can view your status or submit another application later from your settings page.</p>
      `;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });
    }

    // Send via Resend
    console.log(`[Resend] Sending ${action} email to ${email}...`);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Trileza Admin <admin@trileza.com>',
        to: [email],
        subject: subject,
        html: htmlContent
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Resend Error]:', errText);
      throw new Error(`Resend API returned non-ok: ${errText}`);
    }

    console.log(`[Resend] Email successfully sent to ${email}.`);
    return new Response(JSON.stringify({ success: true }), {
      headers: corsHeaders
    });

  } catch (err: any) {
    console.error('[admin-notifications Error]:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
