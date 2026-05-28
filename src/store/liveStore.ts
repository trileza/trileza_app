import { create } from 'zustand';

export interface LiveSession {
  id: string;
  courseName: string;
  tutorName: string;
  tutorAvatar: string;
  startTime: string;
  viewerCount: number;
  status: 'live' | 'ended';
}

interface LiveState {
  activeSessions: LiveSession[];
  startSession: (session: LiveSession) => void;
  endSession: (id: string) => void;
  updateViewerCount: (id: string, count: number) => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  activeSessions: [
    {
      id: 'session-1',
      courseName: 'Advanced UI/UX Design Mastery',
      tutorName: 'Dr. David Ileza',
      tutorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
      startTime: new Date().toISOString(),
      viewerCount: 1240,
      status: 'live'
    },
    {
      id: 'session-2',
      courseName: 'System Architecture & AI Systems',
      tutorName: 'Prof. Sarah Chen',
      tutorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      startTime: new Date().toISOString(),
      viewerCount: 856,
      status: 'live'
    }
  ],
  startSession: (session) => set((state) => ({ 
    activeSessions: [...state.activeSessions, session] 
  })),
  endSession: (id) => set((state) => ({ 
    activeSessions: state.activeSessions.filter(s => s.id !== id) 
  })),
  updateViewerCount: (id, count) => set((state) => ({
    activeSessions: state.activeSessions.map(s => s.id === id ? { ...s, viewerCount: count } : s)
  }))
}));
