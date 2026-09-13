import { createClient } from 'npm:@insforge/sdk';
import nodemailer from 'npm:nodemailer';

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
    const action = body.action;

    const authHeader = req.headers.get('Authorization');
    const userToken = authHeader ? authHeader.replace('Bearer ', '') : null;

    // Use admin token for database operations (Service Role)
    const adminToken = Deno.env.get('API_KEY');
    const adminClient = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
      edgeFunctionToken: adminToken!
    });

    // Helper: safe audit log (never throws)
    const logAudit = async (adminUserId: string | null, actionName: string, targetType: string, targetId: string, details: any) => {
      try {
        // Resolve admin_users.id from user_id if needed
        let resolvedAdminUserId = null;
        if (adminUserId) {
          const { data: adminRec } = await adminClient.database
            .from('admin_users')
            .select('id')
            .eq('user_id', adminUserId)
            .maybeSingle();
          resolvedAdminUserId = adminRec?.id || null;
        }
        await adminClient.database.from('admin_audit_logs').insert([{
          admin_id: adminUserId,
          admin_user_id: resolvedAdminUserId,
          action_type: actionName,
          target_type: targetType,
          target_id: targetId,
          previous_state: null,
          new_state: details,
          reason: `${actionName}: ${JSON.stringify(details)}`
        }]);
      } catch (e) {
        console.error('[Audit Log Error]:', e);
      }
    };

    // Verify Super Admin for send_email
    if (action === 'send_email') {
      if (!userToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const userClient = createClient({
        baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
        edgeFunctionToken: userToken
      });

      console.log('[Admin Invites] userToken:', userToken ? 'present' : 'missing');
      const { data: userData, error: userError } = await userClient.auth.getCurrentUser();
      console.log('[Admin Invites] getCurrentUser result:', { userData, userError });
      const user = userData?.user;
      if (userError || !user) throw new Error('Unauthorized');

      console.log('[Admin Invites] Querying admin_users for user:', user.id);
      const { data: adminData } = await adminClient.database
        .from('admin_users')
        .select('roles, suspended')
        .eq('user_id', user.id)
        .single();
      console.log('[Admin Invites] adminData query result:', { adminData });

      if (!adminData || adminData.suspended || !(adminData.roles as string[])?.includes('super_admin')) {
        return new Response(JSON.stringify({ error: 'Only Super Admins can perform this action' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { email, token, roles, note } = body;
      console.log('[Admin Invites] send_email payload:', { email, token, roles, note });

      // Send Email (use SMTP via InsForge's built-in SMTP, or Resend)
      await sendInviteEmail(email, token, roles, note);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Accept Invite (Public endpoint with valid token)
    if (action === 'accept') {
      const { token, userId } = body;

      const { data: invite, error: inviteError } = await adminClient.database
        .from('admin_invites')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invitation token.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (new Date(invite.expires_at) < new Date()) {
        await adminClient.database.from('admin_invites').update({ status: 'expired' }).eq('id', invite.id);
        return new Response(JSON.stringify({ error: 'Invitation has expired.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!userId) {
         // This is just a token validation check before registration/login
         return new Response(JSON.stringify({ success: true, valid: true, email: invite.email, roles: invite.roles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Process acceptance (after user is logged in/registered and we have userId)
      
      // Upsert admin_users
      const { data: existingAdmin } = await adminClient.database
        .from('admin_users')
        .select('id, roles, status')
        .eq('user_id', userId)
        .maybeSingle();

      let finalRoles = invite.roles;

      if (existingAdmin) {
        // Merge roles
        const currentRoles = (existingAdmin.roles as string[]) || [];
        finalRoles = [...new Set([...currentRoles, ...invite.roles])];

        // An invitation is a super admin's grant, so it settles a pending or
        // rejected self-service application. A suspension is left alone: that
        // is a separate decision and must be lifted explicitly.
        const updates: Record<string, unknown> = { roles: finalRoles };
        if (!existingAdmin.status || existingAdmin.status === 'pending' || existingAdmin.status === 'rejected') {
          updates.status = 'active';
        }

        await adminClient.database
          .from('admin_users')
          .update(updates)
          .eq('user_id', userId);
      } else {
        await adminClient.database
          .from('admin_users')
          .insert([{ user_id: userId, roles: invite.roles, onboarded: false, suspended: false, status: 'active' }]);
      }

      // Mark invite accepted
      await adminClient.database
        .from('admin_invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      // Audit Log (non-blocking)
      await logAudit(null, 'invite_accepted', 'admin_invite', invite.id, { email: invite.email, assigned_roles: finalRoles });

      return new Response(JSON.stringify({ success: true, roles: finalRoles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[admin-invites Error]:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    });
  }
}

async function sendInviteEmail(email: string, token: string, roles: string[], note: string | null) {
  const smtpPass = Deno.env.get('SMTP_PASSWORD');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const siteUrl = Deno.env.get('SITE_URL') || 'https://trileza.netlify.app';
  const acceptLink = `${siteUrl}/gate/accept?token=${token}`;
  const roleText = roles.map(r => r.replace('_', ' ').toUpperCase()).join(', ');

  const htmlContent = `
    <h2>Welcome to Trileza!</h2>
    <p>You have been invited to become an Admin on Trileza with the following roles: <strong>${roleText}</strong>.</p>
    ${note ? `<p><em>Note from sender: "${note}"</em></p>` : ''}
    <p>Click the button below to accept and complete your registration. This link expires in 7 days.</p>
    <a href="${acceptLink}" style="display:inline-block;padding:12px 24px;background-color:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Accept Invitation</a>
    <p><small>If the button doesn't work, copy this link: ${acceptLink}</small></p>
  `;

  // 1. Try SMTP if password is provided
  if (smtpPass) {
    try {
      console.log('[SMTP] Attempting to send invitation email via Gmail SMTP...');
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: 'dalestic12@gmail.com',
          pass: smtpPass
        }
      });

      await transporter.sendMail({
        from: '"Trileza Admin" <dalestic12@gmail.com>',
        to: email,
        subject: "You've Been Invited to Join Trileza Admin",
        html: htmlContent
      });
      console.log('[SMTP] Invitation email sent successfully via SMTP.');
      return;
    } catch (smtpErr) {
      console.error('[SMTP Error] Failed to send email via SMTP, falling back to Resend/Console:', smtpErr);
    }
  }

  // 2. Try Resend if API key is provided
  if (resendKey) {
    try {
      console.log('[Resend] Attempting to send invitation email via Resend...');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Trileza Admin <admin@trileza.com>',
          to: [email],
          subject: "You've Been Invited to Join Trileza Admin",
          html: htmlContent
        })
      });
      if (res.ok) {
        console.log('[Resend] Invitation email sent successfully via Resend.');
        return;
      }
      console.error('[Resend Error] API returned non-ok response:', await res.text());
    } catch (resendErr) {
      console.error('[Resend Error] Failed to send email via Resend:', resendErr);
    }
  }

  // 3. Fallback: Log link to console
  console.warn('[Email Fallback] Email service unconfigured. Printing invite link instead:');
  console.log(`Invite link for ${email}: ${acceptLink}`);
}
