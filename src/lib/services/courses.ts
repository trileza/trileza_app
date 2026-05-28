import { nexus } from '../nexus';
import type { Course, Module, Lesson } from '../database.types';

export const courseService = {
  /**
   * Fetch all published courses
   */
  async getAllCourses() {
    const { data, error } = await nexus.database
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Fetch courses created by a specific tutor
   */
  async getTutorCourses(tutorId: string) {
    const { data, error } = await nexus.database
      .from('courses')
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Get a full course with modules and lessons
   */
  async getFullCourse(courseId: string) {
    const { data: course, error: courseError } = await nexus.database
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError) throw courseError;

    const { data: modules, error: modulesError } = await nexus.database
      .from('modules')
      .select('*, lessons (*)')
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true });

    if (modulesError) throw modulesError;

    return {
      ...course,
      modules: (modules ?? []).map((m: any) => ({
        ...m,
        lessons: (m.lessons ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
      }))
    };
  },

  /**
   * Create a new course skeleton
   */
  async createCourse(tutorId: string, title: string) {
    const { data, error } = await nexus.database
      .from('courses')
      .insert({
        tutor_id: tutorId,
        title,
        status: 'draft',
        price_standard: 0,
        price_elite: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update course details
   */
  async updateCourse(courseId: string, updates: Partial<Course>) {
    const { data, error } = await nexus.database
      .from('courses')
      .update(updates)
      .eq('id', courseId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Manage Modules
   */
  async addModule(courseId: string, title: string, order: number) {
    const { data, error } = await nexus.database
      .from('modules')
      .insert({ course_id: courseId, title, sort_order: order })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Manage Lessons
   */
  async addLesson(moduleId: string, title: string, type: 'video' | 'pdf' | 'quiz' | 'practical', order: number) {
    const { data, error } = await nexus.database
      .from('lessons')
      .insert({ module_id: moduleId, title, type, sort_order: order })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
