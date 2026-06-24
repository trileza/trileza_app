import { nexus } from '../nexus';
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

export const adminService = {
  /**
   * Log an admin action to the audit trail
   */
  async logAdminAction(
    adminId: string,
    actionType: AdminAuditLog['action_type'],
    targetType: AdminAuditLog['target_type'],
    targetId: string,
    previousState: any,
    newState: any,
    reason: string
  ) {
    try {
      const { data, error } = await nexus.database
        .from('admin_audit_logs')
        .insert({
          admin_id: adminId,
          action_type: actionType,
          target_type: targetType,
          target_id: targetId,
          previous_state: previousState,
          new_state: newState,
          reason: reason
        });
      if (error) console.error('[Audit Log Error]:', error);
      return { data, error };
    } catch (err) {
      console.error('[Audit Log Exception]:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Get the admin role of a user
   */
  async getAdminUserRole(userId: string): Promise<AdminRole | null> {
    const { data, error } = await nexus.database
      .from('admin_users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data.role as AdminRole;
  },

  /**
   * Assign or update admin role for a user (Super Admin only)
   */
  async setAdminUserRole(userId: string, role: AdminRole, executorId: string) {
    const { data: current } = await nexus.database
      .from('admin_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const { data, error } = await nexus.database
      .from('admin_users')
      .upsert({ id: userId, role });

    if (!error) {
      await this.logAdminAction(
        executorId,
        'edit',
        'user',
        userId,
        current || null,
        { role },
        `Assigned admin role: ${role}`
      );
    }
    return { data, error };
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
    const { data: courses } = await nexus.database.from('courses').select('id, title, thumbnail_url');
    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name');

    return reviews.map((r: any) => {
      const course = courses?.find(c => c.id === r.course_id);
      const profile = profiles?.find(p => p.id === r.submitted_by);
      return {
        ...r,
        course_title: course?.title || 'Unknown Course',
        course_thumbnail: course?.thumbnail_url || '',
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
    const { data: currentReview } = await nexus.database
      .from('course_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    const { data, error } = await nexus.database
      .from('course_reviews')
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

    // Update main courses table status
    const courseStatus = status === 'approved' ? 'published' : 'draft';
    await nexus.database
      .from('courses')
      .update({ status: courseStatus })
      .eq('id', courseId);

    await this.logAdminAction(
      contentManagerId,
      status === 'approved' ? 'approve' : 'reject',
      'course',
      courseId,
      currentReview,
      { status, checklist, notes },
      `Course review processed. Status: ${status}. Notes: ${notes}`
    );

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

    const { data: books } = await nexus.database.from('books').select('id, title, cover_url');
    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name');

    return reviews.map((r: any) => {
      const book = books?.find(b => b.id === r.book_id);
      const profile = profiles?.find(p => p.id === r.submitted_by);
      return {
        ...r,
        book_title: book?.title || 'Unknown Book',
        book_cover: book?.cover_url || '',
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

    const { data: profiles } = await nexus.database.from('profiles').select('id, full_name, avatar_url');

    return apps.map((a: any) => {
      const profile = profiles?.find(p => p.id === a.user_id);
      return {
        ...a,
        applicant_name: profile?.full_name || 'Mentor Applicant',
        applicant_avatar: profile?.avatar_url || ''
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
      checklist_intro_video: boolean;
    },
    rejectionReason: string,
    targetUserId: string
  ) {
    const { data: currentApp } = await nexus.database
      .from('mentor_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    const { data, error } = await nexus.database
      .from('mentor_applications')
      .update({
        reviewed_by: reviewedBy,
        status,
        ...checklist,
        rejection_reason: rejectionReason || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    // If approved, elevate user profile metadata
    if (status === 'approved') {
      const { data: profile } = await nexus.database.from('profiles').select('metadata').eq('id', targetUserId).single();
      const currentMetadata = profile?.metadata || {};
      const { mentor_application_status, pending_mentor_data, ...rest } = currentMetadata;
      const updatedMetadata = {
        ...rest,
        mentor_onboarded: true,
        active_role: 'mentor',
        mentor_onboarded_at: new Date().toISOString(),
        mentor_data: pending_mentor_data || {
          identity: { verified: true },
          onboardedAt: new Date().toISOString()
        }
      };

      await nexus.database
        .from('profiles')
        .update({
          role: 'mentor',
          metadata: updatedMetadata
        })
        .eq('id', targetUserId);
    } else if (status === 'rejected') {
      const { data: profile } = await nexus.database.from('profiles').select('metadata').eq('id', targetUserId).single();
      if (profile) {
        const currentMetadata = profile.metadata || {};
        const { mentor_application_status, pending_mentor_data, ...cleanedMetadata } = currentMetadata;
        
        await nexus.database
          .from('profiles')
          .update({
            metadata: cleanedMetadata
          })
          .eq('id', targetUserId);
      }
    } else if (status === 'needs_info') {
      const { data: profile } = await nexus.database.from('profiles').select('metadata').eq('id', targetUserId).single();
      if (profile) {
        const currentMetadata = profile.metadata || {};
        const updatedMetadata = {
          ...currentMetadata,
          mentor_application_status: 'needs_info',
          rejection_reason: rejectionReason || 'More information requested.'
        };
        
        await nexus.database
          .from('profiles')
          .update({
            metadata: updatedMetadata
          })
          .eq('id', targetUserId);
      }
    }

    await this.logAdminAction(
      reviewedBy,
      status === 'approved' ? 'approve' : 'reject',
      'user',
      targetUserId,
      currentApp,
      { status, checklist, rejectionReason },
      `Mentor onboarding review processed. Status: ${status}. Reason: ${rejectionReason}`
    );

    return data;
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
    const { data: currentApp } = await nexus.database
      .from('author_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    const dbStatus = status === 'approved' ? 'approved' : (status === 'needs_info' ? 'needs_info' : 'denied');

    const { data, error } = await nexus.database
      .from('author_applications')
      .update({
        status: dbStatus,
        rejection_reason: rejectionReason || null
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    // Elevate user profile metadata in profiles table
    const { data: profile } = await nexus.database.from('profiles').select('metadata').eq('id', targetUserId).single();
    const currentMetadata = profile?.metadata || {};

    if (dbStatus === 'approved') {
      const updatedMetadata = {
        ...currentMetadata,
        is_author: true,
        author_profile: {
          name: currentApp?.pen_name || profile?.full_name || 'Author',
          category: currentApp?.category || 'General',
          approvedAt: new Date().toISOString()
        }
      };

      await nexus.database
        .from('profiles')
        .update({
          role: 'mentor',
          metadata: updatedMetadata
        })
        .eq('id', targetUserId);
    } else {
      // For rejected/denied or needs_info, clear author flags or write needs_info
      const { is_author, author_profile, ...cleanedMetadata } = currentMetadata;
      const updatedMetadata = dbStatus === 'needs_info'
        ? { ...cleanedMetadata, author_application_status: 'needs_info', rejection_reason: rejectionReason || 'More information requested.' }
        : cleanedMetadata;

      await nexus.database
        .from('profiles')
        .update({
          metadata: updatedMetadata
        })
        .eq('id', targetUserId);
    }

    await this.logAdminAction(
      reviewedBy,
      dbStatus === 'approved' ? 'approve' : 'reject',
      'user',
      targetUserId,
      currentApp,
      { status: dbStatus, rejectionReason },
      `Author application review processed. Status: ${dbStatus}. Reason: ${rejectionReason}`
    );

    return data;
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
    const { data: currentFlag } = await nexus.database
      .from('flagged_content')
      .select('*')
      .eq('id', flaggedId)
      .single();

    const { data, error } = await nexus.database
      .from('flagged_content')
      .update({
        status,
        resolution_notes: notes,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString()
      })
      .eq('id', flaggedId)
      .select()
      .single();

    if (error) throw error;

    if (takeAction) {
      if (targetType === 'course') {
        // Hide course (set to draft)
        await nexus.database.from('courses').update({ status: 'draft' }).eq('id', targetId);
      } else if (targetType === 'book') {
        // Flag/hide book (simulate hide via metadata or reviews)
        await nexus.database.from('book_reviews').update({ status: 'rejected', notes: `Flagged: ${notes}` }).eq('book_id', targetId);
      }
    }

    await this.logAdminAction(
      resolvedBy,
      'resolve',
      'flagged_content',
      flaggedId,
      currentFlag,
      { status, notes, actionTaken: takeAction },
      `Resolved flagged content. Status: ${status}. Action: ${takeAction ? 'Content Hidden' : 'Dismissed'}. Notes: ${notes}`
    );

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
    const { data: currentPayout } = await nexus.database
      .from('payout_requests')
      .select('*')
      .eq('id', payoutId)
      .single();

    const { data, error } = await nexus.database
      .from('payout_requests')
      .update({
        status,
        reviewed_by: reviewedBy,
        reason,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', payoutId)
      .select()
      .single();

    if (error) throw error;

    // Log the transaction if approved
    if (status === 'approved' && currentPayout) {
      // Find wallet for the vendor user
      const { data: wallet } = await nexus.database
        .from('wallets')
        .select('id, available_balance')
        .eq('user_id', currentPayout.user_id)
        .single();

      if (wallet) {
        // Insert a transaction log
        await nexus.database.from('transactions').insert({
          wallet_id: wallet.id,
          amount: -Number(currentPayout.amount),
          type: 'payout',
          status: 'completed',
          description: `Payout to bank account: ${reason}`
        });

        // Deduct balance from wallet
        const newBalance = Number(wallet.available_balance) - Number(currentPayout.amount);
        await nexus.database.from('wallets').update({ available_balance: newBalance }).eq('id', wallet.id);
      }
    }

    await this.logAdminAction(
      reviewedBy,
      status === 'approved' ? 'approve' : 'reject',
      'payout',
      payoutId,
      currentPayout,
      { status, reason },
      `Payout request ${status}. Reason: ${reason}`
    );

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
    // Insert a negative sale transaction to represent the refund
    const { data, error } = await nexus.database.from('transactions').insert({
      wallet_id: walletId,
      amount: -Math.abs(amount),
      type: 'sale',
      status: 'completed',
      description: `Refund issued for txn ${transactionId}: ${reason}`
    }).select().single();

    if (error) throw error;

    // Deduct/adjust wallet balance
    const { data: wallet } = await nexus.database.from('wallets').select('available_balance').eq('id', walletId).single();
    if (wallet) {
      const newBalance = Number(wallet.available_balance) - Math.abs(amount);
      await nexus.database.from('wallets').update({ available_balance: newBalance }).eq('id', walletId);
    }

    await this.logAdminAction(
      adminId,
      'refund',
      'payout',
      transactionId,
      { walletId, amount },
      { refunded: true, refundTxId: data.id },
      `Issued refund of ₦${amount}. Reason: ${reason}`
    );

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
  }
};
