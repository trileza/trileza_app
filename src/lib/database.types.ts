/**
 * Nexus Database Type Definitions
 * These types map directly to the Trileza database schema.
 * They will be auto-generated once the schema is live, but
 * we define them manually here for immediate type safety.
 */

export type UserRole = 'management' | 'staff' | 'mentee' | 'mentor' | 'tutor' | 'guardian';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          surname: string | null;
          first_name: string | null;
          middle_name: string | null;
          phone_number: string | null;
          role: UserRole;
          avatar_url: string | null;
          bio: string | null;
          social_links: Record<string, string> | null;
          expertise: Array<{ id: number; type: string; desc: string; icon: string }> | null;
          website: string | null;
          mentor_tier: string | null;
          country: string | null;
          metadata: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          avatar_url?: string | null;
          bio?: string | null;
          social_links?: Record<string, string> | null;
          expertise?: Array<{ id: number; type: string; desc: string; icon: string }> | null;
          website?: string | null;
          country?: string | null;
          metadata?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          avatar_url?: string | null;
          bio?: string | null;
          social_links?: Record<string, string> | null;
          expertise?: Array<{ id: number; type: string; desc: string; icon: string }> | null;
          website?: string | null;
          country?: string | null;
          metadata?: Record<string, any> | null;
          updated_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          tutor_id: string;
          title: string;
          description: string | null;
          thumbnail_url: string | null;
          trailer_url: string | null;
          category: string | null;
          price_standard: number;
          price_elite: number;
          rating: number;
          enrolled_count: number;
          learning_objectives: string[];
          syllabus_url: string | null;
          branding: Record<string, any> | null;
          social_triggers: Record<string, any> | null;
          live_schedule: Record<string, any> | null;
          status: 'draft' | 'published' | 'archived' | 'flagged';
          language: string | null;
          curriculum: any[] | null;
          prerequisites: string | null;
          access_period: string | null;
          certification_available: boolean | null;
          refund_policy: string | null;
          borrow_enabled: boolean | null;
          materials: any[] | null;
          duration: string | null;
          level: string | null;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          title: string;
          description?: string | null;
          thumbnail_url?: string | null;
          trailer_url?: string | null;
          category?: string | null;
          price_standard?: number;
          price_elite?: number;
          rating?: number;
          enrolled_count?: number;
          learning_objectives?: string[];
          syllabus_url?: string | null;
          branding?: Record<string, any> | null;
          social_triggers?: Record<string, any> | null;
          live_schedule?: Record<string, any> | null;
          status?: 'draft' | 'published' | 'archived' | 'flagged';
          language?: string | null;
          curriculum?: any[] | null;
          prerequisites?: string | null;
          access_period?: string | null;
          certification_available?: boolean | null;
          refund_policy?: string | null;
          borrow_enabled?: boolean | null;
          materials?: any[] | null;
          duration?: string | null;
          level?: string | null;
          tags?: string[] | null;
        };
        Update: Partial<Database['public']['Tables']['courses']['Insert']>;
      };
      mentorship_programs: {
        Row: {
          id: string;
          title: string;
          description: string;
          thumbnail_url: string;
          mentor_id: string;
          category: string;
          duration: string;
          max_mentees: number;
          current_mentees: number;
          price: number;
          features: string[];
          rating: number;
          review_count: number;
          level: string;
          cohort_start: string;
          created_at: string;
        };
      };
      modules: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          objective: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          objective?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['modules']['Insert']>;
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          type: 'video' | 'pdf' | 'quiz' | 'practical' | null;
          content_url: string | null;
          duration: number | null;
          resource_urls: string[];
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          type?: 'video' | 'pdf' | 'quiz' | 'practical' | null;
          content_url?: string | null;
          duration?: number | null;
          resource_urls?: string[];
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['lessons']['Insert']>;
      };
      enrollments: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          item_type: string;
          item_title: string;
          item_thumbnail: string | null;
          status: string;
          tier: string | null;
          amount: number | null;
          sponsor_mentor: string | null;
          progress: number;
          completed_lessons: string[];
          course_id: string | null;
          applied_at: string;
          last_accessed: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id: string;
          item_type: string;
          item_title: string;
          item_thumbnail?: string | null;
          status: string;
          tier?: string | null;
          amount?: number | null;
          sponsor_mentor?: string | null;
          progress?: number;
          completed_lessons?: string[];
          course_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']>;
      };
      sponsorship_requests: {
        Row: {
          id: string;
          mentee_id: string;
          mentor_id: string;
          course_id: string;
          course_title: string;
          course_thumbnail: string | null;
          amount: number;
          tier: string;
          message: string | null;
          status: string;
          requested_at: string;
        };
        Insert: {
          id?: string;
          mentee_id: string;
          mentor_id: string;
          course_id: string;
          course_title: string;
          course_thumbnail?: string | null;
          amount: number;
          tier: string;
          message?: string | null;
          status?: string;
        };
        Update: Partial<Database['public']['Tables']['sponsorship_requests']['Insert']>;
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          content: string;
          image_url: string | null;
          is_ad: boolean;
          likes_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          content: string;
          image_url?: string | null;
          is_ad?: boolean;
        };
        Update: Partial<Database['public']['Tables']['posts']['Insert']>;
      };
      post_likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
        };
        Update: never;
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          content: string;
        };
        Update: Partial<Database['public']['Tables']['comments']['Insert']>;
      };
      conversations: {
        Row: {
          id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
        };
        Update: never;
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          user_id: string;
          last_read_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
        };
        Update: {
          last_read_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          attachments: Record<string, any>[];
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          attachments?: Record<string, any>[];
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          paystack_subaccount_code: string | null;
          bank_details: Record<string, any> | null;
          lifetime_earnings: number;
          pending_settlement: number;
          available_balance: number;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          paystack_subaccount_code?: string | null;
          bank_details?: Record<string, any> | null;
          lifetime_earnings?: number;
          pending_settlement?: number;
          available_balance?: number;
          currency?: string;
        };
        Update: Partial<Database['public']['Tables']['wallets']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          wallet_id: string;
          amount: number;
          type: 'sale' | 'payout' | 'commission';
          status: 'pending' | 'completed' | 'failed';
          description: string | null;
          metadata: Record<string, any> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          amount: number;
          type: 'sale' | 'payout' | 'commission';
          status?: 'pending' | 'completed' | 'failed';
          description?: string | null;
          metadata?: Record<string, any> | null;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      live_sessions: {
        Row: {
          id: string;
          course_id: string | null;
          tutor_id: string;
          title: string;
          dyte_meeting_id: string;
          status: 'scheduled' | 'live' | 'ended';
          scheduled_at: string;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id?: string | null;
          tutor_id: string;
          title: string;
          dyte_meeting_id: string;
          status?: 'scheduled' | 'live' | 'ended';
          scheduled_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['live_sessions']['Insert']>;
      };
      study_pods: {
        Row: {
          id: string;
          name: string;
          creator_id: string;
          creator_type: 'tutor' | 'student';
          image_url: string | null;
          is_restricted: boolean;
          activity_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          creator_id: string;
          creator_type: 'tutor' | 'student';
          image_url?: string | null;
          is_restricted?: boolean;
          activity_status?: string;
        };
        Update: Partial<Database['public']['Tables']['study_pods']['Insert']>;
      };
      assessments: {
        Row: {
          id: string;
          course_id: string | null;
          title: string;
          type: 'quiz' | 'viva' | 'practical';
          time_limit: number | null;
          branching_rules: Record<string, any> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id?: string | null;
          title: string;
          type: 'quiz' | 'viva' | 'practical';
          time_limit?: number | null;
          branching_rules?: Record<string, any> | null;
        };
        Update: Partial<Database['public']['Tables']['assessments']['Insert']>;
      };
      quiz_questions: {
        Row: {
          id: string;
          assessment_id: string;
          question: string;
          options: string[];
          correct_index: number;
          feedback: string | null;
          remedial_video_url: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          question: string;
          options: string[];
          correct_index: number;
          feedback?: string | null;
          remedial_video_url?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['quiz_questions']['Insert']>;
      };
      submissions: {
        Row: {
          id: string;
          assessment_id: string;
          student_id: string;
          score: number | null;
          answers: Record<string, any> | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          student_id: string;
          score?: number | null;
          answers?: Record<string, any> | null;
        };
        Update: Partial<Database['public']['Tables']['submissions']['Insert']>;
      };
      user_library_access: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          access_type: 'rent' | 'own';
          lifetime_rent_total: number;
          is_author_gift: boolean;
          sponsored_by: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          book_id: string;
          access_type?: 'rent' | 'own';
          lifetime_rent_total?: number;
          is_author_gift?: boolean;
          sponsored_by?: string;
        };
      };
      books: {
        Row: {
          id: string;
          title: string;
          author_id: string;
          author_name: string;
          cover_url: string;
          retail_price: number;
          rental_price: number;
          category: string;
          description: string;
        };
      };
      admin_users: {
        Row: {
          id: string;
          user_id: string;
          roles: string[];
          onboarded: boolean;
          suspended: boolean;
          created_at: string;
          last_login: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          roles?: string[];
          onboarded?: boolean;
          suspended?: boolean;
          created_at?: string;
          last_login?: string | null;
        };
        Update: Partial<Database['public']['Tables']['admin_users']['Insert']>;
      };
      admin_invites: {
        Row: {
          id: string;
          email: string;
          roles: string[];
          invited_by: string | null;
          token: string;
          expires_at: string;
          status: 'pending' | 'accepted' | 'expired';
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          roles?: string[];
          invited_by?: string | null;
          token?: string;
          expires_at?: string;
          status?: 'pending' | 'accepted' | 'expired';
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['admin_invites']['Insert']>;
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_user_id: string | null;
          action: string;
          details: Record<string, any>;
          ip: string | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          admin_user_id?: string | null;
          action: string;
          details?: Record<string, any>;
          ip?: string | null;
          timestamp?: string;
        };
        Update: Partial<Database['public']['Tables']['admin_audit_log']['Insert']>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Course = Database['public']['Tables']['courses']['Row'];
export type MentorshipProgramDB = Database['public']['Tables']['mentorship_programs']['Row'];
export type Module = Database['public']['Tables']['modules']['Row'];
export type Lesson = Database['public']['Tables']['lessons']['Row'];
export type Enrollment = Database['public']['Tables']['enrollments']['Row'];
export type Post = Database['public']['Tables']['posts']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type WalletRow = Database['public']['Tables']['wallets']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type LiveSession = Database['public']['Tables']['live_sessions']['Row'];
export type StudyPod = Database['public']['Tables']['study_pods']['Row'];
export type Assessment = Database['public']['Tables']['assessments']['Row'];
export type QuizQuestion = Database['public']['Tables']['quiz_questions']['Row'];
export type Submission = Database['public']['Tables']['submissions']['Row'];
export type SponsorshipRequestDB = Database['public']['Tables']['sponsorship_requests']['Row'];
