import React, { useEffect, useState } from 'react';
import { DyteProvider, useDyteClient } from '@dytesdk/react-web-core';
import { DyteMeeting } from '@dytesdk/react-ui-kit';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { liveService } from '../../lib/services/live';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { LoadingOverlay } from '../../components/shared';
import { applyDyteTheme } from '../../utils/dyteTheme';

const LiveClassroomContent = ({ authToken }: { authToken: string }) => {
  const [meeting, initMeeting] = useDyteClient();
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authToken) {
      initMeeting({
        authToken,
        defaults: {
          audio: true,
          video: true,
        },
      });
    }
  }, [authToken]);

  // Apply premium styling to Dyte panels
  useEffect(() => {
    if (containerRef.current && meeting) {
      applyDyteTheme(containerRef.current);
    }
  }, [meeting]);

  // Auto-join meeting room programmatically once initialized
  useEffect(() => {
    if (meeting) {
      meeting.joinRoom().catch((err: any) => {
        console.error('Failed to automatically join the classroom:', err);
      });
    }
  }, [meeting]);

  if (!meeting) {
    return <LoadingOverlay message="Initializing Studio" submessage="Syncing audio/video streams with Trileza Nexus..." />;
  }

  return (
    <div ref={containerRef} className="h-screen w-full bg-slate-950 overflow-hidden relative">
      {/* Premium Glassmorphism Background Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <DyteMeeting 
        meeting={meeting} 
        mode="fill" 
        showSetupScreen={false}
        className="h-full w-full backdrop-blur-md"
      />

      <style>{`
        dyte-meeting {
          --dyte-colors-brand-500: #2E7D32;
          --dyte-background-1000: rgba(51, 65, 85, 0.7);
          --dyte-control-bar-background: rgba(15, 23, 42, 0.6);
          --dyte-sidebar-background: rgba(15, 23, 42, 0.6);
        }
        .dyte-control-bar, .dyte-sidebar {
          backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>
    </div>
  );
};

const LiveClassroom = () => {
  const { meetingId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const join = async () => {
      if (!meetingId || !user) return;
      try {
        const token = await liveService.joinSession(meetingId, {
          id: user.id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          role: user.role
        });
        setAuthToken(token);
      } catch (err: any) {
        console.error('Failed to join live session:', err);
        setError(err.message || 'Meeting Not Found or Access Denied');
      } finally {
        setLoading(false);
      }
    };
    join();
  }, [meetingId, user]);

  if (loading) {
    return <LoadingOverlay message="Connecting Pipeline" submessage="Establishing secure tunnel to live broadcast..." />;
  }

  if (error || !authToken) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Live Session Error</h2>
            <p className="text-slate-400 font-medium">{error || "We couldn't connect you to this session."}</p>
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

  return <LiveClassroomContent authToken={authToken} />;
};

export default LiveClassroom;
