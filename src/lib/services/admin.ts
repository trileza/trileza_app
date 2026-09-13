import { nexus } from '../nexus';
import { publishAdminEvent } from './realtimeEvents';
import { generateSecureToken, generateNumericCode } from '../../utils/secureRandom';
import type { 
  AdminRole, 
  CourseReview, 
  BookReview, 
  MentorApplication, 
  FlaggedContent, 
  PayoutRequest, 
  SupportTicket, 
  ComplianceRequest, 
  AdminAuditLog,
  VideoAnnotation,
  CreatorProfile
} from '../../types/admin';

/**
 * Tell the affected user that a decision has been made about their work.
 *
 * The app subscribes to `user:${id}` and refreshes on 'profile_updated'.
 * Several review paths were publishing only to the admin channel, so the author
 * or vendor saw nothing until the 60-second background poll — and in the
 * meantime the console said "approved" while their own screen said "pending".
 */
const notifyUser = async (userId: string | null | undefined, payload: Record<string, any>) => {
  if (!userId) return;
  try {
    await nexus.realtime.publish(`user:${userId}`, 'profile_updated', payload);
  } catch (err) {
    console.error('[Realtime] Could not notify user of a review decision:', err);
  }
};

export const adminService = {
  /**
   * Log an admin action to the audit trail.
   *
   * `adminId` is kept for call-site compatibility only: the database stamps the
   * acting admin from the session, so a client cannot attribute an action to
   * someone else.
   */
  async logAdminAction(
    _adminId: string,
    actionType: AdminAuditLog['action_type'],
    targetType: AdminAuditLog['target_type'],
    targetId: string,
    previousState: any,
    newState: any,
    reason: string
  ) {
    return this.logAdminAuditLog(null, actionType, targetType, targetId, previousState, newState, reason);
  },

  /**
   * Get the admin roles of a user
   */
  async getAdminUserRoles(userId: string): Promise<AdminRole[]> {
    const { data, error } = await nexus.database
      .from('admin_users')
      .select('roles')
      .eq('user_id', userId)
      .eq('suspended', false)
      .limit(1)
      .maybeSingle();

    if (error || !data) return [];
    return (data.roles as AdminRole[]) || [];
  },

  /**
   * Set the admin user's role (Super Admin only, updates both role and roles JSONB array)
   */
  async setAdminUserRole(userId: string, role: AdminRole, executorAdminId: string) {
    const { data: current } = await nexus.database
      .from('admin_users')
      .select('role, roles')
      .eq('user_id', userId)
      .maybeSingle();

    const { data, error } = await nexus.database
      .from('admin_users')
      .update({ 
        role: role,
        roles: [role]
      })
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (!error && data) {
      await this.logAdminAction(
        executorAdminId,
        'edit',
        'user',
        userId,
        current,
        { role, roles: [role] },
        `Updated admin role to ${role}`
      );

      try {
        await nexus.realtime.publish(`user:${userId}`, 'profile_updated', {
          role: role,
          metadata: { active_role: role }
        });
      } catch (realtimeErr) {
        console.error('[Realtime Publish Role Change Error]:', realtimeErr);
      }
    }

    if (!error) {
      publishAdminEvent('admin_role_changed', { userId, role });
    }

    return { data, error };
  },

  /**
   * Invite a new admin (Super Admin only)
   */
  async inviteAdmin(email: string, roles: AdminRole[], note?: string) {
    const { data: userData } = await nexus.auth.getCurrentUser();
    const user = userData?.user;
    if (!user) throw new Error('Unauthorized');

    // 1. Check if user is already an admin
    const { data: existingAdmin } = await nexus.database
      .from('profiles')
      .select('id, admin_users(roles)')
      .eq('email', email)
      .maybeSingle();
      
    if (existingAdmin?.admin_users?.[0]) {
      throw new Error('User is already an admin.');
    }

    // 2. Insert Invite directly
    const { data: invite, error: inviteError } = await nexus.database
      .from('admin_invites')
      .insert([{ email, roles, invited_by: user.id }])
      .select()
      .single();

    if (inviteError) {
      throw new Error(inviteError.message || 'Failed to create invitation in database.');
    }

    // 3. Audit Log (non-blocking)
    await this.logAdminAuditLog(
      null,
      'invite_sent',
      'admin_invite',
      invite.id,
      null,
      { email, roles, note },
      `Admin invite created for ${email}`
    );

    publishAdminEvent('admin_invited', { email, roles });

    return { invite };
  },

  /**
   * Resend admin invite
   */
  async resendInvite(inviteId: string) {
    const { data: userData } = await nexus.auth.getCurrentUser();
    const user = userData?.user;
    if (!user) throw new Error('Unauthorized');

    // 1. Fetch existing invite
    const { data: invite, error: fetchErr } = await nexus.database
      .from('admin_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (fetchErr || !invite) {
      throw new Error('Invitation not found.');
    }

    // 2. Generate new token and extend expiration
    const newToken = generateSecureToken();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: updatedInvite, error: updateErr } = await nexus.database
      .from('admin_invites')
      .update({ 
        token: newToken,
        expires_at: newExpiresAt
      })
      .eq('id', inviteId)
      .select()
      .single();

    if (updateErr || !updatedInvite) {
      throw new Error(updateErr?.message || 'Failed to update invitation.');
    }

    // 3. Audit Log
    await this.logAdminAuditLog(
      null,
      'invite_resent',
      'admin_invite',
      inviteId,
      null,
      { email: invite.email },
      `Admin invite resent for ${invite.email}`
    );

    return { invite: updatedInvite };
  },

  /**
   * Fetch all course reviews with joined metadata
   */
  async getCourseReviews(): Promise<CourseReview[]> {
    const { data: reviews, error } = await nexus.database
      .from('course_reviews')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error || !reviews) return [];

    // Fetch joined details manually to bypass complex PostgREST joins
    const { data: courses } = await nexus.database.from('courses').select('id, title, thumbnail_url, category, price_standard, price_elite, description');
    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name');

    return reviews.map((r: any) => {
      const course = courses?.find(c => c.id === r.course_id);
      const profile = profiles?.find(p => p.id === r.submitted_by);
      return {
        ...r,
        course_title: course?.title || 'Unknown Course',
        course_thumbnail: course?.thumbnail_url || '',
        category: course?.category,
        price_standard: course?.price_standard,
        price_elite: course?.price_elite,
        description: course?.description,
        submitted_by_name: profile?.full_name || 'Tutor'
      };
    });
  },

  /**
   * Content Manager: Approve or reject course submission
   */
  async reviewCourse(
    reviewId: string,
    contentManagerId: string,
    status: 'approved' | 'needs_changes' | 'rejected',
    checklist: {
      checklist_title: boolean;
      checklist_description: boolean;
      checklist_curriculum: boolean;
      checklist_video: boolean;
      checklist_audio: boolean;
      checklist_thumbnail: boolean;
      checklist_no_copyright: boolean;
    },
    notes: string,
    courseId: string
  ) {
    // One transaction: the review, the course status and the audit entry are
    // written together or not at all. The reviewer is taken from the session.
    const { data, error } = await nexus.database.rpc('admin_review_course', {
      p_review_id: reviewId,
      p_status: status,
      p_checklist: checklist,
      p_notes: notes
    });

    if (error) throw error;
    const currentReview = data as CourseReview;

    try {
      await nexus.realtime.publish('catalog-updates', 'course_updated', {
        courseId,
        status,
        timestamp: Date.now()
      });
    } catch (realtimeErr) {
      console.error('[Realtime Publish Course Error]:', realtimeErr);
    }

    publishAdminEvent('course_reviewed', { reviewId, courseId, status });
    await notifyUser(currentReview?.submitted_by, {
      event: 'course_reviewed',
      courseId,
      status,
      notes
    });

    return data;
  },

  /**
   * Fetch all book reviews with joined metadata
   */
  async getBookReviews(): Promise<BookReview[]> {
    const { data: reviews, error } = await nexus.database
      .from('book_reviews')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error || !reviews) return [];

    const { data: books } = await nexus.database.from('books').select('id, title, cover_url, category, retail_price, file_url, description');
    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name');

    return reviews.map((r: any) => {
      const book = books?.find(b => b.id === r.book_id);
      const profile = profiles?.find(p => p.id === r.submitted_by);
      return {
        ...r,
        book_title: book?.title || 'Unknown Book',
        book_cover: book?.cover_url || '',
        category: book?.category,
        retail_price: book?.retail_price,
        file_url: book?.file_url,
        description: book?.description,
        submitted_by_name: profile?.full_name || 'Author'
      };
    });
  },

  /**
   * Content Manager: Approve or reject book submission
   */
  async reviewBook(
    reviewId: string,
    contentManagerId: string,
    status: 'approved' | 'rejected' | 'needs_changes',
    checklist: {
      checklist_cover: boolean;
      checklist_description: boolean;
      checklist_readable: boolean;
      checklist_price: boolean;
      checklist_no_copyright: boolean;
    },
    notes: string,
    bookId: string
  ) {
    const { data: currentReview } = await nexus.database
      .from('book_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    const { data, error } = await nexus.database
      .from('book_reviews')
      .update({
        content_manager_id: contentManagerId,
        status,
        ...checklist,
        notes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;

    await this.logAdminAction(
      contentManagerId,
      status === 'approved' ? 'approve' : 'reject',
      'book',
      bookId,
      currentReview,
      { status, checklist, notes },
      `Book review processed. Status: ${status}. Notes: ${notes}`
    );

    try {
      await nexus.realtime.publish('catalog-updates', 'book_updated', {
        bookId,
        status,
        timestamp: Date.now()
      });
    } catch (realtimeErr) {
      console.error('[Realtime Publish Book Error]:', realtimeErr);
    }

    publishAdminEvent('book_reviewed', { reviewId, bookId, status });
    await notifyUser(currentReview?.submitted_by, {
      event: 'book_reviewed',
      bookId,
      status,
      notes
    });

    return data;
  },

  /**
   * Fetch all mentor applications with joined metadata
   */
  async getMentorApplications(): Promise<MentorApplication[]> {
    const { data: apps, error } = await nexus.database
      .from('mentor_applications')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error || !apps) return [];

    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name, avatar_url, metadata');

    return apps.map((a: any) => {
      const profile = profiles?.find(p => p.id === a.user_id);
      return {
        ...a,
        applicant_name: profile?.full_name || 'Mentor Applicant',
        applicant_avatar: profile?.avatar_url || '',
        metadata: profile?.metadata
      };
    });
  },

  /**
   * User Manager: Approve or reject mentor application
   */
  async reviewMentor(
    applicationId: string,
    reviewedBy: string,
    status: 'approved' | 'rejected' | 'needs_info',
    checklist: {
      checklist_profile_completeness: boolean;
      checklist_id_verification: boolean;
      checklist_qualifications: boolean;
    },
    rejectionReason: string,
    targetUserId: string
  ) {
    // One transaction: application, profile promotion and audit entry. The
    // applicant is taken from the application row, not from the caller.
    const { data, error } = await nexus.database.rpc('admin_review_mentor', {
      p_application_id: applicationId,
      p_status: status,
      p_checklist: checklist,
      p_reason: rejectionReason || ''
    });

    if (error) throw error;
    const result = data as { application: MentorApplication; role: string; metadata: Record<string, any> };
    const applicantId = result.application?.user_id || targetUserId;

    try {
      await nexus.realtime.publish(`user:${applicantId}`, 'profile_updated', {
        role: status === 'approved' ? 'mentor' : 'mentee',
        metadata: result.metadata
      });
    } catch (realtimeErr) {
      console.error('[Realtime Publish Mentor Review Error]:', realtimeErr);
    }

    publishAdminEvent('mentor_reviewed', { applicationId, targetUserId: applicantId, status });

    return result.application;
  },

  /**
   * Fetch all author applications with joined metadata
   */
  async getAuthorApplications(): Promise<any[]> {
    const { data: apps, error } = await nexus.database
      .from('author_applications')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error || !apps) return [];

    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name, avatar_url, email');

    return apps.map((a: any) => {
      const profile = profiles?.find(p => p.id === a.user_id);
      return {
        ...a,
        applicant_name: a.pen_name || profile?.full_name || 'Author Applicant',
        applicant_avatar: profile?.avatar_url || '',
        applicant_email: profile?.email || a.user_email || 'Unknown Email'
      };
    });
  },

  /**
   * User Manager: Approve or reject author application
   */
  async reviewAuthor(
    applicationId: string,
    reviewedBy: string,
    status: 'approved' | 'rejected' | 'needs_info',
    rejectionReason: string,
    targetUserId: string
  ) {
    // One transaction: application, profile flags and audit entry.
    const { data, error } = await nexus.database.rpc('admin_review_author', {
      p_application_id: applicationId,
      p_status: status,
      p_reason: rejectionReason || ''
    });

    if (error) throw error;
    const result = data as { status: string; user_id: string; role: string; metadata: Record<string, any> };
    const applicantId = result.user_id || targetUserId;

    try {
      await nexus.realtime.publish(`user:${applicantId}`, 'profile_updated', {
        role: result.role || 'mentee',
        metadata: result.metadata
      });
    } catch (realtimeErr) {
      console.error('[Realtime Publish Author Review Error]:', realtimeErr);
    }

    publishAdminEvent('author_reviewed', { applicationId, targetUserId: applicantId, status: result.status });

    return result;
  },

  /**
   * User Manager: Suspend or unsuspend user accounts
   */
  async setUserSuspension(userId: string, suspend: boolean, adminId: string, reason: string) {
    const { data: profile } = await nexus.database.from('profiles').select('metadata').eq('id', userId).single();
    const currentMetadata = profile?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      suspended: suspend,
      suspension_reason: suspend ? reason : null,
      suspended_at: suspend ? new Date().toISOString() : null,
      suspended_by: suspend ? adminId : null
    };

    const { data, error } = await nexus.database
      .from('profiles')
      .update({ metadata: updatedMetadata })
      .eq('id', userId)
      .select()
      .single();

    if (!error) {
      await this.logAdminAction(
        adminId,
        suspend ? 'suspend' : 'unsuspend',
        'user',
        userId,
        { suspended: currentMetadata.suspended || false },
        { suspended: suspend, reason },
        suspend ? `Suspended account. Reason: ${reason}` : `Unsuspended account. Reason: ${reason}`
      );

      try {
        await nexus.realtime.publish(`user:${userId}`, 'profile_updated', {
          role: data.role,
          metadata: updatedMetadata
        });
      } catch (realtimeErr) {
        console.error('[Realtime Publish Suspension Error]:', realtimeErr);
      }

      publishAdminEvent('user_suspension_changed', { userId, suspended: suspend });
    }

    return { data, error };
  },

  /**
   * Fetch all flagged content
   */
  async getFlaggedContent(): Promise<FlaggedContent[]> {
    const { data: flags, error } = await nexus.database
      .from('flagged_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !flags) return [];

    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name');
    
    // We mock the content titles since they can stretch across books, courses, etc.
    const { data: courses } = await nexus.database.from('courses').select('id, title');
    const { data: books } = await nexus.database.from('books').select('id, title');

    return flags.map((f: any) => {
      const reporter = profiles?.find(p => p.id === f.reporter_id);
      let targetTitle = 'Discussion Item / Post';
      if (f.target_type === 'course') {
        targetTitle = courses?.find(c => c.id === f.target_id)?.title || 'Flagged Course';
      } else if (f.target_type === 'book') {
        targetTitle = books?.find(b => b.id === f.target_id)?.title || 'Flagged Book';
      }
      return {
        ...f,
        reporter_name: reporter?.full_name || 'Anonymous User',
        target_title: targetTitle
      };
    });
  },

  /**
   * Support Agent / Compliance Officer: Resolve flagged item
   */
  async resolveFlaggedContent(
    flaggedId: string,
    resolvedBy: string,
    status: 'resolved' | 'dismissed',
    notes: string,
    takeAction: boolean,
    targetType: string,
    targetId: string
  ) {
    // One transaction: the report, the action taken on the reported content,
    // and the audit entry. It also refuses to re-resolve an already decided
    // report, and now actually hides flagged posts and comments — the previous
    // version handled only courses and books, so "take action" on a reported
    // post silently did nothing while telling the moderator it had.
    const { data, error } = await nexus.database.rpc('admin_resolve_flag', {
      p_flag_id: flaggedId,
      p_status: status,
      p_notes: notes,
      p_take_action: takeAction
    });

    if (error) throw error;

    publishAdminEvent('flag_resolved', { flaggedId, status, takeAction });

    return data;
  },

  /**
   * Fetch payout requests
   */
  async getPayoutRequests(): Promise<PayoutRequest[]> {
    const { data: payouts, error } = await nexus.database
      .from('payout_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !payouts) return [];

    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name');

    return payouts.map((p: any) => {
      const profile = profiles?.find(pr => pr.id === p.user_id);
      return {
        ...p,
        vendor_name: profile?.full_name || 'Vendor'
      };
    });
  },

  /**
   * Finance Admin: Approve/Reject payout requests
   */
  async reviewPayout(payoutId: string, reviewedBy: string, status: 'approved' | 'rejected', reason: string) {
    // One transaction: the decision, the ledger entry and the balance deduction
    // happen together, under a row lock, and only while the request is still
    // pending — so a double click or a retry cannot deduct twice, and a payout
    // larger than the wallet balance is refused.
    const { data, error } = await nexus.database.rpc('admin_review_payout', {
      p_payout_id: payoutId,
      p_status: status,
      p_reason: reason
    });

    if (error) throw error;
    const currentPayout = data as PayoutRequest;

    publishAdminEvent('payout_reviewed', { payoutId, status });
    await notifyUser(currentPayout?.user_id, {
      event: 'payout_reviewed',
      payoutId,
      status,
      amount: currentPayout?.amount,
      reason
    });

    return data;
  },

  /**
   * Fetch support tickets
   */
  async getSupportTickets(): Promise<SupportTicket[]> {
    const { data: tickets, error } = await nexus.database
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !tickets) return [];

    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name');

    return tickets.map((t: any) => {
      const user = profiles?.find(p => p.id === t.user_id);
      return {
        ...t,
        user_name: user?.full_name || 'End User'
      };
    });
  },

  /**
   * Support Agent: Triage and resolve tickets
   */
  async updateTicket(ticketId: string, agentId: string, status: SupportTicket['status'], priority?: SupportTicket['priority']) {
    const { data: currentTicket } = await nexus.database
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    const updates: any = {
      status,
      assigned_to: agentId,
      updated_at: new Date().toISOString()
    };
    if (priority) {
      updates.priority = priority;
    }
    if (status === 'closed') {
      updates.closed_at = new Date().toISOString();
    }

    const { data, error } = await nexus.database
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    await this.logAdminAction(
      agentId,
      status === 'closed' ? 'resolve' : (status === 'escalated' ? 'escalate' : 'triage'),
      'support_ticket',
      ticketId,
      currentTicket,
      updates,
      `Support ticket status updated to: ${status}${priority ? `, priority: ${priority}` : ''}`
    );

    publishAdminEvent('ticket_updated', { ticketId, status, priority });

    return data;
  },

  /**
   * Fetch compliance requests
   */
  async getComplianceRequests(): Promise<ComplianceRequest[]> {
    const { data: reqs, error } = await nexus.database
      .from('compliance_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !reqs) return [];

    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name');

    return reqs.map((r: any) => {
      const user = r.user_id ? profiles?.find(p => p.id === r.user_id) : null;
      return {
        ...r,
        user_name: user?.full_name || 'Guest Claimant'
      };
    });
  },

  /**
   * Compliance Officer: Resolve copyright, GDPR, or terms request
   */
  async resolveCompliance(requestId: string, resolvedBy: string, status: ComplianceRequest['status'], notes: string) {
    const { data: currentReq } = await nexus.database
      .from('compliance_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    const { data, error } = await nexus.database
      .from('compliance_requests')
      .update({
        status,
        resolution_notes: notes,
        reviewed_by: resolvedBy,
        resolved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    await this.logAdminAction(
      resolvedBy,
      'resolve',
      'compliance_request',
      requestId,
      currentReq,
      { status, notes },
      `Compliance request resolved as ${status}. Resolution notes: ${notes}`
    );

    publishAdminEvent('compliance_resolved', { requestId, status });

    return data;
  },

  /**
   * Fetch audit log entries
   */
  async getAdminAuditLogs(): Promise<AdminAuditLog[]> {
    const { data, error } = await nexus.database
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return [];
    return data ?? [];
  },

  /**
   * Fetch transactions (Finance view)
   */
  async getTransactions(): Promise<any[]> {
    const { data, error } = await nexus.database
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return [];
    return data ?? [];
  },

  /**
   * Issue Refund (Finance view)
   */
  async refundTransaction(transactionId: string, walletId: string, amount: number, adminId: string, reason: string) {
    // One transaction. The wallet is resolved from the sale itself, a sale can
    // be refunded once, and never for more than it was.
    const { data, error } = await nexus.database.rpc('admin_refund_transaction', {
      p_transaction_id: transactionId,
      p_amount: Math.abs(amount),
      p_reason: reason
    });

    if (error) throw error;

    publishAdminEvent('transaction_refunded', { transactionId, amount });

    return data;
  },

  /**
   * Support Agent: Post a reply message to a support ticket
   */
  async submitTicketReply(ticketId: string, agentId: string, agentName: string, text: string) {
    const { data: currentTicket, error: fetchError } = await nexus.database
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (fetchError || !currentTicket) throw fetchError || new Error('Ticket not found');

    const currentReplies = currentTicket.replies || [];
    const newReply = {
      sender_id: agentId,
      sender_name: agentName,
      text,
      created_at: new Date().toISOString()
    };
    const updatedReplies = [...currentReplies, newReply];

    const { data, error } = await nexus.database
      .from('support_tickets')
      .update({
        replies: updatedReplies,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    await this.logAdminAction(
      agentId,
      'edit',
      'support_ticket',
      ticketId,
      { replies: currentReplies },
      { replies: updatedReplies },
      `Posted reply to support ticket: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`
    );

    publishAdminEvent('ticket_reply', { ticketId });

    return data;
  },

  /**
   * Compliance Officer: Compile all platform records for GDPR export
   */
  async compileGdprData(userId: string) {
    const [
      profileRes,
      enrollmentsRes,
      sentMessagesRes,
      receivedMessagesRes,
      walletRes,
      supportTicketsRes,
      mentorApplicationsRes,
      authorApplicationsRes
    ] = await Promise.all([
      nexus.database.from('profiles').select('*').eq('id', userId).maybeSingle(),
      nexus.database.from('enrollments').select('*').eq('student_id', userId),
      nexus.database.from('messages').select('*').eq('sender_id', userId),
      nexus.database.from('messages').select('*').eq('receiver_id', userId),
      nexus.database.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
      nexus.database.from('support_tickets').select('*').eq('user_id', userId),
      nexus.database.from('mentor_applications').select('*').eq('user_id', userId),
      nexus.database.from('author_applications').select('*').eq('user_id', userId)
    ]);

    let transactionsData: any[] = [];
    if (walletRes.data?.id) {
      const txs = await nexus.database.from('transactions').select('*').eq('wallet_id', walletRes.data.id);
      transactionsData = txs.data || [];
    }

    return {
      compiled_at: new Date().toISOString(),
      user_id: userId,
      profile: profileRes.data || null,
      wallet: walletRes.data || null,
      transactions: transactionsData,
      enrollments: enrollmentsRes.data || [],
      sent_messages: sentMessagesRes.data || [],
      received_messages: receivedMessagesRes.data || [],
      support_tickets: supportTicketsRes.data || [],
      mentor_applications: mentorApplicationsRes.data || [],
      author_applications: authorApplicationsRes.data || []
    };
  },

  /**
   * Fetch video annotations for a lesson review
   */
  async getVideoAnnotations(lessonId: string, courseReviewId: string): Promise<VideoAnnotation[]> {
    const { data, error } = await nexus.database
      .from('video_annotations')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('course_review_id', courseReviewId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  },

  /**
   * Save a video annotation
   */
  async saveVideoAnnotation(lessonId: string, courseReviewId: string, timestamp: string, type: 'Correction Required' | 'Suggestion', note: string) {
    const { data, error } = await nexus.database
      .from('video_annotations')
      .insert({
        lesson_id: lessonId,
        course_review_id: courseReviewId,
        timestamp,
        type,
        note
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Delete a video annotation
   */
  async deleteVideoAnnotation(annotationId: string) {
    const { error } = await nexus.database
      .from('video_annotations')
      .delete()
      .eq('id', annotationId);
    if (error) throw error;
    return true;
  },

  /**
   * Retrieve Creator Profile details (earnings, courses, ratings, etc.)
   */
  async getCreatorProfile(creatorId: string): Promise<CreatorProfile> {
    const [profileRes, coursesRes, booksRes, payoutsRes, walletRes] = await Promise.all([
      nexus.database.from('profiles').select('*').eq('id', creatorId).single(),
      nexus.database.from('courses').select('*').eq('tutor_id', creatorId),
      nexus.database.from('books').select('*').eq('author_id', creatorId),
      nexus.database.from('payout_requests').select('*').eq('user_id', creatorId).order('created_at', { ascending: false }),
      nexus.database.from('wallets').select('*').eq('user_id', creatorId).maybeSingle()
    ]);

    if (profileRes.error) throw profileRes.error;

    const profile = profileRes.data;
    const courses = coursesRes.data || [];
    const books = booksRes.data || [];
    const payouts = payoutsRes.data || [];
    const wallet = walletRes.data;

    let transactions: any[] = [];
    if (wallet?.id) {
      const txs = await nexus.database.from('transactions').select('*').eq('wallet_id', wallet.id);
      transactions = txs.data || [];
    }

    const sales = transactions.filter(t => t.type === 'sale' && t.amount > 0);
    const totalSales = sales.reduce((sum, t) => sum + Number(t.amount), 0);
    const platformCommission = totalSales * 0.30;
    const netVendorShare = totalSales * 0.70;

    return {
      id: creatorId,
      full_name: profile.full_name,
      email: profile.email,
      bio: profile.bio || profile.metadata?.bio || 'No bio provided.',
      expertise: profile.expertise || profile.metadata?.expertise || 'Expert in Teaching',
      qualifications: profile.qualifications || profile.metadata?.qualifications || 'Verified Professional Degree',
      id_verification_status: profile.metadata?.id_verified ? 'verified' : (profile.metadata?.id_pending ? 'pending' : 'unverified'),
      courses: courses.map((c: any) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        price_standard: c.price_standard || 0,
        price_elite: c.price_elite || 0,
        created_at: c.created_at
      })),
      books: books.map((b: any) => ({
        id: b.id,
        title: b.title,
        cover_url: b.cover_url,
        retail_price: Number(b.retail_price) || 0,
        created_at: b.created_at || new Date().toISOString()
      })),
      earnings: {
        total_sales: totalSales,
        platform_commission: platformCommission,
        net_vendor_share: netVendorShare,
        payout_history: payouts.map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          created_at: p.created_at
        }))
      },
      rating: profile.rating || 4.8,
      reviews_count: profile.reviews_count || 12
    };
  },

  /**
   * Send direct message to a user/creator
   */
  async sendCreatorMessage(senderId: string, receiverId: string, content: string) {
    const { data, error } = await nexus.database
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Get direct message logs between admin and creator
   */
  async getCreatorMessages(senderId: string, receiverId: string) {
    const { data, error } = await nexus.database
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  },

  /**
   * Get an admin user record by user ID and role
   */
  async getAdminUser(userId: string, role: string) {
    const { data, error } = await nexus.database
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .eq('role', role)
      .maybeSingle();
    return { data, error };
  },

  /**
   * Get admin users by user_id
   */
  async getAdminUsersByUserId(userId: string) {
    const { data, error } = await nexus.database
      .from('admin_users')
      .select('*')
      .eq('user_id', userId);
    return { data, error };
  },

  /**
   * Apply for admin access (pending super-admin approval).
   *
   * Always for the signed-in account: the database binds the application to
   * the caller's session, so nobody can file one on someone else's behalf.
   */
  async registerAdmin(role: string, backupCodes: string[]) {
    const { data, error } = await nexus.database.rpc('request_admin_access', {
      p_role: role,
      p_backup_codes: backupCodes
    });
    return { data, error };
  },

  /**
   * Get registrations pending approval
   */
  async getPendingRegistrations() {
    const { data, error } = await nexus.database
      .from('admin_users')
      .select('*, profiles(full_name, email)')
      .eq('status', 'pending');
    
    if (error || !data) return [];
    return data.map((item: any) => ({
      ...item,
      full_name: item.profiles?.full_name || 'Admin Applicant',
      email: item.profiles?.email || item.twofa_email
    }));
  },

  /**
   * Approve a pending admin registration
   */
  async approveRegistration(id: string, executorId: string) {
    const { data: adminUser } = await nexus.database
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    // 'active' is the only status the console and the database treat as a
    // working admin. Writing 'approved' here locked every approved admin out.
    const { data, error } = await nexus.database
      .from('admin_users')
      .update({ status: 'active' })
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      // Create initial onboarding step
      await nexus.database
        .from('admin_onboarding_progress')
        .insert([{
          admin_user_id: id,
          step: 'welcome',
          completed: false
        }]);

      // Resolve executor admin_users ID
      const { data: execAdmin } = await nexus.database
        .from('admin_users')
        .select('id')
        .eq('user_id', executorId)
        .eq('role', 'super_admin')
        .maybeSingle();

      const execId = execAdmin?.id || null;

      await this.logAdminAuditLog(
        execId,
        'approve',
        'user',
        data.user_id,
        adminUser,
        data,
        `Approved admin registration for role: ${data.role}`
      );

      // Send approval notification email
      try {
        await nexus.emails.send({
          to: data.twofa_email,
          subject: 'Your Trileza Admin Registration Approved',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #10b981; margin-bottom: 24px;">Admin Application Approved</h2>
              <p>Hello,</p>
              <p>Congratulations! Your application to join the Trileza Admin Team as a <strong>${data.role.replace('_', ' ').toUpperCase()}</strong> has been approved.</p>
              <p>You can now log in to the admin gate at:</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="https://admin.yourlms.com/gate/login" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Access Admin Gate</a>
              </div>
              <p>Please note that 2FA is mandatory for all administrative access. Use your registered email address to receive verification codes.</p>
              <p style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b;">
                - Trileza Admin Team
              </p>
            </div>
          `
        });
      } catch (err) {
        console.warn('[Approval Email Error - Fallback]:', err);
      }
    }
    return { data, error };
  },

  /**
   * Reject a pending admin registration
   */
  async rejectRegistration(id: string, executorId: string) {
    const { data: adminUser } = await nexus.database
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await nexus.database
      .from('admin_users')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      // Resolve executor admin_users ID
      const { data: execAdmin } = await nexus.database
        .from('admin_users')
        .select('id')
        .eq('user_id', executorId)
        .eq('role', 'super_admin')
        .maybeSingle();

      const execId = execAdmin?.id || null;

      await this.logAdminAuditLog(
        execId,
        'reject',
        'user',
        data.user_id,
        adminUser,
        data,
        `Rejected admin registration for role: ${data.role}`
      );
    }
    return { data, error };
  },

  /**
   * Generate and send 2FA verification code
   */
  async generate2FACode(adminUserId: string, email: string) {
    // 1. Enforce hourly rate limit: max 3 codes per hour per admin (Bypassed for now)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await nexus.database
      .from('admin_2fa_codes')
      .select('*', { count: 'exact', head: true })
      .eq('admin_user_id', adminUserId)
      .gte('created_at', oneHourAgo);

    if (countError) return { error: countError.message };
    // Bypassed: no limit
    // if (count && count >= 3) {
    //   return { error: 'Rate limit exceeded: Max 3 verification codes per hour.' };
    // }

    // 2. Invalidate any existing unused codes
    await nexus.database
      .from('admin_2fa_codes')
      .update({ used: true })
      .eq('admin_user_id', adminUserId)
      .eq('used', false);

    // 3. Generate 6-digit code
    const code = generateNumericCode(6);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    const { data, error } = await nexus.database
      .from('admin_2fa_codes')
      .insert([{
        admin_user_id: adminUserId,
        code,
        expires_at: expiresAt
      }])
      .select()
      .single();

    if (error) return { error: error.message };

    // 4. Send email
    try {
      await nexus.emails.send({
        to: email,
        subject: 'Your Trileza Admin Verification Code',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-bottom: 24px; text-align: center;">Your Trileza Admin Verification Code</h2>
            <p>Hello,</p>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; padding: 16px; background-color: #f1f5f9; color: #10b981; text-align: center; border-radius: 8px; margin: 20px 0;">
              ${code}
            </div>
            <p>This code expires in 5 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
            <p style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b;">
              - Trileza Admin Team
            </p>
          </div>
        `
      });
      console.log(`[2FA Email Sent]: Code is ${code}`);
      return { success: true, code };
    } catch (err) {
      console.warn('[2FA Email Error - Falling back to console logging]:', err);
      console.log(`\n==========================================\n[2FA EMAIL FALLBACK]\nTo: ${email}\nCode: ${code}\n==========================================\n`);
      alert(`[DEV MODE FALLBACK]\nEmail delivery failed (SMTP not configured on backend).\n\nYour Admin Verification Code is:\n\n${code}\n\n(Use this code to proceed)`);
      return { success: true, simulated: true, code };
    }
  },

  /**
   * Verify 2FA code
   */
  async verify2FACode(adminUserId: string, inputCode: string, ipAddress: string = '127.0.0.1') {
    // Check lockout state
    const { data: admin, error: adminErr } = await nexus.database
      .from('admin_users')
      .select('*')
      .eq('id', adminUserId)
      .single();

    if (adminErr || !admin) return { error: 'Admin user not found' };

    if (admin.lockout_until && new Date(admin.lockout_until) > new Date()) {
      const remainingTime = Math.ceil((new Date(admin.lockout_until).getTime() - Date.now()) / 1000 / 60);
      return { error: `Account locked. Please try again in ${remainingTime} minutes.` };
    }

    // Check if 2FA is bypassed
    if (admin.twofa_bypassed || !admin.twofa_enabled) {
      await nexus.database
        .from('admin_users')
        .update({ failed_attempts: 0, last_login: new Date().toISOString() })
        .eq('id', adminUserId);
      return { success: true, bypassed: true };
    }

    // Check if backup code matches
    const backupCodes = Array.isArray(admin.backup_codes) ? admin.backup_codes : [];
    if (backupCodes.includes(inputCode)) {
      // Remove used backup code
      const remainingBackup = backupCodes.filter((c: string) => c !== inputCode);
      await nexus.database
        .from('admin_users')
        .update({
          backup_codes: remainingBackup,
          failed_attempts: 0,
          last_login: new Date().toISOString()
        })
        .eq('id', adminUserId);

      await this.logAdminAuditLog(
        adminUserId,
        'login',
        'user',
        admin.user_id,
        null,
        null,
        `Successful login via Backup Code`,
        ipAddress
      );
      return { success: true, usedBackup: true };
    }

    // Find active unexpired code
    const { data: activeCodes, error: codesErr } = await nexus.database
      .from('admin_2fa_codes')
      .select('*')
      .eq('admin_user_id', adminUserId)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (codesErr) return { error: codesErr.message };

    const validCodeRecord = activeCodes?.find(r => r.code === inputCode);

    if (!validCodeRecord) {
      // Increment failed attempts
      const newAttempts = (admin.failed_attempts || 0) + 1;
      const updates: any = { failed_attempts: newAttempts };
      
      if (newAttempts >= 5) {
        updates.lockout_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      await nexus.database
        .from('admin_users')
        .update(updates)
        .eq('id', adminUserId);

      // Log failure in audit log
      await this.logAdminAuditLog(
        adminUserId,
        'login',
        'user',
        admin.user_id,
        null,
        null,
        `Failed 2FA attempt (${newAttempts}/5)`,
        ipAddress
      );

      if (newAttempts >= 5) {
        return { error: 'Too many failed attempts. Account locked for 15 minutes.' };
      }
      return { error: `Invalid code. ${5 - newAttempts} attempts remaining.` };
    }

    // Success: mark code as used and reset attempts
    await nexus.database
      .from('admin_2fa_codes')
      .update({ used: true })
      .eq('id', validCodeRecord.id);

    await nexus.database
      .from('admin_users')
      .update({
        failed_attempts: 0,
        last_login: new Date().toISOString()
      })
      .eq('id', adminUserId);

    await this.logAdminAuditLog(
      adminUserId,
      'login',
      'user',
      admin.user_id,
      null,
      null,
      `Successful 2FA login`,
      ipAddress
    );

    return { success: true };
  },

  /**
   * Write one entry to the audit trail (admin_audit_logs — the single table
   * every console reads). The acting admin is stamped by the database from the
   * session; `adminUserId` only matters for server-side callers with no session.
   * Never throws: a failed audit write must not undo the action it describes.
   */
  async logAdminAuditLog(
    adminUserId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    previousState: any,
    newState: any,
    reason: string = '',
    ipAddress: string = '127.0.0.1'
  ) {
    try {
      const { data, error } = await nexus.database
        .from('admin_audit_logs')
        .insert([{
          admin_user_id: adminUserId,
          action_type: action,
          target_type: targetType,
          target_id: targetId,
          previous_state: previousState,
          new_state: newState,
          reason,
          ip_address: ipAddress
        }]);
      if (error) console.error('[Audit Log Error]:', error);
      return { data, error };
    } catch (err) {
      console.error('[Audit Log Exception]:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Admin session management
   */
  async createAdminSession(adminUserId: string, token: string, expiresAt: string, ip: string, userAgent: string) {
    return await nexus.database
      .from('admin_sessions')
      .insert([{
        admin_user_id: adminUserId,
        token,
        expires_at: expiresAt,
        ip_address: ip,
        user_agent: userAgent
      }]);
  },

  async validateAdminSession(token: string) {
    const { data, error } = await nexus.database
      .from('admin_sessions')
      .select('*, admin_users(*)')
      .eq('token', token)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();
    return { data, error };
  },

  async invalidateAdminSession(token: string) {
    return await nexus.database
      .from('admin_sessions')
      .delete()
      .eq('token', token);
  },

  /**
   * Onboarding flows
   */
  async getOnboardingProgress(adminUserId: string) {
    const { data, error } = await nexus.database
      .from('admin_onboarding_progress')
      .select('*')
      .eq('admin_user_id', adminUserId);
    return { data, error };
  },

  async updateOnboardingStep(adminUserId: string, step: string) {
    // Update step in progress
    await nexus.database
      .from('admin_onboarding_progress')
      .upsert({
        admin_user_id: adminUserId,
        step,
        completed: true,
        completed_at: new Date().toISOString()
      }, { onConflict: 'admin_user_id,step' } as any);

    // Update current step in admin_users
    return await nexus.database
      .from('admin_users')
      .update({ onboarding_step: step })
      .eq('id', adminUserId);
  },

  async completeOnboarding(adminUserId: string) {
    return await nexus.database
      .from('admin_users')
      .update({
        onboarding_completed: true,
        onboarding_step: 'completed'
      })
      .eq('id', adminUserId);
  },

  /**
   * Super Admin 2FA bypass management
   */
  async toggle2FABypass(adminUserId: string, bypass: boolean, executorAdminUserId: string) {
    const { data: current } = await nexus.database
      .from('admin_users')
      .select('twofa_bypassed')
      .eq('id', adminUserId)
      .single();

    const { data, error } = await nexus.database
      .from('admin_users')
      .update({ twofa_bypassed: bypass })
      .eq('id', adminUserId)
      .select()
      .single();

    if (!error && data) {
      await this.logAdminAuditLog(
        executorAdminUserId,
        'bypass_2fa',
        'user',
        data.user_id,
        current,
        { twofa_bypassed: bypass },
        `Temporarily set 2FA bypass for admin ID: ${adminUserId} to ${bypass}`
      );
    }
    return { data, error };
  },

  /**
   * Delete a user profile and all associated data
   */
  async deleteUser(profileId: string, adminId: string, reason = '') {
    // One transaction. The previous version issued five independent deletes,
    // so a failure part-way left the account gone but its enrollments,
    // applications and admin record behind — and it deleted enrollments by
    // `student_id`, a column that table does not have, so those always stayed.
    const { data, error } = await nexus.database.rpc('admin_delete_user', {
      p_user_id: profileId,
      p_reason: reason
    });

    if (error) throw error;

    publishAdminEvent('user_deleted', { userId: profileId });
    return { success: true, ...(data as object) };
  },

  /**
   * Delete a course or book and its associated reviews
   */
  async deleteContent(contentId: string, type: 'course' | 'book', adminId: string, reason = '') {
    // One transaction: content, its reviews, its enrollments and the audit
    // entry. Enrollments are matched on both item_id and course_id, since the
    // checkout path and the payment webhook write different columns.
    const { data, error } = await nexus.database.rpc('admin_delete_content', {
      p_content_id: contentId,
      p_type: type,
      p_reason: reason
    });

    if (error) throw error;

    publishAdminEvent('content_deleted', { contentId, type });
    return { success: true, ...(data as object) };
  },

  async getStorageFileUrl(filePath: string): Promise<string> {
    try {
      return nexus.storage.from('uploads').getPublicUrl(filePath);
    } catch (err) {
      console.error('[adminService] Error getting storage file URL:', err);
      return '';
    }
  }
};

