/**
 * MeetingModals — Bespoke White Theme Modal Dialogs
 * ────────────────────────────────────────────────
 * Settings, End Meeting Confirmation, and Invite modals.
 * White theme, clean borders, and clear typography.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, PhoneOff, Settings, Copy, CheckCircle, HardDrive, Cloud } from 'lucide-react';

// ── End Meeting Confirmation ──

interface EndMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isTeacher: boolean;
}

export const EndMeetingModal: React.FC<EndMeetingModalProps> = ({
  isOpen, onClose, onConfirm, isTeacher,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6 text-left"
      >
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
            <PhoneOff size={28} className="text-red-500" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-slate-805">
            {isTeacher ? 'End this session?' : 'Leave classroom?'}
          </h2>
          <p className="text-sm font-medium text-slate-400">
            {isTeacher
              ? 'This will end the session for all participants. Recordings will be saved.'
              : 'You can rejoin later if the session is still active.'
            }
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-black text-sm hover:bg-red-600 transition-all shadow-lg cursor-pointer"
          >
            {isTeacher ? 'End Session' : 'Leave'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Invite Modal ──

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  domain: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen, onClose, roomName, domain,
}) => {
  const [copied, setCopied] = useState(false);
  const meetingUrl = `https://${domain}/${roomName}`;

  const copyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6 text-left"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-805">Invite Participants</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-455 hover:text-slate-200 transition-all border-none bg-transparent cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            Meeting Link
          </label>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
            <span className="text-xs text-slate-200 truncate flex-1 font-mono">{meetingUrl}</span>
            <button
              onClick={copyLink}
              className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all shrink-0 cursor-pointer"
            >
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
            </button>
          </div>
          {copied && (
            <p className="text-xs font-bold text-emerald-400">Link copied to clipboard!</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer"
        >
          Done
        </button>
      </motion.div>
    </div>
  );
};

// ── Settings Modal ──

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  React.useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings size={18} className="text-emerald-400" />
            <h2 className="text-lg font-black text-slate-805">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-455 hover:text-slate-200 transition-all border-none bg-transparent cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Audio Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Microphone
            </label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer font-semibold">
              {audioDevices.length === 0 ? (
                <option>No devices found</option>
              ) : (
                audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                ))
              )}
            </select>
          </div>

          {/* Video Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Camera
            </label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer font-semibold">
              {videoDevices.length === 0 ? (
                <option>No devices found</option>
              ) : (
                videoDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                ))
              )}
            </select>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-600 transition-all border-none cursor-pointer"
        >
          Done
        </button>
      </motion.div>
    </div>
  );
};

// ── Recording Options Modal ──

interface RecordingOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocal: () => void;
  onSelectCloud: () => void;
}

export const RecordingOptionsModal: React.FC<RecordingOptionsModalProps> = ({ isOpen, onClose, onSelectLocal, onSelectCloud }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6 text-left"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-805">Recording Options</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-455 hover:text-slate-200 transition-all border-none bg-transparent cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={onSelectLocal}
            className="w-full flex items-start gap-4 p-4 rounded-2xl border border-slate-700 bg-slate-900 hover:border-emerald-500 hover:bg-emerald-500/15 transition-all group text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 group-hover:bg-emerald-500/25 flex items-center justify-center shrink-0 transition-colors">
              <HardDrive size={20} className="text-slate-300 group-hover:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300">Record to Device</h3>
              <p className="text-xs text-slate-400 mt-1">Capture your screen and audio locally. Saves instantly to your computer.</p>
            </div>
          </button>

          <button
            onClick={onSelectCloud}
            className="w-full flex items-start gap-4 p-4 rounded-2xl border border-slate-700 bg-slate-900 hover:border-emerald-500 hover:bg-emerald-500/15 transition-all group text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 group-hover:bg-emerald-500/25 flex items-center justify-center shrink-0 transition-colors">
              <Cloud size={20} className="text-slate-300 group-hover:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300">Record Online</h3>
              <p className="text-xs text-slate-400 mt-1">Saves the recording to the cloud and automatically sends a download link to your email.</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
