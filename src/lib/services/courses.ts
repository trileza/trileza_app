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
  },

  /**
   * Save full course curriculum (modules, lessons, materials, live sessions)
   */
  async saveCurriculum(courseId: string, topics: any[], tutorId: string) {
    // 1. Get existing modules for this course
    const { data: existingModules } = await nexus.database
      .from('modules')
      .select('id')
      .eq('course_id', courseId);
    
    const existingModuleIds = existingModules?.map(m => m.id) || [];
    const currentModuleIds = topics.map(t => t.id).filter(id => !id.includes('-'));

    // Modules to delete
    const modulesToDelete = existingModuleIds.filter(id => !currentModuleIds.includes(id));
    if (modulesToDelete.length > 0) {
      await nexus.database.from('modules').delete().in('id', modulesToDelete);
    }

    // 2. Upsert each topic (module)
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      let moduleId = topic.id;

      if (topic.id.includes('-')) {
        // Insert new module
        const { data: newMod, error: modErr } = await nexus.database
          .from('modules')
          .insert({
            course_id: courseId,
            title: topic.title,
            objective: topic.objective || null,
            sort_order: i
          })
          .select()
          .single();
        if (modErr) throw modErr;
        moduleId = newMod.id;
      } else {
        // Update existing module
        await nexus.database
          .from('modules')
          .update({
            title: topic.title,
            objective: topic.objective || null,
            sort_order: i
          })
          .eq('id', moduleId);
      }

      // 3. Save Video Lesson for this module
      const { data: existingLessons } = await nexus.database
        .from('lessons')
        .select('*')
        .eq('module_id', moduleId);

      const videoLesson = existingLessons?.find(l => l.type === 'video');

      if (topic.videoUrl) {
        if (videoLesson) {
          await nexus.database
            .from('lessons')
            .update({
              title: `${topic.title} Lecture`,
              content_url: topic.videoUrl
            })
            .eq('id', videoLesson.id);
        } else {
          await nexus.database
            .from('lessons')
            .insert({
              module_id: moduleId,
              title: `${topic.title} Lecture`,
              type: 'video',
              content_url: topic.videoUrl,
              sort_order: 0
            });
        }
      } else if (videoLesson) {
        await nexus.database.from('lessons').delete().eq('id', videoLesson.id);
      }

      // 4. Save Materials
      const nonVideoLessons = existingLessons?.filter(l => l.type !== 'video') || [];
      if (nonVideoLessons.length > 0) {
        await nexus.database
          .from('lessons')
          .delete()
          .in('id', nonVideoLessons.map(l => l.id));
      }

      if (topic.materials && topic.materials.length > 0) {
        const materialInserts = topic.materials.map((m: any, idx: number) => ({
          module_id: moduleId,
          title: m.name || 'Untitled Resource',
          type: m.type === 'pdf' ? 'pdf' : m.type === 'doc' ? 'pdf' : m.type === 'zip' ? 'practical' : 'practical',
          content_url: m.url || '',
          sort_order: idx + 1
        }));
        await nexus.database.from('lessons').insert(materialInserts);
      }

      // 5. Save Live Session
      if (topic.liveSession) {
        const { date, time, duration } = topic.liveSession;
        if (date && time) {
          const scheduledAt = new Date(`${date}T${time}`).toISOString();
          const liveTitle = `Live Class: ${topic.title}`;

          const { data: existingLive } = await nexus.database
            .from('live_sessions')
            .select('id')
            .eq('course_id', courseId)
            .eq('title', liveTitle)
            .maybeSingle();

          if (existingLive) {
            await nexus.database
              .from('live_sessions')
              .update({
                scheduled_at: scheduledAt,
                status: 'scheduled'
              })
              .eq('id', existingLive.id);
          } else {
            let dyteMeetingId = 'meet_mock_' + Math.random().toString(36).substring(2, 10);
            try {
              const { data: dyteRes } = await nexus.functions.invoke('dyte-meeting', {
                body: { title: liveTitle }
              });
              if (dyteRes?.meeting?.id) {
                dyteMeetingId = dyteRes.meeting.id;
              }
            } catch (e) {
              console.warn('Failed to create Dyte meeting, using mock ID:', e);
            }

            await nexus.database
              .from('live_sessions')
              .insert({
                course_id: courseId,
                tutor_id: tutorId,
                title: liveTitle,
                dyte_meeting_id: dyteMeetingId,
                status: 'scheduled',
                scheduled_at: scheduledAt
              });
          }
        }
      } else {
        const liveTitle = `Live Class: ${topic.title}`;
        await nexus.database
          .from('live_sessions')
          .delete()
          .eq('course_id', courseId)
          .eq('title', liveTitle);
      }
    }
  }
};

