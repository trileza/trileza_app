import { nexus } from '../nexus';

const generateRoomName = (title: string) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
};

// ── Types ──────────────────────────────────────────────────────────

export interface LiveSession {
  id: string;
  course_id: string;
  tutor_id: string;
  title: string;
  /**
   * The Cloudflare RealtimeKit meeting id.
   *
   * The column keeps its original name because renaming it would need a
   * migration against live session data for no user-visible gain. It has held
   * a RealtimeKit id since the move off Dyte.
   */
  dyte_meeting_id: string;
  status: 'scheduled' | 'live' | 'ended';
  scheduled_at: string;
  started_at?: string;
  ended_at?: string;
  is_locked?: boolean;
  room_password?: string;
  max_participants?: number;
  recording_url?: string;
  recurring?: string;
  image_url?: string;
  description?: string;
  /** Minutes the session may run, fixed at creation. `null` is unlimited. */
  duration_limit_minutes?: number | null;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  display_name: string;
  role: 'teacher' | 'student' | 'moderator';
  joined_at: string;
  left_at?: string;
  duration_seconds?: number;
  was_camera_on?: boolean;
  was_mic_on?: boolean;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  user_id?: string;
  event_type: string;
  event_data: Record<string, any>;
  created_at: string;
}

export interface BreakoutPod {
  id: string;
  session_id: string;
  pod_name: string;
  room_name: string;
  max_participants: number;
  created_by: string;
  status: 'active' | 'closed';
  created_at: string;
}

// ── Service ────────────────────────────────────────────────────────

