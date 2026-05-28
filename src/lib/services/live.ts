import { nexus } from '../nexus';

export interface LiveSession {
  id: string;
  course_id: string;
  tutor_id: string;
  title: string;
  dyte_meeting_id: string;
  status: 'scheduled' | 'live' | 'ended';
  scheduled_at: string;
}

export const liveService = {
  /**
   * Create a new live session (Tutor only)
   */
  async createSession(courseId: string, tutorId: string, title: string, scheduledAt: string) {
    // 1. Create Dyte Meeting via Edge Function
    const { data: dyteData, error: dyteError } = await nexus.functions.invoke('dyte-meeting', {
      body: { action: 'create_meeting', title }
    });

    if (dyteError) throw dyteError;

    // 2. Save to our database
    const { data, error } = await nexus.database
      .from('live_sessions')
      .insert({
        course_id: courseId,
        tutor_id: tutorId,
        title,
        dyte_meeting_id: dyteData.data.id,
        scheduled_at: scheduledAt,
        status: 'scheduled'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Join a live session (Get Dyte authToken)
   */
  async joinSession(meetingId: string, user: { id: string, full_name: string, avatar_url?: string, role: string }) {
    const { data, error } = await nexus.functions.invoke('dyte-meeting', {
      body: {
        action: 'add_participant',
        meetingId,
        participant: {
          id: user.id,
          name: user.full_name,
          picture: user.avatar_url,
          role: user.role
        }
      }
    });

    if (error) throw error;
    return data.data.token; // The Dyte authToken
  },

  /**
   * Fetch live sessions for a course
   */
  async getCourseSessions(courseId: string) {
    const { data, error } = await nexus.database
      .from('live_sessions')
      .select('*')
      .eq('course_id', courseId)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Update session status
   */
  async updateStatus(sessionId: string, status: 'live' | 'ended') {
    const updates: any = { status };
    if (status === 'live') updates.started_at = new Date().toISOString();
    if (status === 'ended') updates.ended_at = new Date().toISOString();

    const { data, error } = await nexus.database
      .from('live_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
