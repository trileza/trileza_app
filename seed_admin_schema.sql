-- ==========================================
-- ADMIN SCHEMA AND DATA SEEDING SCRIPT
-- ==========================================

-- 1. Create admin_users table (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'content_manager', 'user_manager', 'finance_admin', 'support_agent', 'compliance_officer', 'analytics_viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  admin_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('approve', 'reject', 'suspend', 'unsuspend', 'delete', 'edit', 'triage', 'refund', 'escalate', 'resolve')),
  target_type TEXT NOT NULL CHECK (target_type IN ('course', 'book', 'user', 'payout', 'flagged_content', 'support_ticket', 'compliance_request')),
  target_id TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT NOT NULL
);

-- 3. Create course_reviews table (Course approval workflow)
CREATE TABLE IF NOT EXISTS course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_manager_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'needs_changes', 'rejected')) DEFAULT 'pending',
  checklist_title BOOLEAN DEFAULT FALSE,
  checklist_description BOOLEAN DEFAULT FALSE,
  checklist_curriculum BOOLEAN DEFAULT FALSE, -- >=5 lessons
  checklist_video BOOLEAN DEFAULT FALSE,      -- >=720p
  checklist_audio BOOLEAN DEFAULT FALSE,      -- clear
  checklist_thumbnail BOOLEAN DEFAULT FALSE,  -- professional
  checklist_no_copyright BOOLEAN DEFAULT FALSE,
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 4. Create book_reviews table (Book approval workflow)
CREATE TABLE IF NOT EXISTS book_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_manager_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'needs_changes')) DEFAULT 'pending',
  checklist_cover BOOLEAN DEFAULT FALSE,
  checklist_description BOOLEAN DEFAULT FALSE,
  checklist_readable BOOLEAN DEFAULT FALSE,
  checklist_price BOOLEAN DEFAULT FALSE,
  checklist_no_copyright BOOLEAN DEFAULT FALSE,
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 5. Create mentor_applications table (Mentor approval workflow)
CREATE TABLE IF NOT EXISTS mentor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info')) DEFAULT 'pending',
  checklist_profile_completeness BOOLEAN DEFAULT FALSE,
  checklist_id_verification BOOLEAN DEFAULT FALSE,
  checklist_qualifications BOOLEAN DEFAULT FALSE,
  checklist_intro_video BOOLEAN DEFAULT FALSE,
  video_url TEXT,
  qualifications TEXT,
  rejection_reason TEXT,
  reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 6. Create flagged_content table (Support/Compliance triage)
CREATE TABLE IF NOT EXISTS flagged_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('course', 'book', 'post', 'comment')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'resolved', 'dismissed')) DEFAULT 'pending',
  severity TEXT NOT NULL CHECK (severity IN ('urgent', 'high', 'medium', 'low')) DEFAULT 'medium',
  resolution_notes TEXT,
  resolved_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 7. Create payout_requests table (Finance payouts)
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  bank_details JSONB NOT NULL,
  reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 8. Create support_tickets table (Support helpdesk)
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'escalated', 'closed')) DEFAULT 'open',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  assigned_to TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- 9. Create compliance_requests table (Copyright, GDPR, TOS)
CREATE TABLE IF NOT EXISTS compliance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('copyright_claim', 'terms_violation', 'gdpr_request')),
  details JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')) DEFAULT 'pending',
  resolution_notes TEXT,
  reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 10. Create transactions table (Finance tracking)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'payout', 'commission')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- MOCK DATA SEEDING
-- ==========================================

-- Seed Admin Users mapping
INSERT INTO admin_users (id, role) VALUES
  ('763f4330-f5f4-4475-9cf9-b1ca2ad210c1', 'super_admin'),
  ('mentor1', 'content_manager'),
  ('mentor2', 'user_manager'),
  ('mentor3', 'finance_admin'),
  ('mentor4', 'support_agent'),
  ('mentor5', 'compliance_officer'),
  ('mentor6', 'analytics_viewer')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Seed Course Reviews (pending/needs changes)
