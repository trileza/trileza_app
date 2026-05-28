import { nexus } from '../nexus';
import type { Enrollment } from '../database.types';

export const enrollmentService = {
  /**
   * Enroll a student in a course
   */
  async enroll(studentId: string, courseId: string) {
    const { data, error } = await nexus.database
      .from('enrollments')
      .insert({
        student_id: studentId,
        course_id: courseId,
        progress: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Fetch all courses a student is enrolled in
   */
  async getUserEnrollments(studentId: string) {
    const { data, error } = await nexus.database
      .from('enrollments')
      .select('*')
      .eq('student_id', studentId)
      .order('last_accessed', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Fetch all courses a student is enrolled in (with course details)
   */
  async getStudentEnrollments(studentId: string) {
    const { data, error } = await nexus.database
      .from('enrollments')
      .select('*')
      .eq('student_id', studentId)
      .order('last_accessed', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Update lesson completion and progress
   */
  async updateProgress(enrollmentId: string, completedLessons: string[], progress: number) {
    const { data, error } = await nexus.database
      .from('enrollments')
      .update({
        completed_lessons: completedLessons,
        progress,
        last_accessed: new Date().toISOString()
      })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
