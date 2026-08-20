export type AdminRole =
  | 'super_admin'
  | 'content_manager'
  | 'user_manager'
  | 'finance_admin'
  | 'support_agent'
  | 'compliance_officer'
  | 'analytics_viewer';

export interface AdminUser {
  id: string;
  user_id: string;
  roles: AdminRole[];
  onboarded: boolean;
  suspended: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminInvite {
  id: string;
  email: string;
  roles: AdminRole[];
  invited_by?: string;
  token: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  accepted_at?: string;
}

export interface AdminAuditLog {
  id: string;
  created_at: string;
  admin_id: string;
  action_type: 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'delete' | 'edit' | 'triage' | 'refund' | 'escalate' | 'resolve';
  target_type: 'course' | 'book' | 'user' | 'payout' | 'flagged_content' | 'support_ticket' | 'compliance_request';
  target_id: string;
  previous_state?: any;
  new_state?: any;
  reason: string;
}

export interface CourseReview {
  id: string;
  course_id: string;
  submitted_by: string;
  content_manager_id?: string;
  status: 'pending' | 'pending_deletion' | 'approved' | 'needs_changes' | 'rejected';
  checklist_title: boolean;
  checklist_description: boolean;
  checklist_curriculum: boolean; // >=5 lessons
  checklist_video: boolean;      // >=720p
  checklist_audio: boolean;      // clear
  checklist_thumbnail: boolean;  // professional
  checklist_no_copyright: boolean;
  notes?: string;
  submitted_at: string;
  reviewed_at?: string;
  
  course_title?: string;
  course_thumbnail?: string;
  submitted_by_name?: string;
  category?: string;
  description?: string;
  price_standard?: number;
  price_elite?: number;
}

export interface BookReview {
  id: string;
  book_id: string;
  submitted_by: string;
  content_manager_id?: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  checklist_cover: boolean;
  checklist_description: boolean;
  checklist_readable: boolean;
  checklist_price: boolean;
  checklist_no_copyright: boolean;
  notes?: string;
  submitted_at: string;
  reviewed_at?: string;

  // Joined virtual properties
  book_title?: string;
  book_cover?: string;
  submitted_by_name?: string;
  category?: string;
  retail_price?: number;
  file_url?: string;
  description?: string;
}

export interface MentorApplication {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_info';
  checklist_profile_completeness: boolean;
  checklist_id_verification: boolean;
  checklist_qualifications: boolean;
  checklist_intro_video: boolean;
  video_url?: string;
  qualifications?: string;
  rejection_reason?: string;
  reviewed_by?: string;
  submitted_at: string;
  reviewed_at?: string;

  // Joined virtual properties
  applicant_name?: string;
  applicant_avatar?: string;
}

export interface FlaggedContent {
  id: string;
  reporter_id: string;
  target_type: 'course' | 'book' | 'post' | 'comment';
  target_id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  severity: 'urgent' | 'high' | 'medium' | 'low';
  resolution_notes?: string;
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;

  // Joined virtual properties
  reporter_name?: string;
  target_title?: string;
}

export interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  bank_details: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
  reviewed_by?: string;
  reason?: string;
  created_at: string;
  reviewed_at?: string;

  // Joined virtual properties
  vendor_name?: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'escalated' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  replies?: Array<{
    sender_id: string;
    sender_name: string;
    text: string;
    created_at: string;
  }>;

  // Joined virtual properties
  user_name?: string;
}

export interface ComplianceRequest {
  id: string;
  user_id?: string;
  type: 'copyright_claim' | 'terms_violation' | 'gdpr_request';
  details: {
    claimant?: string;
    infringement_url?: string;
    reason?: string;
    request_type?: string;
    notes?: string;
  };
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  resolution_notes?: string;
  reviewed_by?: string;
  created_at: string;
  resolved_at?: string;

  // Joined virtual properties
  user_name?: string;
}

export interface VideoAnnotation {
  id: string;
  lesson_id: string;
  course_review_id: string;
  timestamp: string;
  type: 'Correction Required' | 'Suggestion';
  note: string;
  created_at: string;
}

export interface CreatorProfile {
  id: string;
  full_name: string;
  email: string;
  bio?: string;
  expertise?: string;
  qualifications?: string;
  id_verification_status: 'verified' | 'pending' | 'unverified';
  courses: Array<{ id: string; title: string; status: string; price_standard: number; price_elite: number; created_at: string }>;
  books: Array<{ id: string; title: string; cover_url?: string; retail_price: number; created_at: string }>;
  earnings: {
    total_sales: number;
    platform_commission: number;
    net_vendor_share: number;
    payout_history: Array<{ id: string; amount: number; status: string; created_at: string }>;
  };
  rating: number;
  reviews_count: number;
}
