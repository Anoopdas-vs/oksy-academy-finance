-- ============================================================================
-- Migration: Oksy Academy Suite (Timetable, Live Class, Projects, Exams, Reviews)
-- Run this migration in your Supabase SQL Editor to enable full academy tables.
-- ============================================================================

-- 1. Timetable / Schedule Master
CREATE TABLE IF NOT EXISTS timetables (
  id text PRIMARY KEY,
  day text NOT NULL, -- Monday .. Saturday
  time text NOT NULL, -- e.g. 10:00 AM - 11:30 AM
  subject text NOT NULL,
  batch text NOT NULL,
  faculty text NOT NULL,
  room text DEFAULT 'Virtual Room 101',
  link text,
  created_at timestamptz DEFAULT now()
);

-- 2. Assignments & Practical Projects
CREATE TABLE IF NOT EXISTS assignments (
  id text PRIMARY KEY,
  title text NOT NULL,
  batch text NOT NULL,
  due_date date NOT NULL,
  max_marks integer NOT NULL DEFAULT 100,
  description text,
  attachment_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- 3. Assignment Submissions & Grading
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id text PRIMARY KEY,
  assignment_id text REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id),
  link text,
  notes text,
  marks integer,
  feedback text,
  status text DEFAULT 'Submitted', -- Submitted, Graded
  submitted_at timestamptz DEFAULT now()
);

-- 4. Online Examinations & Quizzes
CREATE TABLE IF NOT EXISTS exams (
  id text PRIMARY KEY,
  title text NOT NULL,
  batch text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  passing_score integer NOT NULL DEFAULT 50,
  status text DEFAULT 'Available', -- Available, Upcoming, Completed
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id text PRIMARY KEY,
  exam_id text REFERENCES exams(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL, -- ["Option A", "Option B", ...]
  correct_index integer NOT NULL,
  marks integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exam_results (
  id text PRIMARY KEY,
  exam_id text REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id),
  score integer NOT NULL,
  total integer NOT NULL,
  percentage integer NOT NULL,
  passed boolean NOT NULL,
  submitted_at timestamptz DEFAULT now()
);

-- 5. Faculty & Academic Reviews
CREATE TABLE IF NOT EXISTS faculty_reviews (
  id text PRIMARY KEY,
  faculty text NOT NULL,
  subject text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  clarity integer NOT NULL CHECK (clarity BETWEEN 1 AND 5),
  punctuality integer NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
  comment text NOT NULL,
  student_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS) on all new tables
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_reviews ENABLE ROW LEVEL SECURITY;

-- Standard Public/Approved Read Policies
CREATE POLICY "Approved users can view timetable" ON timetables
  FOR SELECT TO authenticated USING (is_approved_user());

CREATE POLICY "Admins can manage timetable" ON timetables
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Approved users can view assignments" ON assignments
  FOR SELECT TO authenticated USING (is_approved_user());

CREATE POLICY "Admins can manage assignments" ON assignments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users can manage own submissions" ON assignment_submissions
  FOR ALL TO authenticated USING (student_id = auth.uid() OR is_admin())
  WITH CHECK (student_id = auth.uid() OR is_admin());

CREATE POLICY "Approved users can view exams" ON exams
  FOR SELECT TO authenticated USING (is_approved_user());

CREATE POLICY "Admins can manage exams" ON exams
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Approved users can view exam questions" ON exam_questions
  FOR SELECT TO authenticated USING (is_approved_user());

CREATE POLICY "Users can record own exam results" ON exam_results
  FOR ALL TO authenticated USING (student_id = auth.uid() OR is_admin())
  WITH CHECK (student_id = auth.uid() OR is_admin());

CREATE POLICY "Approved users can view reviews" ON faculty_reviews
  FOR SELECT TO authenticated USING (is_approved_user());

CREATE POLICY "Users can post reviews" ON faculty_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
