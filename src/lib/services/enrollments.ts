import { nexus } from '../nexus';
import type { Enrollment } from '../database.types';
import { publishUserEvent } from './realtimeEvents';

export const enrollmentService = {
  /**
   * Enroll a student in a course
   */
  async enroll(userId: string, itemId: string, itemType: string, itemTitle: string, itemThumbnail: string = '', status: string = 'enrolled') {
    const { data, error } = await nexus.database
      .from('enrollments')
      .insert({
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        item_title: itemTitle,
        item_thumbnail: itemThumbnail,
        status: status,
        progress: 0,
      })
      .select()
      .single();

    if (error) throw error;
    publishUserEvent('enrollment_created', { userId, itemId, itemType, itemTitle });
    return data;
  },

  /**
   * Fetch all courses a student is enrolled in
   */
  async getUserEnrollments(studentId: string) {
    const { data, error } = await nexus.database
      .from('enrollments')
      .select('*')
      .eq('user_id', studentId)
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
      .eq('user_id', studentId)
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
