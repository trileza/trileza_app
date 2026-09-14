export type UserRole = 'student' | 'tutor' | 'staff' | 'management' | 'mentee' | 'mentor' | 'tenant_admin' | 'super_admin' | 'support_staff' | 'guardian';

export type TenantPlan = 'starter' | 'growth' | 'enterprise';

export interface TenantSettings {
  allow_self_registration?: boolean;
  default_user_role?: UserRole;
  course_hierarchy?: string[]; // e.g. ['Module', 'Topic', 'Subtopic']
  pricing_mode?: 'custom' | 'platform_default';
  custom_categories?: string[];
  max_users?: number;
  max_courses?: number;
  support_email?: string;
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  custom_domain?: string;
  email: string;
  status: 'active' | 'suspended' | 'pending';
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  plan: TenantPlan;
  settings?: TenantSettings;
  created_at: string;
  updated_at?: string;
}

export interface TenantAnalytics {
  tenant_id: string;
  total_users: number;
  total_students: number;
  total_tutors: number;
  total_courses: number;
  total_enrollments: number;
  total_revenue: number;
  completion_rate: number;
  active_learners_30d: number;
}

export interface TenantBilling {
  tenant_id: string;
  plan: TenantPlan;
  monthly_subscription_fee: number;
  per_user_fee: number;
  total_active_users: number;
  current_billing_cycle_amount: number;
  next_billing_date: string;
  status: 'paid' | 'pending' | 'overdue';
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  tenant_id?: string;
  avatar_url?: string;
  created_at: string;
  bio?: string;
  social_links?: {
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  trailer_url?: string; // 30-second trailer
  tutor_id: string;
  tenant_id?: string;
  institution_name?: string;
  institution_logo?: string;
  price_tiers: {
    standard: number;
    elite: number; // Includes mentorship/certification
  };
  category: string;
  rating: number;
  enrolled_count: number;
  learning_objectives: string[]; // SMART goals
  syllabus_url?: string; // Course Compass PDF
  content: CourseModule[];
  branding?: {
    logo_url?: string;
    digital_signature_url?: string; // For automated certificates
  };
  social_triggers?: {
    discussion_prompts: string[];
    staff_ids: string[]; // Course Ambassadors
  };
  live_schedule?: {
    office_hours: string; // Recurring schedule
    mentorship_calendar_link: string; // Google/Outlook integration
  };
}

export interface CourseModule {
  id: string;
  title: string;
  objective: string; // SMART goal for the module
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'pdf' | 'quiz' | 'practical';
  content_url: string;
  duration?: number;
  resource_urls?: string[]; // Resource Packs (ZIP, PDF)
  hot_spots?: HotSpot[];
}

export interface HotSpot {
  id: string;
  timestamp: number; // Seconds into video
  type: 'link' | 'note' | 'resource' | 'quiz_trigger';
  label: string;
  action_data: string; // URL, text, or Quiz ID
}

export interface Wallet {
  id: string;
  user_id: string;
  paystack_subaccount_code?: string;
  bank_details?: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
  lifetime_earnings: number;
  pending_settlement: number;
  available_balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  tenant_id?: string;
  amount: number;
  type: 'sale' | 'payout' | 'commission';
  status: 'pending' | 'completed' | 'failed';
  description: string;
  created_at: string;
  metadata?: {
    course_id?: string;
    student_id?: string;
    platform_commission?: number;
    split_ratio?: string; // e.g., "80:20"
  };
}

export interface Assessment {
  id: string;
  course_id: string;
  title: string;
  type: 'quiz' | 'viva' | 'practical';
  time_limit?: number;
  branching_rules?: {
    fail_threshold: number;
    revisit_module_id: string;
  };
  question_bank_id?: string;
  viva_rubric?: string[]; // Keywords for AI verbal check
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  feedback: string;
  remedial_video_url?: string;
}

