import { nexus } from '../nexus';
import { publishUserEvent } from './realtimeEvents';
import type { SupportTicket, ComplianceRequest, FlaggedContent } from '../../types/admin';

/**
 * User-facing intake for the three admin queues that had none.
 *
 * The Support Agent and Compliance Officer consoles were fully built — triage,
 * priority, threaded replies, escalation, GDPR export — but nothing in the app
 * ever inserted a row for them to work on. Each queue could only be populated
 * by writing to the database by hand.
 *
 * This is the missing half: raise a ticket, reply to an agent, file a copyright
 * or GDPR request, and report content for moderation.
 */

export interface TicketReply {
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: string;
}

export const supportService = {
  // ─── Support tickets ────────────────────────────────────────────────────

  /** Tickets raised by this user, newest first. */
  async getMyTickets(userId: string): Promise<SupportTicket[]> {
    const { data, error } = await nexus.database
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Could not load your tickets: ${error.message}`);
    return (data || []) as SupportTicket[];
  },

  async createTicket(params: {
    userId: string;
    tenantId?: string;
    title: string;
    description: string;
    priority?: SupportTicket['priority'];
  }): Promise<SupportTicket> {
    const { data, error } = await nexus.database
      .from('support_tickets')
      .insert([{
        user_id: params.userId,
        tenant_id: params.tenantId || 'default-tenant',
        title: params.title.trim(),
        description: params.description.trim(),
        status: 'open',
        priority: params.priority || 'medium',
        replies: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw new Error(`Could not raise your ticket: ${error.message}`);

    // Put it in front of the support team without waiting for a poll.
    publishUserEvent('ticket_submitted', {
      ticketId: (data as any)?.id,
      userId: params.userId,
      priority: params.priority || 'medium'
    });

    return data as SupportTicket;
  },

  /**
   * Post a reply as the person who raised the ticket.
   *
   * Replies are a JSONB array on the ticket, matching what the agent console
   * writes, so both sides read the same thread. Re-opens a closed ticket,
   * since a reply to a closed ticket means it was not actually resolved.
   */
  async replyToTicket(params: {
    ticketId: string;
    senderId: string;
    senderName: string;
    text: string;
  }): Promise<SupportTicket> {
    const { data: ticket, error: fetchErr } = await nexus.database
      .from('support_tickets')
      .select('*')
      .eq('id', params.ticketId)
      .single();

    if (fetchErr || !ticket) throw new Error('That ticket could not be found.');

    const existing: TicketReply[] = (ticket as any).replies || [];
    const reply: TicketReply = {
      sender_id: params.senderId,
      sender_name: params.senderName,
      text: params.text.trim(),
      created_at: new Date().toISOString()
    };

    const { data, error } = await nexus.database
      .from('support_tickets')
      .update({
        replies: [...existing, reply],
        status: (ticket as any).status === 'closed' ? 'open' : (ticket as any).status,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.ticketId)
      .select()
      .single();

    if (error) throw new Error(`Could not send your reply: ${error.message}`);

    publishUserEvent('ticket_reply', { ticketId: params.ticketId, from: 'user' });
    return data as SupportTicket;
  },

  /** The user marking their own issue as resolved. */
  async closeMyTicket(ticketId: string, userId: string): Promise<void> {
    const { error } = await nexus.database
      .from('support_tickets')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .eq('user_id', userId);

    if (error) throw new Error(`Could not close that ticket: ${error.message}`);
    publishUserEvent('ticket_updated', { ticketId, status: 'closed' });
  },

  // ─── Compliance requests ────────────────────────────────────────────────

  async getMyComplianceRequests(userId: string): Promise<ComplianceRequest[]> {
    const { data, error } = await nexus.database
      .from('compliance_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Could not load your requests: ${error.message}`);
    return (data || []) as ComplianceRequest[];
  },

  /**
   * File a copyright claim, terms violation report, or GDPR data request.
   * `details` is free-form per type, matching what the Compliance Officer
   * console renders.
   */
  async fileComplianceRequest(params: {
    userId: string;
    tenantId?: string;
    type: ComplianceRequest['type'];
    details: ComplianceRequest['details'];
  }): Promise<ComplianceRequest> {
    const { data, error } = await nexus.database
      .from('compliance_requests')
      .insert([{
        user_id: params.userId,
        tenant_id: params.tenantId || 'default-tenant',
        type: params.type,
        details: params.details,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw new Error(`Could not file your request: ${error.message}`);

    publishUserEvent('compliance_submitted', {
      requestId: (data as any)?.id,
      type: params.type
    });

    return data as ComplianceRequest;
  },

  // ─── Content reports ────────────────────────────────────────────────────

  /**
   * Report a course, book, post or comment for moderation.
   *
   * Severity is chosen by the reporter's reason rather than left to them, so
   * the moderation queue orders sensibly without trusting user input.
   */
  async reportContent(params: {
    reporterId: string;
    tenantId?: string;
    targetType: FlaggedContent['target_type'];
    targetId: string;
    reason: string;
    category?: string;
  }): Promise<FlaggedContent> {
    const severity = inferSeverity(params.category, params.reason);

    const { data: existing } = await nexus.database
      .from('flagged_content')
      .select('id')
      .eq('reporter_id', params.reporterId)
      .eq('target_id', params.targetId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      throw new Error('You have already reported this, and it is still being reviewed.');
    }

    const { data, error } = await nexus.database
      .from('flagged_content')
      .insert([{
        reporter_id: params.reporterId,
        tenant_id: params.tenantId || 'default-tenant',
        target_type: params.targetType,
        target_id: params.targetId,
        reason: params.category ? `${params.category}: ${params.reason}` : params.reason,
        status: 'pending',
        severity,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw new Error(`Could not submit your report: ${error.message}`);

    publishUserEvent('content_flagged', {
      flagId: (data as any)?.id,
      targetType: params.targetType,
      targetId: params.targetId,
      severity
    });

    return data as FlaggedContent;
  }
};

/**
 * Map a report category to a triage severity. Safety and legal issues jump the
 * queue; taste-based complaints do not.
 */
function inferSeverity(category: string | undefined, reason: string): FlaggedContent['severity'] {
  const haystack = `${category || ''} ${reason}`.toLowerCase();

  if (/child|csam|self.?harm|suicide|violence|threat|illegal|weapon/.test(haystack)) return 'urgent';
  if (/copyright|plagiar|piracy|intellectual property|impersonat|fraud|scam/.test(haystack)) return 'high';
  if (/harass|abuse|hate|bully|explicit|nudity|adult/.test(haystack)) return 'high';
  if (/spam|misleading|inaccurate|broken|quality/.test(haystack)) return 'low';
  return 'medium';
}

/** Report categories offered in the UI, ordered as a person would scan them. */
export const REPORT_CATEGORIES = [
  'Copyright infringement',
  'Harassment or abuse',
  'Explicit or inappropriate content',
  'Spam or misleading',
  'Impersonation',
  'Inaccurate or low quality',
  'Something else'
] as const;