export const liveService = {
  /**
   * Create a new live session (Tutor / Teacher only).
   */
  async createSession(
    courseId: string,
    tutorId: string,
    title: string,
    scheduledAt: string,
    recurring: string = 'none',
    imageUrl?: string,
    description?: string,
    /**
     * Minutes this session may run, from the host's tier at creation time.
     * Stored on the row so every participant counts down to the same moment,
     * and so a later pricing change cannot shorten a session already running.
     * `null` is unlimited.
     */
    durationLimitMinutes?: number | null
  ) {
    // 1. Create the RealtimeKit meeting. The backend checks that the caller is
    //    actually allowed to create one before spending account capacity.
    const { data: meetingRes, error: meetingError } = await nexus.functions.invoke('dyte-meeting', {
      body: { action: 'create_meeting', title }
    });

    if (meetingError) throw meetingError;

    // 2. Save to database
    const { data, error } = await nexus.database
      .from('live_sessions')
      .insert([{
        course_id: courseId,
        tutor_id: tutorId,
        title,
        dyte_meeting_id: meetingRes.data.id,
        scheduled_at: scheduledAt,
        status: 'scheduled',
        recurring,
        image_url: imageUrl || null,
        description: description || null,
        duration_limit_minutes: durationLimitMinutes ?? null
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Join a live session. Returns the RealtimeKit auth token.
   *
   * Takes no identity argument on purpose. The backend reads the caller from
   * their auth token and decides host-or-participant from the database — this
   * used to send `role` from the browser, which meant any student could ask for
   * a host token and receive one.
   */
  async joinSession(meetingId: string) {
    const { data, error } = await nexus.functions.invoke('dyte-meeting', {
      body: { action: 'add_participant', meetingId }
    });

    if (error) throw error;
    return data.data.token;
  },

  /**
   * Marks this session as still occupied.
   *
   * Called on a timer while someone is in the room. When the heartbeat goes
   * stale the server treats the room as empty and ends the session — which is
   * the only way to catch a host whose tab was closed, crashed or slept, since
   * none of those send anything on the way out.
   *
   * Failures are swallowed: a missed beat is harmless, and the grace period is
   * far longer than the interval.
   */
  async heartbeat(sessionId: string) {
    try {
      await nexus.database.rpc('touch_session_heartbeat', { p_session_id: sessionId });
    } catch {
      /* A dropped heartbeat is not worth surfacing. */
    }
  },

  /**
   * Closes sessions that are over their time limit or have been empty past the
   * grace period, and returns how many were closed.
   *
   * Run before listing sessions so nobody is shown a room that no longer
   * exists. Doing it here rather than on a schedule means expiry needs no cron:
   * the moment anyone opens a list, stale rooms are cleared.
   */
  async expireAbandoned(): Promise<number> {
    try {
      const { data } = await nexus.database.rpc('expire_abandoned_sessions', {
        p_grace_minutes: 5
      });
      return typeof data === 'number' ? data : 0;
    } catch (err) {
      console.warn('[Live] Could not sweep abandoned sessions:', err);
      return 0;
    }
  },

  /**
   * Fetch live sessions for a course (or 'global' for all).
   *
   * Sweeps abandoned sessions first, so the list reflects rooms that are
   * genuinely open rather than rows nobody closed.
   */
  async getCourseSessions(courseId: string) {
    await this.expireAbandoned();

    let query = nexus.database
      .from('live_sessions')
      .select('*')
      .order('scheduled_at', { ascending: false });

    if (courseId !== 'global') {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Get a single session by meeting ID (room name).
   */
  async getSessionByMeetingId(meetingId: string) {
    const { data, error } = await nexus.database
      .from('live_sessions')
      .select('*')
      .eq('dyte_meeting_id', meetingId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Update session status.
   */
  async updateStatus(sessionId: string, status: 'live' | 'ended') {
    const updates: Record<string, any> = { status };
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
  },

  /**
   * Delete a session entirely.
   */
  async deleteSession(sessionId: string) {
    const { error } = await nexus.database
      .from('live_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  },

  /**
   * Update session title.
   */
  async updateTitle(sessionId: string, title: string) {
    const { error } = await nexus.database
      .from('live_sessions')
      .update({ title })
      .eq('id', sessionId);
    if (error) throw error;
  },

  // ── Room Controls ────────────────────────────────────────────────

  /**
   * Lock/unlock a session room.
   */
  async setRoomLock(sessionId: string, isLocked: boolean, password?: string) {
    const { error } = await nexus.database
      .from('live_sessions')
      .update({
        is_locked: isLocked,
        room_password: password || null,
      })
      .eq('id', sessionId);

    if (error) throw error;
  },

  /**
   * Update recording URL after session ends.
   */
  async saveRecordingUrl(sessionId: string, recordingUrl: string) {
    const { error } = await nexus.database
      .from('live_sessions')
      .update({ recording_url: recordingUrl })
      .eq('id', sessionId);

    if (error) throw error;
  },

  // ── Attendance Tracking ──────────────────────────────────────────

  /**
   * Log a participant joining a session.
   */
  async logParticipantJoin(sessionId: string, userId: string, displayName: string, role: string) {
    const { data, error } = await nexus.database
      .from('session_participants')
      .insert([{
        session_id: sessionId,
        user_id: userId,
        display_name: displayName,
        role,
        joined_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[Live] Failed to log participant join:', error);
      return null;
    }
    return data;
  },

  /**
   * Log a participant leaving a session.
   */
  async logParticipantLeave(participantRecordId: string) {
    const now = new Date();
    try {
      // Fetch joined_at first to compute duration
      const { data: record, error: fetchError } = await nexus.database
        .from('session_participants')
        .select('joined_at')
        .eq('id', participantRecordId)
        .maybeSingle();

      if (fetchError || !record) {
        console.error('[Live] Failed to fetch participant join time:', fetchError);
      }

      let durationSeconds: number | undefined = undefined;
      if (record?.joined_at) {
        const joinedAt = new Date(record.joined_at);
        durationSeconds = Math.max(0, Math.round((now.getTime() - joinedAt.getTime()) / 1000));
      }

      const { error } = await nexus.database
        .from('session_participants')
        .update({
          left_at: now.toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', participantRecordId);

      if (error) console.error('[Live] Failed to log participant leave:', error);
    } catch (err) {
      console.error('[Live] Error in logParticipantLeave:', err);
    }
  },

  /**
   * Get attendance for a session.
   */
  async getSessionAttendance(sessionId: string) {
    const { data, error } = await nexus.database
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  // ── Event Tracking (Analytics) ───────────────────────────────────

  /**
   * Track a session event for analytics.
   */
  async trackEvent(sessionId: string, eventType: string, userId?: string, eventData?: Record<string, any>) {
    const { error } = await nexus.database
      .from('session_events')
      .insert([{
        session_id: sessionId,
        user_id: userId || null,
        event_type: eventType,
        event_data: eventData || {},
      }]);

    if (error) console.error('[Live] Failed to track event:', error);
  },

  /**
   * Get analytics for a session.
   */
  async getSessionAnalytics(sessionId: string) {
    const { data, error } = await nexus.database
      .from('session_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  // ── Breakout Pods ────────────────────────────────────────────────

  /**
   * Create a breakout pod for a session.
   */
  async createBreakoutPod(sessionId: string, podName: string, createdBy: string, maxParticipants = 10) {
    const roomName = generateRoomName(`pod-${podName}`);

    const { data, error } = await nexus.database
      .from('breakout_pods')
      .insert([{
        session_id: sessionId,
        pod_name: podName,
        room_name: roomName,
        max_participants: maxParticipants,
        created_by: createdBy,
        status: 'active',
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get all breakout pods for a session.
   */
  async getBreakoutPods(sessionId: string) {
    const { data, error } = await nexus.database
      .from('breakout_pods')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Close a breakout pod.
   */
  async closePod(podId: string) {
    const { error } = await nexus.database
      .from('breakout_pods')
      .update({ status: 'closed' })
      .eq('id', podId);

    if (error) throw error;
  },

  /**
   * Close ALL breakout pods for a session.
   */
  async closeAllPods(sessionId: string) {
    const { error } = await nexus.database
      .from('breakout_pods')
      .update({ status: 'closed' })
      .eq('session_id', sessionId)
      .eq('status', 'active');

    if (error) throw error;
  },
};
