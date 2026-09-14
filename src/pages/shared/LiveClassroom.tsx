/**
 * LiveClassroom — Pre-Join + Meeting Activation
 * ──────────────────────────────────────────────
 * Handles pre-join lobby and activates the meeting overlay.
 * The actual meeting renders via MeetingOverlay at the App level,
 * so it persists across sidebar tab navigation.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMeetingStore } from '../../store/meetingStore';
import { liveService, type LiveSession } from '../../lib/services/live';
import { nexus } from '../../lib/nexus';
import { AlertCircle, ChevronLeft, Loader2 } from 'lucide-react';
import { LoadingOverlay } from '../../components/shared';

// Bespoke components
import PreJoinScreen from '../../components/live/PreJoinScreen';

const LiveClassroom: React.FC = () => {
  const { meetingId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { isActive, isMinimized, maximizeMeeting, activateMeeting } = useMeetingStore();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [tutorName, setTutorName] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreJoin, setShowPreJoin] = useState(true);
  const [isWaitingForHost, setIsWaitingForHost] = useState(false);

  // ── If meeting is already active and we navigate here, maximize ──
  useEffect(() => {
    if (isActive && isMinimized) {
      maximizeMeeting();
    }
  }, [isActive, isMinimized]);

  // ── Resolve Meeting → Auth Token ──────────────────────────────────

  useEffect(() => {
    const resolve = async () => {
      if (!meetingId || !user) return;
 
      // If already in an active meeting for this session, just maximize
      if (isActive) {
        setLoading(false);
        setShowPreJoin(false);
        return;
      }
 
      try {
        // Try to fetch session metadata from DB first
        let isHost = false;
        let sessionData: LiveSession | null = null;
        try {
          sessionData = await liveService.getSessionByMeetingId(meetingId);
          if (sessionData) {
            setSession(sessionData);
            // Fetch tutor profile to get the hostName
            const { data: tutorProfile } = await nexus.database
              .from('public_profiles')
              .select('full_name')
              .eq('id', sessionData.tutor_id)
              .maybeSingle();
            if (tutorProfile) {
              setTutorName(tutorProfile.full_name);
            }
 
            // Derive host status
            const roleLower = user.role?.toLowerCase() || '';
            isHost = sessionData.tutor_id === user.id || 
                     roleLower === 'tutor' || 
                     roleLower === 'mentor' || 
                     roleLower === 'management' || 
                     roleLower === 'staff';
          }
        } catch (e) {
          // Session may not exist in DB (direct room join) — that's OK
        }
 
        // If not started yet and not the host, student must wait in lobby
        if (sessionData && sessionData.status === 'scheduled' && !isHost) {
          setIsWaitingForHost(true);
          setLoading(false);
          return; // Stop here, poll status
        }
 
        // Otherwise if host joins scheduled meeting, transition to live
        if (sessionData && sessionData.status === 'scheduled' && isHost) {
          await liveService.updateStatus(sessionData.id, 'live');
        }
 
        // Get the room token from the service
        const token = await liveService.joinSession(meetingId, {
          id: user.id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          role: user.role,
        });
 
        setAuthToken(token);
      } catch (err: any) {
        console.error('Failed to join live session:', err);
        setError(err.message || 'Meeting Not Found or Access Denied');
      } finally {
        setLoading(false);
      }
    };
 
    resolve();
  }, [meetingId, user]);
 
  // ── Poll Session Status (For Students Early Entry) ──
  useEffect(() => {
    if (!isWaitingForHost || !meetingId || !user) return;
 
    let pollInterval: any;
 
    const checkStatus = async () => {
      try {
        const sessionData = await liveService.getSessionByMeetingId(meetingId);
        if (sessionData && sessionData.status === 'live') {
          clearInterval(pollInterval);
          setIsWaitingForHost(false);
          setLoading(true); // show loader while connecting pipeline
 
          // Resolve and join now that meeting is live
          const token = await liveService.joinSession(meetingId, {
            id: user.id,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            role: user.role,
          });
 
          setAuthToken(token);
          setLoading(false);
        }
      } catch (err) {
        console.error('[LiveClassroom] Status polling failed:', err);
      }
    };
 
    pollInterval = setInterval(checkStatus, 5000);
    return () => clearInterval(pollInterval);
  }, [isWaitingForHost, meetingId, user]);

  // ── Derive User Role ─────────────────────────────────────────────

  const deriveUserRole = useCallback((): 'teacher' | 'student' | 'moderator' => {
    if (!user || !session) {
      const roleLower = user?.role?.toLowerCase() || '';
      return (roleLower === 'tutor' || roleLower === 'mentor') ? 'teacher' : 'student';
    }

    const userRoleLower = user.role?.toLowerCase() || '';

    // If the user created this session, they're the teacher
    if (session.tutor_id === user.id) return 'teacher';

    // If the user has a management/admin role
    if (userRoleLower === 'management' || userRoleLower === 'staff') return 'moderator';

    // Tutor role
    if (userRoleLower === 'tutor' || userRoleLower === 'mentor') return 'teacher';

    return 'student';
  }, [session, user]);

  // ── Handle Join from PreJoin ─────────────────────────────────────

  const handleJoin = (settings: { audio: boolean; video: boolean }) => {
    setShowPreJoin(false);

    // Activate the meeting overlay
    activateMeeting({
      authToken,
      displayName: user?.full_name || 'Scholar',
      avatarUrl: user?.avatar_url,
      sessionTitle: session?.title,
      sessionId: session?.id || null,
      userId: user?.id || '',
      userRole: deriveUserRole(),
      audioEnabled: settings.audio,
      videoEnabled: settings.video,
      dyteMeetingId: meetingId || null,
    });

    // Track the join event
    if (session?.id && user) {
      liveService.trackEvent(session.id, 'meeting_started', user.id, {
        displayName: user.full_name,
        role: deriveUserRole(),
      });
    }
  };

  // ── Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <LoadingOverlay
        message="Connecting Pipeline"
        submessage="Establishing secure tunnel to live broadcast..."
      />
    );
  }

  // ── Error ────────────────────────────────────────────────────────

  if (error || (!authToken && !isActive)) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Live Session Error</h2>
            <p className="text-slate-400 font-medium">
              {error || "We couldn't connect you to this session."}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <ChevronLeft size={20} /> Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Lobby: Waiting for Host ──
  if (isWaitingForHost) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-10 text-center space-y-8 shadow-2xl relative z-10">
          <div className="flex items-center justify-center pb-4 border-b border-slate-800">
            <img src="/icon-192.png" alt="Trileza Logo" className="h-9 object-contain" />
          </div>

          <div className="space-y-4">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20">
              <Loader2 className="animate-spin" size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-tight">{session?.title || 'Live Classroom'}</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                Waiting for Host to Start...
              </p>
            </div>
            <p className="text-slate-450 text-xs font-semibold max-w-sm mx-auto leading-relaxed">
              The tutor has not initialized the live broadcast transmission yet. Please wait in this lobby. The system will connect you automatically when the host starts.
            </p>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
            >
              <ChevronLeft size={16} /> Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Meeting is active (rendered by MeetingOverlay at App level) ──
  if (isActive && !showPreJoin) {
    // The meeting is rendered by MeetingOverlay. If we're on this page,
    // make sure the overlay is maximized.
    if (isMinimized) {
      maximizeMeeting();
    }
    // Show nothing here since the overlay handles rendering
    return null;
  }

  // ── Pre-Join Screen ──────────────────────────────────────────────

  if (showPreJoin) {
    return (
      <PreJoinScreen
        roomName={session?.title || meetingId || ''}
        displayName={user?.full_name || 'Scholar'}
        avatarUrl={user?.avatar_url}
        sessionTitle={session?.title}
        hostName={tutorName}
        onJoin={handleJoin}
        onBack={() => navigate(-1)}
        onTitleChange={async (newTitle) => {
          if (session?.id) {
            try {
              await liveService.updateTitle(session.id, newTitle);
              setSession(prev => prev ? { ...prev, title: newTitle } : null);
            } catch (err) {
              console.error('Failed to update meeting title:', err);
            }
          }
        }}
      />
    );
  }

  return null;
};

export default LiveClassroom;