INSERT INTO course_reviews (course_id, submitted_by, status, checklist_title, checklist_description, checklist_curriculum, checklist_video, checklist_audio, checklist_thumbnail, checklist_no_copyright, notes, submitted_at) VALUES
  ('c1', 'mentor1', 'pending', false, false, false, false, false, false, false, 'Initial submission review needed for Advanced Agentic Coding Patterns', NOW() - INTERVAL '1 day'),
  ('c2', 'mentor2', 'pending', true, true, false, false, false, false, false, 'High-Fidelity UI Engineering needs curriculum and media check', NOW() - INTERVAL '3 hours'),
  ('c3', 'mentor3', 'needs_changes', true, true, true, false, false, true, false, 'Audio clarity in lesson 2 needs correction. Please re-record.', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Seed Book Reviews
INSERT INTO book_reviews (book_id, submitted_by, status, checklist_cover, checklist_description, checklist_readable, checklist_price, checklist_no_copyright, notes, submitted_at) VALUES
  ('book-1', 'mentor1', 'pending', false, false, false, false, false, 'Review needed for cover quality and readability of The Architecture of Motivation', NOW() - INTERVAL '12 hours'),
  ('book-2', 'mentor2', 'pending', true, true, false, false, false, 'Review price adjustment request for Sustainable Housing Systems', NOW() - INTERVAL '5 hours')
ON CONFLICT DO NOTHING;

-- Seed Mentor Applications
INSERT INTO mentor_applications (user_id, status, checklist_profile_completeness, checklist_id_verification, checklist_qualifications, checklist_intro_video, video_url, qualifications, rejection_reason, submitted_at) VALUES
  ('mentor-1', 'pending', true, false, false, false, 'https://storage.googleapis.com/trileza-videos/intro-mentor-1.mp4', 'Ph.D. in Architecture, 12 years teaching experience.', NULL, NOW() - INTERVAL '1 day'),
  ('mentor-2', 'pending', true, true, true, false, 'https://storage.googleapis.com/trileza-videos/intro-mentor-2.mp4', 'M.Sc. in Human-Computer Interaction, UX Designer at Apple.', NULL, NOW() - INTERVAL '4 hours')
ON CONFLICT DO NOTHING;

-- Seed Flagged Content
INSERT INTO flagged_content (reporter_id, target_type, target_id, reason, status, severity, created_at) VALUES
  ('763f4330-f5f4-4475-9cf9-b1ca2ad210c1', 'course', 'c4', 'Copyright violation: Contains slides copied from university syllabus without authorization.', 'pending', 'high', NOW() - INTERVAL '16 hours'),
  ('mentor1', 'comment', 'c5', 'Abusive language: Student using profanity in course discussion boards.', 'pending', 'medium', NOW() - INTERVAL '1 day'),
  ('mentor2', 'book', 'book-3', 'Plagiarism claim: Contents are identical to open-source e-books.', 'pending', 'urgent', NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- Seed Payout Requests
INSERT INTO payout_requests (user_id, amount, status, bank_details, reason, created_at) VALUES
  ('mentor1', 120000, 'pending', '{"bank_name": "Wema Bank", "account_number": "0123456789", "account_name": "Dr. Amina Hassan"}', 'Monthly course sales share (Automatic under ₦500k)', NOW() - INTERVAL '2 hours'),
  ('mentor2', 650000, 'pending', '{"bank_name": "GTBank", "account_number": "0987654321", "account_name": "Liam Okonkwo"}', 'Mentorship cohort payout (Requires Finance Admin review > ₦500k)', NOW() - INTERVAL '8 hours')
ON CONFLICT DO NOTHING;

-- Seed Support Tickets
INSERT INTO support_tickets (user_id, title, description, status, priority, created_at) VALUES
  ('763f4330-f5f4-4475-9cf9-b1ca2ad210c1', 'Cannot access enrolled course c1', 'I successfully paid for the Advanced Agentic Coding course, but it is not showing up in my learning tab.', 'open', 'high', NOW() - INTERVAL '3 hours'),
  ('mentor1', 'Paystack subaccount creation failing', 'Getting a gateway response error when trying to generate Wema Bank subaccount code.', 'in_progress', 'medium', NOW() - INTERVAL '1 day'),
  ('mentor2', 'Urgent: Zoom live session link expired', 'My scheduled cohort session starts in 1 hour but the Zoom classroom link returned an authorization error.', 'open', 'urgent', NOW() - INTERVAL '15 minutes')
ON CONFLICT DO NOTHING;

-- Seed Compliance Requests
INSERT INTO compliance_requests (user_id, type, details, status, created_at) VALUES
  ('mentor3', 'gdpr_request', '{"request_type": "export_data", "notes": "Requesting a full download of all stored profile, course metrics, and discussion messages."}', 'pending', NOW() - INTERVAL '1 day'),
  (NULL, 'copyright_claim', '{"claimant": "Pearson Publishing Ltd", "infringement_url": "/library/book-1", "reason": "Chapter 4 contains unauthorized text excerpts from textbook."}', 'pending', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Seed Transactions (for wallet-based revenue views)
INSERT INTO transactions (wallet_id, amount, type, status, description, metadata, created_at) VALUES
  ('c3f2ff62-a126-470c-b723-fa51b6c24357', 45000, 'sale', 'completed', 'Sale of Advanced Agentic Coding Patterns (Standard)', '{"student_id": "763f4330-f5f4-4475-9cf9-b1ca2ad210c1", "course_id": "c1"}', NOW() - INTERVAL '1 day'),
  ('e0a61ae9-a11d-4857-86e0-06bf261f6c4c', 120000, 'sale', 'completed', 'Sale of High-Fidelity UI Engineering (Elite)', '{"student_id": "763f4330-f5f4-4475-9cf9-b1ca2ad210c1", "course_id": "c2"}', NOW() - INTERVAL '12 hours'),
  ('c3f2ff62-a126-470c-b723-fa51b6c24357', -15000, 'payout', 'completed', 'Payout to bank account', '{"payout_id": "pay_9812"}', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Seed Admin Audit Logs
INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, previous_state, new_state, reason) VALUES
  ('763f4330-f5f4-4475-9cf9-b1ca2ad210c1', 'approve', 'user', 'mentor3', '{"status": "pending_verification"}', '{"status": "active_mentor"}', 'Onboarded mentor and verified credentials'),
  ('mentor1', 'reject', 'course', 'c3', '{"status": "pending"}', '{"status": "needs_changes"}', 'Checklist failed: Audio clarity issues in lesson 2')
ON CONFLICT DO NOTHING;
