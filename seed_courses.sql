-- Insert mock tutors (profiles)
INSERT INTO profiles (id, full_name, email, role, mentor_tier, bio, avatar_url)
VALUES
  ('mentor1', 'Dr. Amina Hassan', 'amina@trileza.com', 'mentor', 'elite', 'Ex-Google AI Researcher. 15+ years in ML/AI systems. Published 30+ papers.', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amina'),
  ('mentor2', 'Liam Okonkwo', 'liam@trileza.com', 'mentor', 'elite', 'Lead Design at Paystack. Previously at Andela and Flutterwave.', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Liam'),
  ('mentor3', 'Sarah Obi', 'sarah@trileza.com', 'mentor', 'elite', 'Engineering Manager at Microsoft. 10+ years backend engineering.', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'),
  ('mentor4', 'James Adeyemi', 'james@trileza.com', 'mentor', 'standard', 'Serial CTO. Built engineering teams at 3 YC-backed startups.', 'https://api.dicebear.com/7.x/avataaars/svg?seed=James'),
  ('mentor5', 'Dr. Ngozi Eze', 'ngozi@trileza.com', 'mentor', 'elite', 'Data Science Expert', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ngozi'),
  ('mentor6', 'Chidi Nwankwo', 'chidi@trileza.com', 'mentor', 'elite', 'Cybersecurity Professional', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chidi'),
  ('mentor7', 'Funke Adebayo', 'funke@trileza.com', 'mentor', 'elite', 'Product Management Guru', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Funke'),
  ('mentor8', 'Tunde Bakare', 'tunde@trileza.com', 'mentor', 'standard', 'Mobile App Developer', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tunde')
ON CONFLICT (id) DO NOTHING;

-- Insert wallets for the tutors so they have Paystack subaccounts
INSERT INTO wallets (user_id, balance, escrow_balance, currency, paystack_recipient_code, paystack_subaccount_code)
VALUES
  ('mentor1', 0, 0, 'NGN', 'RCP_mock1', 'ACCT_mock_subaccount_1'),
  ('mentor2', 0, 0, 'NGN', 'RCP_mock2', 'ACCT_mock_subaccount_2'),
  ('mentor3', 0, 0, 'NGN', 'RCP_mock3', 'ACCT_mock_subaccount_3'),
  ('mentor4', 0, 0, 'NGN', 'RCP_mock4', 'ACCT_mock_subaccount_4'),
  ('mentor5', 0, 0, 'NGN', 'RCP_mock5', 'ACCT_mock_subaccount_5'),
  ('mentor6', 0, 0, 'NGN', 'RCP_mock6', 'ACCT_mock_subaccount_6'),
  ('mentor7', 0, 0, 'NGN', 'RCP_mock7', 'ACCT_mock_subaccount_7'),
  ('mentor8', 0, 0, 'NGN', 'RCP_mock8', 'ACCT_mock_subaccount_8')
ON CONFLICT (user_id) DO NOTHING;

-- Insert Mock Courses
INSERT INTO courses (id, tutor_id, title, description, thumbnail_url, category, price_standard, price_elite, rating, review_count, enrolled_count, duration, modules, level, featured, learning_objectives, tags)
VALUES
  ('c1', 'mentor1', 'Advanced Agentic Coding Patterns', 'Master cutting-edge AI agent architectures.', 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=800&q=80', 'AI & Machine Learning', 45000, 85000, 4.9, 342, 2840, '12 Weeks', 24, 'Advanced', true, '["Build multi-agent orchestration systems", "Implement function-calling patterns"]', '["AI", "Agents", "LLM", "Production"]'),
  ('c2', 'mentor2', 'High-Fidelity UI Engineering', 'Learn to craft pixel-perfect, accessible interfaces.', 'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=800&q=80', 'UI/UX Design', 35000, 65000, 4.8, 218, 1920, '8 Weeks', 16, 'Intermediate', true, '["Master design token systems", "Build accessible component libraries"]', '["UI", "CSS", "Design Systems"]'),
  ('c3', 'mentor3', 'Full-Stack JavaScript Fundamentals', 'A comprehensive introduction to web development.', 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?auto=format&fit=crop&w=800&q=80', 'Software Engineering', 0, 25000, 4.7, 891, 8420, '10 Weeks', 20, 'Beginner', false, '["Build full-stack web applications", "Master React component patterns"]', '["JavaScript", "React", "Node.js"]'),
  ('c4', 'mentor4', 'Cloud Infrastructure & DevOps Mastery', 'Deep dive into cloud architecture and CI/CD pipelines.', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80', 'DevOps', 55000, 95000, 4.6, 156, 1340, '14 Weeks', 28, 'Advanced', false, '["Design scalable cloud architectures", "Implement CI/CD pipelines"]', '["DevOps", "Cloud", "Kubernetes"]'),
  ('c5', 'mentor5', 'Data Science with Python', 'Learn data analysis, visualization, and machine learning.', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80', 'Data Science', 40000, 75000, 4.8, 423, 3200, '10 Weeks', 22, 'Intermediate', true, '["Master Python for data analysis", "Build ML models from scratch"]', '["Python", "ML", "Data"]'),
  ('c6', 'mentor6', 'Introduction to Cybersecurity', 'Understand the fundamentals of cybersecurity.', 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80', 'Cybersecurity', 0, 35000, 4.5, 187, 1650, '6 Weeks', 12, 'Beginner', false, '["Understand threat landscapes", "Perform basic penetration testing"]', '["Security", "Ethical Hacking"]'),
  ('c7', 'mentor7', 'Product Management Accelerator', 'Learn to define product strategy and write PRDs.', 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80', 'Product Management', 30000, 60000, 4.7, 98, 780, '8 Weeks', 14, 'Intermediate', false, '["Define product strategy & vision", "Run discovery sprints"]', '["Product", "Strategy", "Agile"]'),
  ('c8', 'mentor8', 'Mobile App Development with React Native', 'Build cross-platform mobile apps with React Native.', 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80', 'Mobile Development', 38000, 70000, 4.6, 264, 2100, '10 Weeks', 18, 'Intermediate', false, '["Build cross-platform mobile apps", "Master React Native navigation"]', '["React Native", "Mobile", "Expo"]')
ON CONFLICT (id) DO NOTHING;

-- Insert Mock Mentorship Programs
INSERT INTO mentorship_programs (id, mentor_id, title, description, thumbnail_url, category, duration, max_mentees, current_mentees, price, features, rating, review_count, level, cohort_start)
VALUES
  ('m1', 'mentor1', 'AI Engineering Career Accelerator', 'Intensive 1-on-1 mentorship to transition into AI engineering.', 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80', 'AI & Machine Learning', '6 Months', 8, 5, 150000, '["Weekly 1-on-1 sessions", "Code review & feedback", "Job referrals & mock interviews"]', 5.0, 42, 'Advanced', 'June 15, 2026'),
  ('m2', 'mentor2', 'UI/UX Design Mentorship Track', 'From junior to senior designer in 4 months.', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80', 'UI/UX Design', '4 Months', 12, 9, 100000, '["Bi-weekly design critiques", "Portfolio case study reviews", "Industry networking intros"]', 4.9, 67, 'Intermediate', 'July 1, 2026'),
  ('m3', 'mentor3', 'Open Source Contributor Program', 'Learn to contribute to major open source projects.', 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?auto=format&fit=crop&w=800&q=80', 'Software Engineering', '3 Months', 30, 18, 0, '["Group mentorship sessions", "PR review guidance", "Git workflow mastery"]', 4.8, 124, 'Beginner', 'August 15, 2026'),
  ('m4', 'mentor4', 'Startup CTO Bootcamp', 'For technical founders and aspiring CTOs.', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80', 'Product Management', '3 Months', 6, 4, 200000, '["Weekly strategy calls", "Architecture review sessions", "Investor pitch prep"]', 4.7, 28, 'Expert', 'August 1, 2026')
ON CONFLICT (id) DO NOTHING;
