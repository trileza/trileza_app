import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, Trash2, Video, FileText,
  Calendar, Upload, Save, Award, PlayCircle,
  GripVertical, X, CheckCircle, Paperclip, Clock, ChevronRight,
  Globe, Target, Sparkles, BookOpen, Search, Link2, Image,
  Settings, Layers, GraduationCap, UploadCloud, Users
} from 'lucide-react';
import { cn, executeWithAutoRefresh } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { courseService } from '../../lib/services/courses';
import { LoadingOverlay, TrilezaVideoPlayer, PageHeader } from '../../components/shared';
import { Button } from '../../components/ui';
import { nexus } from '../../lib/nexus';
import * as tus from 'tus-js-client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Material { id: string; name: string; size?: string; type: 'pdf' | 'zip' | 'link' | 'doc'; url?: string; }
interface LiveSession { date: string; time: string; duration: string; note: string; }
interface Topic {
  id: string;
  title: string;
  objective: string;
  videoUrl: string;
  materials: Material[];
  liveSession: LiveSession | null;
  expanded: boolean;
}

const DIGITAL_SKILL_CATEGORIES = [
  // Web & Mobile Development
  "Front-End Development",
  "Back-End Development",
  "Full-Stack Development",
  "Mobile App Development",
  "iOS Development",
  "Android Development",
  "Cross-Platform App Development",
  "Software Engineering",
  "DevOps & Cloud Computing",
  "Game Development",
  "Software Testing & QA",
  "Systems Architecture",
  "Web3 & Blockchain Development",
  "Smart Contract Engineering",

  // Data, AI, & Advanced Computing
  "Artificial Intelligence (AI)",
  "Machine Learning (ML)",
  "Deep Learning",
  "Generative AI & LLMs",
  "Natural Language Processing (NLP)",
  "Computer Vision",
  "Data Science",
  "Big Data Engineering",
  "Data Analytics",
  "Business Intelligence (BI)",
  "AI Product Management",
  "Quantitative Analysis",

  // Design, UX & Creative
  "UI/UX Design",
  "User Experience Research",
  "Interaction Design",
  "Product Design",
  "Graphic Design",
  "3D Modeling & Animation",
  "Motion Graphics",
  "Visual Design",
  "Web Design",
  "Game Design",
  "Brand Identity Design",

  // Cyber Security & Networking
  "Cybersecurity",
  "Ethical Hacking & Pentesting",
  "Network Security",
  "Cyber Forensics",
  "Cloud Security",
  "Information Security Management",
  "Systems Administration",

  // Product & Business Tech
  "Product Management",
  "Agile & Scrum Practices",
  "Digital Transformation",
  "Business Analysis",
  "E-commerce Management",
  "IT Project Management",
  "SaaS Growth & Strategy",

  // Marketing, Growth & Analytics
  "Digital Marketing",
  "Search Engine Optimization (SEO)",
  "Search Engine Marketing (SEM)",
  "Social Media Marketing",
  "Content Marketing",
  "Email Marketing",
  "Affiliate Marketing",
  "Growth Hacking",
  "Web Analytics",
  "Conversion Rate Optimization (CRO)"
];

interface CategoryAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const CategoryAutocomplete: React.FC<CategoryAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Select or type Category...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredCategories = DIGITAL_SKILL_CATEGORIES.filter(cat =>
    cat.toLowerCase().includes(inputValue.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onChange(inputValue);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputValue, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (category: string) => {
    setInputValue(category);
    onChange(category);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            "w-full h-12 bg-slate-50 rounded-xl pl-10 pr-4 text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all border border-slate-250 font-sans",
            className
          )}
        />
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 scrollbar-thin scrollbar-thumb-slate-200">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((cat, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(cat)}
                className="w-full text-left px-5 py-3 text-sm font-bold text-slate-800 hover:bg-green-50 hover:text-green-800 transition-colors border-none"
              >
                {cat}
              </button>
            ))
          ) : (
            <div className="px-5 py-4 text-xs font-semibold text-slate-500 italic">
              No matching skill categories found. Custom value "{inputValue}" will be used.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ThumbnailSelectorProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

const ThumbnailSelector: React.FC<ThumbnailSelectorProps> = ({
  value,
  onChange,
  className = ""
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>(value.startsWith('http') && !value.includes('course-materials-trileza') ? 'link' : 'upload');
  const [uploading, setUploading] = useState(false);
  const [linkInput, setLinkInput] = useState(value.startsWith('http') ? value : '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) {
      setLinkInput('');
    } else if (value.startsWith('http')) {
      setLinkInput(value);
    }
  }, [value]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data, error } = await executeWithAutoRefresh(() =>
        nexus.storage
          .from('course-materials-trileza-784bc328')
          .uploadAuto(file)
      );

      if (error) throw error;
      if (data?.url) {
        onChange(data.url);
      }
    } catch (err) {
      console.error('Thumbnail upload failed:', err);
      alert('Upload failed: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleLinkChange = (val: string) => {
    setLinkInput(val);
    onChange(val);
  };

  const handleRemove = () => {
    onChange('');
    setLinkInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={cn(
            "h-10 px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none flex items-center gap-1.5",
            activeTab === 'upload'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          )}
        >
          <Upload size={13} /> Upload File
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('link')}
          className={cn(
            "h-10 px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none flex items-center gap-1.5",
            activeTab === 'link'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          )}
        >
          <Link2 size={13} /> Paste Link
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div className="space-y-3">
          {value && value.startsWith('http') ? (
            <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 aspect-[16/9] max-w-sm flex items-center justify-center shadow-inner group">
              <img
                src={value}
                alt="Course Thumbnail"
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800';
                }}
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-3 right-3 w-8 h-8 bg-rose-600 rounded-full flex items-center justify-center text-white hover:bg-rose-700 transition-colors shadow-lg border-none animate-in fade-in zoom-in-50 duration-200"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <label className="block aspect-[16/9] max-w-sm rounded-2xl bg-slate-50 border-2 border-dashed border-slate-350 hover:border-green-500 hover:bg-green-50/5 cursor-pointer transition-all relative overflow-hidden group">
              {uploading ? (
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                    <div className="absolute inset-0 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                    <Image size={24} className="text-green-600 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-800">Uploading Thumbnail...</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Syncing with Nexus Storage</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-white border border-slate-200 group-hover:bg-green-50 group-hover:border-green-150 rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <Upload size={20} className="text-slate-500 group-hover:text-green-600 transition-colors" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-sm font-black text-slate-700 group-hover:text-green-800">Select image file</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">PNG, JPG, WEBP up to 5MB</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={linkInput}
              onChange={(e) => handleLinkChange(e.target.value)}
              placeholder="e.g. https://images.unsplash.com/photo-..."
              className="w-full h-12 bg-slate-50 rounded-xl pl-10 pr-4 text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
            />
            <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>

          {linkInput && (
            <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 aspect-[16/9] max-w-sm flex items-center justify-center shadow-inner group animate-in fade-in zoom-in-95 duration-200">
              <img
                src={linkInput}
                alt="Thumbnail Preview"
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800';
                }}
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-3 right-3 w-8 h-8 bg-rose-600 rounded-full flex items-center justify-center text-white hover:bg-rose-700 transition-colors shadow-lg border-none"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const emptyTopic = (n: number): Topic => ({
  id: `${Date.now()}-${n}`,
  title: '',
  objective: '',
  videoUrl: '',
  materials: [],
  liveSession: null,
  expanded: true,
});

// ─── Live Scheduler Modal ─────────────────────────────────────────────────────
const LiveScheduler = ({ session, onSave, onClose }: {
  session: LiveSession | null;
  onSave: (s: LiveSession) => void;
  onClose: () => void;
}) => {
  const [form, setForm] = useState<LiveSession>(
    session ?? { date: '', time: '', duration: '60', note: '' }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Schedule Live Class</h3>
              <p className="text-green-700 text-xs mt-1 font-black tracking-widest uppercase">Students will be notified automatically</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-5 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Date</label>
              <input type="date" value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full h-12 px-4 bg-white border border-slate-350 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Start Time</label>
              <input type="time" value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                className="w-full h-12 px-4 bg-white border border-slate-350 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {['30', '60', '90', '120'].map(d => (
                <button key={d} onClick={() => setForm({ ...form, duration: d })}
                  className={cn("h-11 rounded-xl text-sm font-black transition-all border",
                    form.duration === d
                      ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/15'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50')}>
                  {d}m
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex justify-between">
              <span>Session Note</span>
              <span className="text-slate-500 font-black">(optional)</span>
            </label>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
              rows={2} placeholder="e.g. Bring your laptop, live coding session..."
              className="w-full p-4 bg-white border border-slate-350 rounded-xl text-sm font-bold text-slate-805 outline-none resize-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all placeholder:text-slate-500" />
          </div>

          <button onClick={() => { onSave(form); onClose(); }}
            className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-600/20 mt-4 border-none">
            <Calendar size={18} /> Confirm Schedule
          </button>
        </div>
      </div>
    </div>
  );
};


// Local cache for signed preview URLs in the Course Builder
const builderSignedUrlCache: Record<string, string> = {};

const TopicCard = ({ topic, index, onChange, onRemove }: {
  topic: Topic; index: number;
  onChange: (t: Topic) => void; onRemove: () => void;
}) => {
  const { courseId } = useParams<{ courseId: string }>();
  const [showScheduler, setShowScheduler] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const materialInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState('');

  // Connect to the global background upload store
  const activeUploads = useUploadStore(state => state.activeUploads);
  const startUpload = useUploadStore(state => state.startUpload);
  const pauseUpload = useUploadStore(state => state.pauseUpload);
  const resumeUploadWithFile = useUploadStore(state => state.resumeUploadWithFile);
  const clearUpload = useUploadStore(state => state.clearUpload);

  const currentUpload = activeUploads[topic.id];
  const isInspecting = currentUpload?.status === 'inspecting';
  const isOptimizing = currentUpload?.status === 'optimizing';
  const isUploading = currentUpload?.status === 'uploading';
  const isPaused = currentUpload?.status === 'paused';
  const isFailed = currentUpload?.status === 'failed';
  const isProcessing = isInspecting || isOptimizing || isUploading;
  const uploadProgress = currentUpload?.progress ?? 0;
  const statusMessage = currentUpload?.statusMessage || (
    isInspecting ? 'Analyzing video format...' :
      isOptimizing ? 'Your video is being optimized for streaming — this may take a few minutes.' :
        isUploading ? 'Uploading to Bunny.net...' :
          isPaused ? 'Upload Paused' :
            isFailed ? 'Upload Failed' : ''
  );

  // Automatically merge completed uploads from the store
  useEffect(() => {
    if (currentUpload?.status === 'success' && currentUpload.videoUrl) {
      if (currentUpload.videoUrl !== topic.videoUrl) {
        set({ videoUrl: currentUpload.videoUrl });
        clearUpload(topic.id);
      }
    }
  }, [currentUpload, topic.videoUrl, topic.id, clearUpload]);

  useEffect(() => {
    if (topic.videoUrl && topic.videoUrl.includes('.m3u8')) {
      const parts = topic.videoUrl.split('/');
      const videoId = parts[parts.length - 2];

      if (builderSignedUrlCache[videoId]) {
        setPreviewUrl(builderSignedUrlCache[videoId]);
        return;
      }

      const fetchSignedUrl = async () => {
        try {
          const { data, error } = await nexus.functions.invoke('bunny-proxy', {
            body: { action: 'get-signed-url', payload: { videoId } }
          });
          if (!error && data?.data?.signedUrl) {
            builderSignedUrlCache[videoId] = data.data.signedUrl;
            setPreviewUrl(data.data.signedUrl);
          } else {
            setPreviewUrl(topic.videoUrl);
          }
        } catch (err) {
          console.error('Failed to get signed preview URL:', err);
          setPreviewUrl(topic.videoUrl);
        }
      };
      fetchSignedUrl();
    } else {
      setPreviewUrl(topic.videoUrl);
    }
  }, [topic.videoUrl]);

  const set = (patch: Partial<Topic>) => onChange({ ...topic, ...patch });

  const handleMaterialUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newMaterials: Material[] = Array.from(files).map(f => ({
      id: `${Date.now()}-${f.name}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(0)} KB`,
      type: f.name.endsWith('.pdf') ? 'pdf'
        : f.name.endsWith('.zip') ? 'zip'
          : f.name.endsWith('.doc') || f.name.endsWith('.docx') ? 'doc'
            : 'link',
    }));
    set({ materials: [...topic.materials, ...newMaterials] });
    e.target.value = '';
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!courseId) {
      alert('Course ID not found. Save the course details first.');
      return;
    }

    try {
      await startUpload({
        courseId,
        topicId: topic.id,
        file,
        onSuccess: (url) => {
          set({ videoUrl: url });
          clearUpload(topic.id);
        }
      });
    } catch (err) {
      console.error('Video processing or upload failed:', err);
      alert('Video pipeline error: ' + (err as Error).message);
    }
  };

  const typeColors: Record<string, string> = {
    pdf: 'bg-rose-600',
    zip: 'bg-amber-600',
    doc: 'bg-blue-600',
    link: 'bg-green-700',
  };

  return (
    <>
      {showScheduler && (
        <LiveScheduler
          session={topic.liveSession}
          onSave={s => set({ liveSession: s })}
          onClose={() => setShowScheduler(false)}
        />
      )}

      <div className="rounded-[2rem] overflow-hidden border-2 border-slate-250/70 bg-white shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border-b-2 border-slate-200">
          <GripVertical size={18} className="text-slate-500 cursor-grab shrink-0" />
          <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center text-xs font-black shrink-0">
            {String(index + 1).padStart(2, '0')}
          </div>
          <input
            value={topic.title}
            onChange={e => set({ title: e.target.value })}
            placeholder={`Topic ${index + 1}: Enter a title...`}
            className="flex-1 bg-transparent text-slate-900 font-black text-base outline-none placeholder:text-slate-500 min-w-0"
          />
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              topic.videoUrl ? "bg-green-100 text-green-800 border border-green-200" : "bg-slate-200 text-slate-700")}>
              {topic.videoUrl ? '✓ Video' : 'No Video'}
            </span>
            <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              topic.materials.length > 0 ? "bg-green-100 text-green-800 border border-green-200" : "bg-slate-200 text-slate-700")}>
              {topic.materials.length > 0 ? `✓ ${topic.materials.length} Files` : 'No Files'}
            </span>
            <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              topic.liveSession ? "bg-green-100 text-green-800 border border-green-200" : "bg-slate-200 text-slate-700")}>
              {topic.liveSession ? `✓ Live Set` : 'No Live'}
            </span>
          </div>
          <button onClick={() => setShowScheduler(true)}
            className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shrink-0 cursor-pointer">
            <Calendar size={13} />
            {topic.liveSession ? 'Edit Live' : '+ Schedule Live'}
          </button>
          <button onClick={onRemove} className="p-2 text-slate-500 hover:text-rose-600 transition-colors shrink-0 cursor-pointer">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white">
          <div className="p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Video size={13} className="text-green-600" /> Lecture Video
            </h4>

            {isProcessing || isPaused || isFailed ? (
              <div className="aspect-video rounded-2xl bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center space-y-3">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                  {isProcessing && (
                    <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  <span className="text-[10px] font-black text-emerald-400">{uploadProgress}%</span>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    {isInspecting ? 'Analyzing Format' :
                      isOptimizing ? 'Optimizing Video' :
                        isUploading ? 'Uploading Video' :
                          isPaused ? 'Upload Paused' :
                            'Upload Failed'}
                  </p>
                  <p className="text-[10px] text-slate-300 font-medium max-w-[220px] mx-auto mt-1 leading-snug">
                    {statusMessage}
                  </p>
                  <p className="text-[9px] text-slate-500 truncate max-w-[200px] mt-1">{currentUpload?.fileName}</p>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden max-w-[150px] mx-auto">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="flex items-center gap-2 pt-1 z-10">
                  {isUploading && (
                    <button
                      type="button"
                      onClick={() => pauseUpload(topic.id)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase tracking-wider rounded-lg border-none cursor-pointer text-slate-300"
                    >
                      Pause
                    </button>
                  )}
                  {isPaused && (
                    <label className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg border-none cursor-pointer text-white">
                      Resume
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) resumeUploadWithFile(topic.id, file);
                        }}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => clearUpload(topic.id)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-wider rounded-lg border-none cursor-pointer text-rose-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : topic.videoUrl ? (
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video shadow-inner flex flex-col">
                <div className="flex-1 min-h-0 relative">
                  <TrilezaVideoPlayer
                    src={previewUrl || topic.videoUrl}
                    title={topic.title || 'Lesson Video'}
                    autoPlay={false}
                  />
                </div>
                <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
                  <span className="text-[9px] text-slate-405 truncate max-w-[65%] font-mono text-slate-300">{topic.videoUrl}</span>
                  <button onClick={() => set({ videoUrl: '' })}
                    className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 hover:border-rose-500/40 rounded-lg text-[9px] font-black text-rose-400 transition-colors uppercase tracking-wider border-none cursor-pointer">
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const fakeEvent = { target: { files: e.dataTransfer.files } } as any;
                    handleVideoUpload(fakeEvent);
                  }
                }}
                className="block aspect-video rounded-2xl bg-slate-50 border-2 border-dashed border-slate-350 hover:border-green-500 hover:bg-green-50/10 cursor-pointer transition-all group relative overflow-hidden"
              >
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-white border border-slate-200 group-hover:bg-green-50 group-hover:border-green-150 rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <UploadCloud size={22} className="text-slate-500 group-hover:text-green-600 transition-colors" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-sm font-black text-slate-700 group-hover:text-green-800">Drag & Drop Video or Click</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-bold">Resumable TUS Upload (Bunny.net)</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
              </label>
            )}

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-black text-slate-500 uppercase">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <input
              value={topic.videoUrl.startsWith('http') ? topic.videoUrl : ''}
              onChange={e => set({ videoUrl: e.target.value })}
              placeholder="Paste play URL or standard link..."
              className="w-full h-11 px-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-800 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all"
            />
          </div>

          <div className="p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Paperclip size={13} className="text-green-600" /> Class Materials
            </h4>

            <div className="space-y-2 min-h-[100px]">
              {topic.materials.length === 0 ? (
                <div className="h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-250 flex flex-col items-center justify-center gap-2">
                  <Paperclip size={20} className="text-slate-400" />
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">No materials added yet</p>
                </div>
              ) : (
                topic.materials.map(mat => (
                  <div key={mat.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 group hover:border-slate-300 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0", typeColors[mat.type] || 'bg-slate-500')}>
                        {mat.type.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {mat.type === 'link' ? (
                          <input
                            value={mat.name}
                            placeholder="Link title (e.g. Documentation)"
                            onChange={e => {
                              const newMats = topic.materials.map(m => m.id === mat.id ? { ...m, name: e.target.value } : m);
                              set({ materials: newMats });
                            }}
                            className="text-xs font-black text-slate-800 bg-transparent border-b-2 border-slate-200 focus:border-green-500 outline-none w-full placeholder:text-slate-400"
                          />
                        ) : (
                          <p className="text-xs font-black text-slate-805 truncate">{mat.name}</p>
                        )}
                        {mat.size && <p className="text-[10px] text-slate-500 font-extrabold">{mat.size}</p>}
                      </div>
                      <button onClick={() => set({ materials: topic.materials.filter(m => m.id !== mat.id) })}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all shrink-0 border-none bg-transparent cursor-pointer">
                        <X size={14} />
                      </button>
                    </div>
                    {mat.type === 'link' && (
                      <input
                        value={mat.url || ''}
                        placeholder="https://..."
                        onChange={e => {
                          const newMats = topic.materials.map(m => m.id === mat.id ? { ...m, url: e.target.value } : m);
                          set({ materials: newMats });
                        }}
                        className="w-full text-[10px] p-2 bg-white border border-slate-250 rounded-lg outline-none focus:border-green-500 mt-1 font-bold text-slate-800"
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-205">
              <label className="h-11 bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all text-[10px] font-black uppercase tracking-widest shadow-sm">
                <Upload size={14} /> File
                <input
                  ref={materialInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.zip,.doc,.docx,.ppt,.pptx"
                  className="hidden"
                  onChange={handleMaterialUpload}
                />
              </label>
              <button
                onClick={() => set({ materials: [...topic.materials, { id: Date.now().toString(), name: '', type: 'link', url: '' }] })}
                className="h-11 bg-white border-2 border-slate-250 hover:border-green-500 hover:bg-green-50/10 text-slate-600 hover:text-green-700 rounded-xl flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest cursor-pointer"
              >
                <Paperclip size={14} /> Link
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Award size={13} className="text-green-600" /> Learning Objective
            </h4>

            <textarea
              value={topic.objective}
              onChange={e => set({ objective: e.target.value })}
              rows={4}
              placeholder="By the end of this topic, students will be able to..."
              className="w-full p-4 bg-slate-50 border-2 border-slate-250 rounded-2xl text-sm text-slate-800 font-bold outline-none resize-none focus:bg-white focus:border-green-500 transition-all placeholder:text-slate-500 leading-relaxed"
            />

            {topic.liveSession ? (
              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-2xl space-y-1 text-green-800 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-green-700 flex items-center gap-1">
                  <Calendar size={10} /> Live Class Confirmed
                </p>
                <p className="font-black text-base text-slate-900">
                  {topic.liveSession.date ? new Date(topic.liveSession.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                  {' '}at {topic.liveSession.time || '—'}
                </p>
                <p className="text-[11px] text-slate-600 flex items-center gap-1 font-black">
                  <Clock size={10} /> {topic.liveSession.duration} minutes
                </p>
                <div className="flex gap-2 mt-2 pt-1">
                  <button onClick={() => setShowScheduler(true)} className="flex-1 h-8 bg-white hover:bg-slate-100 border-2 border-slate-250 rounded-lg text-[10px] font-black text-slate-700 transition-colors cursor-pointer">Edit</button>
                  <button onClick={() => set({ liveSession: null })} className="flex-1 h-8 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-black text-rose-700 transition-colors cursor-pointer">Remove</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowScheduler(true)}
                className="w-full h-14 rounded-2xl border-2 border-dashed border-green-300 bg-green-50/20 hover:bg-green-50 hover:border-green-400 text-green-700 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Calendar size={16} /> Schedule Live Class
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Setup Modal ─────────────────────────────────────────────────────────────
const CourseSetupModal = ({ onSave, onClose }: { onSave: (title: string, desc: string, programType: 'mentorship' | 'professional') => void; onClose: () => void }) => {
  const [programType, setProgramType] = useState<'mentorship' | 'professional'>('professional');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl mx-4 overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-slate-50 border-b-2 border-slate-200 px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Create New Course</h3>
              <p className="text-green-700 text-xs mt-1 font-black tracking-widest uppercase">Choose your program structure &amp; Course Builder blueprint</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-550 hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6 bg-slate-50/50">
          {/* Option Selector: Mentorship Program vs Professional Course */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Program Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Mentorship Program */}
              <div
                onClick={() => setProgramType('mentorship')}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-3 group text-left hover:scale-[1.03] hover:border-green-600/40 hover:shadow-lg",
                  programType === 'mentorship'
                    ? "bg-white border-green-600 shadow-xl shadow-green-600/10 ring-4 ring-green-600/10"
                    : "bg-white border-slate-250 hover:border-green-600/60 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                    programType === 'mentorship' ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    <Users size={20} />
                  </div>
                  {programType === 'mentorship' && (
                    <CheckCircle size={16} className="text-green-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Mentorship Program</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">Cohort-based live guidance, 1-on-1 advice &amp; direct mentor reviews.</p>
                </div>
              </div>

              {/* Option 2: Professional Course */}
              <div
                onClick={() => setProgramType('professional')}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-3 group text-left hover:scale-[1.03] hover:border-green-600/40 hover:shadow-lg",
                  programType === 'professional'
                    ? "bg-white border-green-600 shadow-xl shadow-green-600/10 ring-4 ring-green-600/10"
                    : "bg-white border-slate-250 hover:border-green-600/60 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                    programType === 'professional' ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    <GraduationCap size={20} />
                  </div>
                  {programType === 'professional' && (
                    <CheckCircle size={16} className="text-green-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Professional Course</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">Self-paced video modules, structured curriculum &amp; certificates.</p>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => onSave('', '', programType)} 
            className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-600/20 mt-4 border-none cursor-pointer"
          >
            Create New Course <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

interface UploadModeSelectorProps {
  mode: 'one_by_one' | 'bulk';
  onSelectMode: (mode: 'one_by_one' | 'bulk') => void;
}

const UploadModeSelector: React.FC<UploadModeSelectorProps> = ({ mode, onSelectMode }) => {
  return (
    <div className="bg-slate-50 border-2 border-slate-250 p-6 rounded-[2.5rem] space-y-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 font-sans">
            <UploadCloud size={18} className="text-green-600" /> Select Video Upload Strategy
          </h4>
          <p className="text-xs font-bold text-slate-500 mt-1 font-sans">
            Choose your preferred upload method before adding videos to your course lessons.
          </p>
        </div>
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-black uppercase tracking-wider self-start sm:self-center border border-green-200">
          Resumable TUS Engine Enabled
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Container 1: Upload One by One */}
        <div
          onClick={() => onSelectMode('one_by_one')}
          className={cn(
            "p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative overflow-hidden",
            mode === 'one_by_one'
              ? "bg-white border-green-600 shadow-xl shadow-green-600/10 ring-4 ring-green-600/10"
              : "bg-white border-slate-250 hover:border-slate-400 hover:bg-slate-50/80"
          )}
        >
          <div className="flex items-start justify-between">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
              mode === 'one_by_one' ? "bg-green-600 text-white shadow-md" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
            )}>
              <Video size={24} />
            </div>
            {mode === 'one_by_one' ? (
              <span className="px-3 py-1 bg-green-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1 shadow-sm">
                <CheckCircle size={12} /> Selected Mode
              </span>
            ) : (
              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-full">
                Click to Select
              </span>
            )}
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 tracking-tight font-sans">
              Upload One by One
            </h5>
            <p className="text-xs font-bold text-slate-500 leading-relaxed font-sans">
              Upload videos one at a time. Best for careful review of each video.
            </p>
          </div>
          <div className="text-[10px] font-black uppercase tracking-wider text-green-700 font-sans pt-2 border-t border-slate-150">
            ✓ Step-by-step verification &amp; manual review
          </div>
        </div>

        {/* Container 2: Bulk Upload */}
        <div
          onClick={() => onSelectMode('bulk')}
          className={cn(
            "p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative overflow-hidden",
            mode === 'bulk'
              ? "bg-white border-green-600 shadow-xl shadow-green-600/10 ring-4 ring-green-600/10"
              : "bg-white border-slate-250 hover:border-slate-400 hover:bg-slate-50/80"
          )}
        >
          <div className="flex items-start justify-between">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
              mode === 'bulk' ? "bg-green-600 text-white shadow-md" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
            )}>
              <Layers size={24} />
            </div>
            {mode === 'bulk' ? (
              <span className="px-3 py-1 bg-green-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1 shadow-sm">
                <CheckCircle size={12} /> Selected Mode
              </span>
            ) : (
              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-full">
                Click to Select
              </span>
            )}
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 tracking-tight font-sans">
              Bulk Upload
            </h5>
            <p className="text-xs font-bold text-slate-500 leading-relaxed font-sans">
              Upload multiple videos at once. Best for batch uploading courses.
            </p>
          </div>
          <div className="text-[10px] font-black uppercase tracking-wider text-green-700 font-sans pt-2 border-t border-slate-150">
            ✓ Multi-video batch queue &amp; auto-lesson mapping
          </div>
        </div>
      </div>
    </div>
  );
};

const BatchVideoDropzone: React.FC<{
  onFilesSelected: (files: FileList | File[]) => void;
}> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "p-8 rounded-[2rem] border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group mb-6",
        isDragging
          ? "border-green-500 bg-green-50/50 scale-[1.01]"
          : "border-slate-300 hover:border-green-500 bg-slate-50/50 hover:bg-green-50/20"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,.mp4,.mov,.webm,.avi,.mkv"
        className="hidden"
        onChange={(e) => e.target.files && onFilesSelected(e.target.files)}
      />
      <div className="w-16 h-16 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
        <UploadCloud size={32} />
      </div>
      <div>
        <h4 className="text-base font-black text-slate-900 tracking-tight font-sans">
          Batch Drag & Drop Multiple Lesson Videos
        </h4>
        <p className="text-xs font-bold text-slate-500 max-w-md mx-auto mt-1 font-sans">
          Select or drop multiple video files at once. Each video automatically becomes a lesson with TUS background uploading.
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-100/80 px-4 py-1.5 rounded-full font-sans">
        <Video size={13} /> Multiple Video Batch Upload Enabled
      </div>
    </div>
  );
};

// ─── Main Builder ─────────────────────────────────────────────────────────────
const CourseBuilder = ({ onBack }: { onBack: () => void }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const initUploads = useUploadStore(state => state.initUploads);

  useEffect(() => {
    initUploads();
  }, [initUploads]);

  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('English');
  const [duration, setDuration] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [priceStandard, setPriceStandard] = useState('');
  const [accessPeriod, setAccessPeriod] = useState('Lifetime');
  const [certificationAvailable, setCertificationAvailable] = useState(false);
  const [refundPolicy, setRefundPolicy] = useState('No refund policy specified.');
  const [tags, setTags] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);
  const [topics, setTopics] = useState<Topic[]>([emptyTopic(1)]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editStep, setEditStep] = useState<'curriculum' | 'summary' | 'deployed'>('curriculum');
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Initialize from Nexus if courseId exists
  React.useEffect(() => {
    if (courseId && courseId !== 'new') {
      const fetchCourse = async () => {
        setLoading(true);
        try {
          const fullCourse = await courseService.getFullCourse(courseId);
          setCourseTitle(fullCourse.title || '');
          setCourseDesc(fullCourse.description || '');
          setThumbnailUrl(fullCourse.thumbnail_url || '');
          setTrailerUrl(fullCourse.trailer_url || '');
          setCategory(fullCourse.category || '');
          setLanguage(fullCourse.language || 'English');
          setDuration(fullCourse.duration || '');
          setLearningObjectives(Array.isArray(fullCourse.learning_objectives) ? fullCourse.learning_objectives.join('\n') : '');
          setPrerequisites(Array.isArray(fullCourse.prerequisites) ? fullCourse.prerequisites.join('\n') : (fullCourse.prerequisites || ''));
          setLevel(fullCourse.level || 'Beginner');
          setPriceStandard(fullCourse.price_standard ? fullCourse.price_standard.toString() : '');
          setAccessPeriod(fullCourse.access_period || 'Lifetime');
          setCertificationAvailable(fullCourse.certification_available || false);
          setRefundPolicy(fullCourse.refund_policy || 'No refund policy specified.');
          setTags(Array.isArray(fullCourse.tags) ? fullCourse.tags.join(', ') : '');
          setMaterials(fullCourse.materials || []);
          // Fetch live sessions
          const { data: liveSessions } = await nexus.database
            .from('live_sessions')
            .select('*')
            .eq('course_id', courseId);

          setTopics(fullCourse.modules.map((m: any) => {
            const videoLesson = m.lessons?.find((l: any) => l.type === 'video');
            const materialLessons = m.lessons?.filter((l: any) => l.type !== 'video') || [];
            const liveSession = liveSessions?.find((s: any) => s.title === `Live Class: ${m.title}`);

            let mappedLive = null;
            if (liveSession && liveSession.scheduled_at) {
              const d = new Date(liveSession.scheduled_at);
              const dateStr = d.toISOString().split('T')[0];
              const timeStr = d.toTimeString().split(' ')[0].substring(0, 5);
              mappedLive = {
                date: dateStr,
                time: timeStr,
                duration: '60',
                note: ''
              };
            }

            return {
              id: m.id,
              title: m.title,
              objective: m.objective || '',
              videoUrl: videoLesson?.content_url || '',
              materials: materialLessons.map((l: any) => ({
                id: l.id,
                name: l.title,
                type: l.type === 'pdf' ? 'pdf' : l.type === 'zip' ? 'zip' : 'link',
                url: l.content_url || ''
              })),
              liveSession: mappedLive,
              expanded: false
            };
          }));
        } catch (err) {
          console.error('Failed to fetch course:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchCourse();
      setEditStep('curriculum');
    } else {
      // Clear form states completely when building a new course or leaving the builder
      setCourseTitle('');
      setCourseDesc('');
      setThumbnailUrl('');
      setTrailerUrl('');
      setCategory('');
      setLanguage('English');
      setDuration('');
      setLearningObjectives('');
      setPrerequisites('');
      setLevel('Beginner');
      setPriceStandard('');
      setAccessPeriod('Lifetime');
      setCertificationAvailable(false);
      setRefundPolicy('No refund policy specified.');
      setTags('');
      setMaterials([]);
      setWizardStep(1);
      setEditStep('curriculum');
      if (!courseTitle) {
        setShowSetup(true);
      }
    }
  }, [courseId]);

  const startBulkUpload = useUploadStore(state => state.startBulkUpload);
  const clearUpload = useUploadStore(state => state.clearUpload);
  const [uploadMode, setUploadMode] = useState<'one_by_one' | 'bulk'>('one_by_one');

  const handleBatchVideoUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|avi|webm|mkv)$/i)
    );
    if (fileArray.length === 0) return;

    let activeId = courseId;
    if (!activeId || activeId === 'new') {
      activeId = `temp-${Date.now()}`;
    }

    // Filter out initial empty topic if blank
    const currentTopics = topics.filter(t => t.title.trim() !== '' || t.videoUrl !== '');

    const newItems: Array<{ topicId: string; file: File }> = [];
    const updatedTopics: Topic[] = [...currentTopics];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const topicId = `topic-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

      const newTopic: Topic = {
        id: topicId,
        title: cleanTitle,
        objective: '',
        videoUrl: '',
        materials: [],
        liveSession: null,
        expanded: true
      };
      updatedTopics.push(newTopic);
      newItems.push({ topicId, file });
    }

    setTopics(updatedTopics);

    // Queue bulk video processing
    startBulkUpload({
      courseId: activeId,
      items: newItems,
      onItemSuccess: (topicId, url) => {
        setTopics(prev => prev.map(t => t.id === topicId ? { ...t, videoUrl: url } : t));
        clearUpload(topicId);
      }
    });
  };

  // Load tutor's course list if courseId is undefined (Index View)
  React.useEffect(() => {
    if (!courseId && user) {
      const fetchTutorCourses = async () => {
        setLoadingList(true);
        try {
          const list = await courseService.getTutorCourses(user.id);
          // Fetch course reviews to find their review statuses
          const { data: reviews } = await nexus.database
            .from('course_reviews')
            .select('course_id, status')
            .eq('submitted_by', user.id);

          const reviewMap = new Map(reviews?.map(r => [r.course_id, r.status]) || []);
          const updatedList = list.map(c => ({
            ...c,
            reviewStatus: reviewMap.get(c.id) || null
          }));
          setCoursesList(updatedList);
        } catch (err) {
          console.error('Error fetching tutor courses:', err);
        } finally {
          setLoadingList(false);
        }
      };
      fetchTutorCourses();
    }
  }, [courseId, user]);

  if (loading) {
    return <LoadingOverlay message="Loading Blueprint" submessage="Retrieving course builder blueprint from Nexus..." />;
  }

  const addTopic = () => setTopics(prev => [...prev, emptyTopic(prev.length + 1)]);
  const updateTopic = (id: string, t: Topic) => setTopics(prev => prev.map(p => p.id === id ? t : p));
  const removeTopic = (id: string) => setTopics(prev => prev.filter(p => p.id !== id));

  const videosAdded = topics.filter(t => t.videoUrl).length;
  const livesSet = topics.filter(t => t.liveSession).length;

  const handleSave = async (publish = false): Promise<boolean> => {
    if (!user || !courseId) return false;
    if (!courseTitle) {
      alert('Please enter a course title');
      return false;
    }

    if (publish) {
      if (!courseTitle.trim() || !courseDesc.trim()) {
        alert('Please fill out Course Title and Description before publishing.');
        return false;
      }
      if (topics.length === 0 || topics.some(t => !t.title)) {
        alert('Please provide at least one topic lesson with a valid title.');
        return false;
      }
    }

    setIsSaving(true);
    try {
      // 1. Update Course details unconditionally
      await courseService.updateCourse(courseId, {
        title: courseTitle,
        description: courseDesc,
        thumbnail_url: thumbnailUrl,
        trailer_url: trailerUrl || null,
        category: category || null,
        language,
        duration,
        learning_objectives: learningObjectives.split('\n').filter(s => s.trim()),
        prerequisites: prerequisites.split('\n').filter(s => s.trim()) as any,
        level,
        price_standard: Number(priceStandard) || 0,
        access_period: accessPeriod,
        certification_available: certificationAvailable,
        refund_policy: refundPolicy,
        tags: tags ? tags.split(',').map(s => s.trim()).filter(s => s) as any : [],
        materials: materials as any,
        status: 'draft', // Hardcode to 'draft' so it remains hidden until approved!
      });

      // 2. Save Curriculum (Modules, Lessons, Materials, Live Sessions)
      await courseService.saveCurriculum(courseId, topics, user.id);

      // Reload topics with permanent database IDs
      const fullCourse = await courseService.getFullCourse(courseId);
      const { data: liveSessions } = await nexus.database
        .from('live_sessions')
        .select('*')
        .eq('course_id', courseId);

      setTopics(fullCourse.modules.map((m: any) => {
        const videoLesson = m.lessons?.find((l: any) => l.type === 'video');
        const materialLessons = m.lessons?.filter((l: any) => l.type !== 'video') || [];
        const liveSession = liveSessions?.find((s: any) => s.title === `Live Class: ${m.title}`);

        let mappedLive = null;
        if (liveSession && liveSession.scheduled_at) {
          const d = new Date(liveSession.scheduled_at);
          const dateStr = d.toISOString().split('T')[0];
          const timeStr = d.toTimeString().split(' ')[0].substring(0, 5);
          mappedLive = {
            date: dateStr,
            time: timeStr,
            duration: '60',
            note: ''
          };
        }

        return {
          id: m.id,
          title: m.title,
          objective: m.objective || '',
          videoUrl: videoLesson?.content_url || '',
          materials: materialLessons.map((l: any) => ({
            id: l.id,
            name: l.title,
            type: l.type === 'pdf' ? 'pdf' : l.type === 'zip' ? 'zip' : 'link',
            url: l.content_url || ''
          })),
          liveSession: mappedLive,
          expanded: false
        };
      }));

      // 3. Register/Update Review if deploying
      if (publish) {
        // Check if review exists
        const { data: existingReview } = await nexus.database
          .from('course_reviews')
          .select('id')
          .eq('course_id', courseId)
          .maybeSingle();

        if (existingReview) {
          await nexus.database
            .from('course_reviews')
            .update({
              status: 'pending',
              checklist_title: false,
              checklist_description: false,
              checklist_curriculum: false,
              checklist_video: false,
              checklist_audio: false,
              checklist_thumbnail: false,
              checklist_no_copyright: false,
              notes: null,
              submitted_at: new Date().toISOString()
            })
            .eq('id', existingReview.id);
        } else {
          await nexus.database
            .from('course_reviews')
            .insert([{
              course_id: courseId,
              submitted_by: user.id,
              status: 'pending',
              checklist_title: false,
              checklist_description: false,
              checklist_curriculum: false,
              checklist_video: false,
              checklist_audio: false,
              checklist_thumbnail: false,
              checklist_no_copyright: false
            }]);
        }

        // Hot-reload course catalogs
        window.dispatchEvent(new Event('trileza-course-published'));
      }

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return true;
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save course. Check console for details.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!user) return;

    // Verification of required fields for the 4-step workflow
    if (!courseTitle.trim() || !courseDesc.trim()) {
      alert('Please fill out the Course Title and Description in Step 1 before publishing.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Create course entry
      const newCourse = await courseService.createCourse(user.id, courseTitle);

      // 2. Update with all fields and set published status
      await courseService.updateCourse(newCourse.id, {
        title: courseTitle,
        description: courseDesc,
        thumbnail_url: thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
        trailer_url: trailerUrl || null,
        category: category || 'General',
        language: language || 'English',
        duration: duration || `${topics.length * 30} mins`,
        learning_objectives: learningObjectives ? learningObjectives.split('\n').filter(s => s.trim()) : ['Master core concepts'],
        prerequisites: prerequisites ? prerequisites.split('\n').filter(s => s.trim()) as any : [],
        level: level || 'Beginner',
        price_standard: Number(priceStandard) || 0,
        access_period: accessPeriod || 'Lifetime',
        certification_available: certificationAvailable,
        refund_policy: refundPolicy || 'Standard policy',
        tags: tags ? tags.split(',').map(s => s.trim()).filter(s => s) as any : [],
        materials: [],
        status: 'published',
      });

      // 3. Save topics & lessons curriculum created in Step 3
      if (topics.length > 0) {
        await courseService.saveCurriculum(newCourse.id, topics, user.id);
      }

      // 4. Register review as approved/published so it appears on catalog
      await nexus.database
        .from('course_reviews')
        .insert([{
          course_id: newCourse.id,
          submitted_by: user.id,
          status: 'approved',
          checklist_title: true,
          checklist_description: true,
          checklist_curriculum: true,
          checklist_video: true,
          checklist_audio: true,
          checklist_thumbnail: true,
          checklist_no_copyright: true
        }]);

      window.dispatchEvent(new Event('trileza-course-published'));

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        navigate('/tutor/courses', { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error('Failed to create course:', err);
      const msg = err?.message || String(err);
      if (msg.includes('Invalid token') || msg.includes('JWT expired') || msg.includes('Unauthorized')) {
        await useAuthStore.getState().syncProfile();
        alert('Session synchronized. Please click Publish again.');
      } else {
        alert('Failed to publish course. Please try again: ' + msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ─── View: Course Index (No CourseId) ───
  if (!courseId) {
    return (
      <div className="w-full pb-24 space-y-8 animate-in fade-in duration-500 font-sans course-page-container">
        {/* Soft elegant gray banner with green elements */}
        <PageHeader
          title="Course Builder"
          description="Manage your published programs and build new learning experiences."
          tag="COURSE BUILDER"
          icon={GraduationCap}
          rightContent={
            <Button onClick={() => navigate('/tutor/courses/new')} className="bg-orange-500 hover:bg-orange-600 text-white border-none rounded-xl px-5 h-11 font-bold text-sm shadow-lg shadow-orange-600/25 flex items-center gap-2">
              <Plus size={16} /> Build New Course
            </Button>
          }
        />

        {loadingList ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-slate-100 rounded-[2rem] h-[200px] border border-slate-200" />
            ))}
          </div>
        ) : coursesList.length === 0 ? (
          <div className="p-16 text-center rounded-[2.5rem] border-2 border-dashed border-green-200 bg-[#f0fdf4]/35 max-w-md mx-auto space-y-5">
            <div className="w-16 h-16 bg-[#dcfce7] rounded-3xl flex items-center justify-center mx-auto text-green-600">
              <BookOpen size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No course blueprints yet</h3>
            <p className="text-slate-550 text-sm leading-relaxed max-w-xs mx-auto">Establish your mentor space by initiating your first program blueprint.</p>
            <button
              onClick={() => navigate('/tutor/courses/new')}
              className="bg-green-600 hover:bg-green-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-green-600/15 transition-all border-none"
            >
              Start First Blueprint &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coursesList.map((course) => {
              const thumbnailSrc = course.thumbnail_url || course.thumbnail;
              return (
                <div
                  key={course.id}
                  onClick={() => navigate(`/tutor/courses/${course.id}`)}
                  className="bg-white border-2 border-slate-250/70 hover:border-green-400 rounded-[2rem] p-5 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col justify-between overflow-hidden relative"
                >
                  <div>
                    {/* Course Thumbnail Image Box */}
                    <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-4 bg-slate-100 border border-slate-200 shadow-inner group-hover:shadow-md transition-all">
                      {thumbnailSrc ? (
                        <img 
                          src={thumbnailSrc} 
                          alt={course.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-150 text-slate-400">
                          <BookOpen size={36} />
                          <span className="text-[10px] font-black uppercase tracking-widest mt-2 text-slate-400">No Thumbnail</span>
                        </div>
                      )}

                      {/* Review Status Badge */}
                      <div className="absolute top-3 right-3">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm backdrop-blur-md",
                          course.reviewStatus === 'approved' || course.status === 'published'
                            ? "bg-green-600/90 text-white border-green-500"
                            : course.reviewStatus === 'pending_deletion' || course.status === 'pending_deletion'
                              ? "bg-red-600/90 text-white border-red-500"
                              : course.reviewStatus === 'pending'
                                ? "bg-blue-600/90 text-white border-blue-500"
                                : course.reviewStatus === 'needs_changes'
                                  ? "bg-amber-500/90 text-white border-amber-400"
                                  : course.reviewStatus === 'rejected'
                                    ? "bg-rose-600/90 text-white border-rose-500"
                                    : "bg-slate-800/80 text-white border-slate-700"
                        )}>
                          {course.reviewStatus ? `review: ${course.reviewStatus.replace('_', ' ')}` : (course.status || 'draft')}
                        </span>
                      </div>

                      {/* Delete Course Icon Button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!user?.id) return;
                          if (!window.confirm(`Are you sure you want to request deletion of "${course.title}"? An admin will review and approve the request.`)) return;

                          try {
                            const { error: courseErr } = await nexus.database
                              .from('courses')
                              .update({ status: 'pending_deletion' })
                              .eq('id', course.id);

                            if (courseErr) throw courseErr;

                            const { data: existingReview } = await nexus.database
                              .from('course_reviews')
                              .select('id')
                              .eq('course_id', course.id)
                              .maybeSingle();

                            if (existingReview) {
                              await nexus.database
                                .from('course_reviews')
                                .update({ status: 'pending_deletion', submitted_at: new Date().toISOString() })
                                .eq('id', existingReview.id);
                            } else {
                              await nexus.database
                                .from('course_reviews')
                                .insert([{
                                  course_id: course.id,
                                  submitted_by: user.id,
                                  status: 'pending_deletion',
                                  submitted_at: new Date().toISOString()
                                }]);
                            }

                            alert('Course deletion requested! It is now pending admin review & approval.');
                            setCoursesList(prev => prev.map(c => c.id === course.id ? { ...c, status: 'pending_deletion', reviewStatus: 'pending_deletion' } : c));
                          } catch (err: any) {
                            console.error('Failed to request deletion:', err);
                            alert('Failed to request deletion: ' + (err.message || err));
                          }
                        }}
                        className="absolute top-3 left-3 p-2 rounded-xl bg-slate-950/75 hover:bg-red-600 text-white transition-all shadow-md border border-white/20 cursor-pointer flex items-center justify-center opacity-85 hover:opacity-100"
                        title="Delete Course (Requires Admin Approval)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <h3 className="font-black text-lg text-slate-900 group-hover:text-green-700 transition-colors leading-tight line-clamp-2 px-1">
                      {course.title}
                    </h3>
                  </div>

                  <div className="mt-4 pt-3 border-t-2 border-slate-100 flex items-center justify-between text-xs font-black text-slate-550 px-1">
                    <span>{course.enrolled_count || 0} Enrolled Students</span>
                    <span className="group-hover:translate-x-1 transition-transform text-slate-700 group-hover:text-green-700 flex items-center gap-1">
                      Edit Blueprint &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── View: Immersive Step-by-Step Creation Wizard ───
  if (courseId === 'new') {
    const isStep1Valid = !!courseTitle.trim() && !!courseDesc.trim();
    const isStep2Valid = true;
    const isStep3Valid = topics.length > 0;
    const isStep4Valid = isStep1Valid && isStep3Valid;

    return (
      <div className="max-w-5xl mx-auto pb-24 space-y-8 animate-in fade-in duration-500 font-sans course-page-container">
        {showSetup && (
          <CourseSetupModal 
            onSave={(t, d, pType) => {
              setCourseTitle(t);
              setCourseDesc(d);
              if (pType === 'mentorship') {
                setCategory('Mentorship Program');
              } else {
                setCategory('Software Engineering');
              }
              setShowSetup(false);
            }} 
            onClose={() => {
              setShowSetup(false);
              if (!courseTitle) navigate('/tutor/courses');
            }} 
          />
        )}

        {/* Wizard Header Banner */}
        <PageHeader
          title="Create New Course Blueprint"
          description="Build your course in 4 easy steps: Choose Program Type & Details, Thumbnail, Lessons & Video Uploads, then Preview and Publish."
          tag="STREAMLINED COURSE BUILDER"
          icon={Sparkles}
          rightContent={
            <Button onClick={() => navigate('/tutor/courses')} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl px-5 h-11 font-bold text-sm shadow-sm flex items-center gap-2">
              <ChevronLeft size={16} /> Dashboard
            </Button>
          }
        />

        {/* 4-Step Timeline Tracker */}
        <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-6 shadow-sm">
          <div className="flex items-center justify-between relative px-2">
            {/* Background progress line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
            <div
              className="absolute top-1/2 left-0 h-1 bg-green-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500"
              style={{ width: `${((wizardStep - 1) / 3) * 100}%` }}
            />

            {[
              { step: 1, label: '1. Basic Details', icon: Globe },
              { step: 2, label: '2. Thumbnail', icon: Image },
              { step: 3, label: '3. Lessons & Videos', icon: Video },
              { step: 4, label: '4. Preview & Publish', icon: Sparkles },
            ].map((s) => {
              const Icon = s.icon;
              const isActive = wizardStep === s.step;
              const isCompleted = wizardStep > s.step;

              return (
                <div key={s.step} className="flex flex-col items-center relative z-10">
                  <button
                    onClick={() => {
                      if (s.step < wizardStep) setWizardStep(s.step);
                      else if (s.step === 2 && isStep1Valid) setWizardStep(2);
                      else if (s.step === 3 && isStep1Valid) setWizardStep(3);
                      else if (s.step === 4 && isStep1Valid) setWizardStep(4);
                    }}
                    disabled={s.step > wizardStep && !isStep1Valid}
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 cursor-pointer",
                      isActive
                        ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-110"
                        : isCompleted
                          ? "bg-green-600 border-green-600 text-white"
                          : "bg-white border-slate-250 text-slate-400 cursor-not-allowed hover:border-slate-350"
                    )}
                  >
                    {isCompleted ? <CheckCircle size={18} /> : <Icon size={18} />}
                  </button>
                  <span className={cn(
                    "text-[11px] font-black uppercase tracking-wider mt-2.5",
                    isActive ? "text-slate-900 font-bold" : "text-slate-400"
                  )}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Step Panels */}
        <div className="bg-white border-2 border-slate-205 rounded-[2.5rem] p-8 md:p-12 shadow-sm min-h-[400px] flex flex-col justify-between">
          <div className="space-y-8 animate-in fade-in duration-300">

            {/* STEP 1: Basic Details */}
            {wizardStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight font-sans">Step 1: Course Basic Details</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1 font-sans">Enter the course title, description, category, level, and pricing.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-600 block font-sans">Course Title *</label>
                    <input
                      value={courseTitle}
                      onChange={e => setCourseTitle(e.target.value)}
                      placeholder="e.g. Full-Stack Web Architecture & AI Engineering"
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all border border-slate-250 font-sans"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-600 block font-sans">Category</label>
                    <CategoryAutocomplete value={category} onChange={setCategory} />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-600 block font-sans">Short Description *</label>
                    <textarea
                      value={courseDesc}
                      onChange={e => setCourseDesc(e.target.value)}
                      rows={4}
                      placeholder="Give a clear summary of what mentees will learn and accomplish."
                      className="w-full p-4 bg-slate-50 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all border border-slate-250 resize-none leading-relaxed font-sans"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-600 block font-sans">Target Level *</label>
                    <select
                      value={level}
                      onChange={e => setLevel(e.target.value)}
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="All Levels">All Levels</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-600 block font-sans">Course Price ({user?.country === 'Nigeria' ? 'NGN' : 'USD'}) *</label>
                    <input
                      type="number"
                      value={priceStandard}
                      onChange={e => setPriceStandard(e.target.value)}
                      placeholder="0.00 (Enter 0 for Free Course)"
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Upload Thumbnail */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight font-sans">Step 2: Upload Course Thumbnail</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1 font-sans">Drag and drop or select a high-quality cover image for your course.</p>
                </div>

                <div className="p-6 bg-slate-50 border-2 border-slate-200 rounded-[2rem]">
                  <ThumbnailSelector value={thumbnailUrl} onChange={setThumbnailUrl} />
                </div>
              </div>
            )}

            {/* STEP 3: Add Lessons & Video Modules */}
            {wizardStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight font-sans">Step 3: Add Lessons &amp; Video Modules</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1 font-sans">Select your upload method below, then upload your course videos with automatic Bunny.net optimization &amp; resumable streaming.</p>
                </div>

                {/* Upload Mode Selector (One by One vs Bulk Upload) */}
                <UploadModeSelector mode={uploadMode} onSelectMode={setUploadMode} />

                {/* Batch Multi-Video Upload Dropzone (Visible when Bulk Upload is selected) */}
                {uploadMode === 'bulk' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <BatchVideoDropzone onFilesSelected={handleBatchVideoUpload} />
                  </div>
                )}

                {/* Topic / Lesson List */}
                <div className="space-y-4">
                  {topics.map((t, idx) => (
                    <TopicCard
                      key={t.id}
                      topic={t}
                      index={idx}
                      onChange={updated => setTopics(topics.map(tp => tp.id === t.id ? updated : tp))}
                      onRemove={() => setTopics(topics.filter(tp => tp.id !== t.id))}
                    />
                  ))}
                  <button
                    onClick={() => setTopics([...topics, emptyTopic(topics.length + 1)])}
                    className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-green-500 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-600 hover:text-green-700 transition-all flex items-center justify-center gap-2 bg-slate-50/50 hover:bg-green-50/20 cursor-pointer"
                  >
                    <Plus size={16} /> Add Another Lesson / Topic
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Preview & Publish */}
            {wizardStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight font-sans">Step 4: Preview & Publish</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1 font-sans">Review your course summary and publish it to the student marketplace.</p>
                </div>

                <div className="bg-slate-50 border-2 border-slate-200 rounded-[2rem] p-6 space-y-6">
                  {/* Course Card Preview */}
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-full md:w-64 h-40 rounded-2xl overflow-hidden bg-slate-900 shrink-0 border border-slate-200">
                      <img
                        src={thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-[10px] font-black uppercase tracking-wider">
                          {category || 'General'}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                          {level}
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-slate-900">{courseTitle || 'Untitled Course'}</h2>
                      <p className="text-xs text-slate-600 leading-relaxed">{courseDesc || 'No description provided.'}</p>
                      <div className="flex items-center gap-4 text-xs font-black text-slate-700 pt-2">
                        <span>Price: {Number(priceStandard) > 0 ? `$${priceStandard}` : 'FREE'}</span>
                        <span>•</span>
                        <span>{topics.length} Lessons</span>
                        <span>•</span>
                        <span>{topics.filter(t => t.videoUrl).length} Videos Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t-2 border-slate-100 pt-8 mt-12 gap-4">
            <button
              onClick={() => {
                if (wizardStep > 1) setWizardStep(wizardStep - 1);
                else navigate('/tutor/courses');
              }}
              className="h-14 px-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black transition-all flex items-center gap-2 border border-slate-250 shadow-sm font-sans cursor-pointer"
            >
              <ChevronLeft size={18} /> {wizardStep === 1 ? 'Cancel' : 'Back'}
            </button>

            {wizardStep < 4 ? (
              <button
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={wizardStep === 1 && !isStep1Valid}
                className="h-14 px-8 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-green-600/10 disabled:opacity-50 disabled:cursor-not-allowed border-none font-sans cursor-pointer"
              >
                Next Step <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleCreateCourse}
                disabled={isSaving || !isStep4Valid}
                className="h-14 px-8 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed border-none font-sans cursor-pointer"
              >
                {isSaving ? 'Publishing Course...' : 'Publish Course Now'} <Award size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── View: Atelier (Builder) ───
  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6 animate-in fade-in duration-500 relative font-sans course-page-container">
      {/* Premium Toast */}
      {showToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-500">
          <div className="bg-slate-900 shadow-2xl rounded-2xl px-8 py-5 flex items-center gap-4 text-white border border-slate-800">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="font-bold text-lg leading-none">Course Successfully Synced!</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">Trileza Engine Confirmed</p>
            </div>
          </div>
        </div>
      )}

      {/* Atelier Header */}
      {editStep !== 'deployed' && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border-2 border-slate-250/70 p-8 md:p-12 rounded-[2.5rem] shadow-sm relative overflow-hidden mb-2">
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-green-200 rounded-full blur-[100px] opacity-25" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => navigate('/tutor/courses')} className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-all border-none"><ChevronLeft size={16} className="text-slate-700" /></button>
              <span className="text-green-700 font-black tracking-[0.2em] uppercase text-xs">Content Creator Mode</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2">{courseTitle || 'Untitled Blueprint'}</h1>
            {courseDesc && <p className="text-slate-655 font-bold text-sm max-w-2xl">{courseDesc}</p>}
          </div>
        </div>
      )}

      {/* CURRICULUM STEP */}
      {editStep === 'curriculum' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Topics', value: topics.length, icon: FileText, bg: 'bg-slate-100 text-slate-700 border-2 border-slate-250' },
              { label: 'Videos Added', value: `${videosAdded} / ${topics.length}`, icon: Video, bg: 'bg-green-50 text-green-705 border border-green-200' },
              { label: 'Live Classes', value: livesSet, icon: Calendar, bg: 'bg-green-50 text-green-705 border border-green-200' },
            ].map(s => (
              <div key={s.label} className="bg-white border-2 border-slate-250/70 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                  <s.icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{s.value}</p>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Upload Strategy Mode Selector (One by One vs Bulk) */}
          <UploadModeSelector mode={uploadMode} onSelectMode={setUploadMode} />

          {/* Batch Multi-Video Upload Dropzone (Visible when Bulk Upload is selected) */}
          {uploadMode === 'bulk' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <BatchVideoDropzone onFilesSelected={handleBatchVideoUpload} />
            </div>
          )}

          {/* Curriculum */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-slate-500 text-sm uppercase tracking-widest">
                Curriculum Structure
              </h2>
            </div>
            {topics.map((t, i) => (
              <TopicCard key={t.id} topic={t} index={i}
                onChange={updated => updateTopic(t.id, updated)}
                onRemove={() => removeTopic(t.id)} />
            ))}
          </div>

          {/* Add Topic */}
          <button onClick={addTopic}
            className="w-full h-16 rounded-[2rem] border-2 border-dashed border-green-300 bg-green-50/10 hover:bg-green-50 hover:border-green-400 text-green-700 font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer">
            <Plus size={18} /> Add New Topic Module
          </button>

          {/* Bottom Actions for Curriculum Step */}
          <div className="mt-8 bg-white border-2 border-slate-250/70 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div>
              <h3 className="font-black text-xl text-slate-900">Synchronize Course Draft</h3>
              <p className="text-slate-655 font-bold text-sm mt-1">Save your draft progress or proceed to review your summary before deployment.</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 h-14 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black transition-all border-2 border-slate-250 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
              >
                {isSaving ? 'Processing...' : <Save size={16} />} Save Draft
              </button>
              <button
                onClick={async () => {
                  const success = await handleSave(false);
                  if (success) setEditStep('summary');
                }}
                disabled={isSaving}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest shadow-lg shadow-green-600/15 transition-all disabled:opacity-50 cursor-pointer text-xs"
              >
                Review Summary &amp; Deploy <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY STEP */}
      {editStep === 'summary' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex items-center justify-between bg-slate-50 border-2 border-slate-250/70 p-6 rounded-[2rem] shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Final Step</span>
              <h2 className="text-xl font-black text-slate-905 tracking-tight uppercase">Review Course Summary</h2>
            </div>
            <button
              onClick={() => setEditStep('curriculum')}
              className="h-11 px-5 rounded-xl border-2 border-slate-250 hover:border-slate-400 bg-white text-slate-700 font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
            >
              <ChevronLeft size={14} /> Back to Curriculum
            </button>
          </div>

          <div className="bg-white border-2 border-slate-250/70 rounded-[2.5rem] overflow-hidden shadow-sm">
            {/* Visual Course Card Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-slate-150">
              <div className="aspect-video md:aspect-auto bg-slate-950 relative overflow-hidden flex items-center justify-center min-h-[220px]">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="Preview" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <Image className="text-slate-700 w-16 h-16" />
                )}
                {trailerUrl && (
                  <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="absolute w-14 h-14 bg-white/20 hover:bg-white/35 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-lg hover:scale-110">
                    <PlayCircle size={28} />
                  </a>
                )}
              </div>
              <div className="p-8 md:col-span-2 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-green-50 text-green-705 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-200">{category || 'Uncategorized'}</span>
                    <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 border-slate-250">{level}</span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">{courseTitle || 'Untitled Blueprint'}</h2>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest flex items-center gap-1.5"><Globe size={12} /> Taught in {language} • {duration || 'No duration specified'}</p>
                </div>
                <div className="flex items-baseline gap-2 pt-4 border-t border-slate-150">
                  <span className="text-3xl font-black text-slate-900">
                    {Number(priceStandard) === 0 ? 'FREE' : `${user?.country === 'Nigeria' ? '₦' : '$'}${Number(priceStandard).toLocaleString()}`}
                  </span>
                  {Number(priceStandard) > 0 && <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest font-sans">Base price ({user?.country === 'Nigeria' ? 'NGN' : 'USD'})</span>}
                </div>
              </div>
            </div>

            {/* Two-Column Detail View */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 md:p-12">
              <div className="md:col-span-2 space-y-8">
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-450">Program Overview</h4>
                  <p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-line">{courseDesc || 'No description provided.'}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-450">What you will learn</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {learningObjectives ? learningObjectives.split('\n').filter(o => o.trim()).map((obj, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs font-bold text-slate-750">
                        <CheckCircle size={14} className="text-green-600 mt-0.5 shrink-0" />
                        <span>{obj}</span>
                      </div>
                    )) : <p className="text-xs text-slate-450 font-bold">No learning outcomes listed.</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-450">Course Prerequisites</h4>
                  <ul className="space-y-2">
                    {prerequisites ? prerequisites.split('\n').filter(p => p.trim()).map((prereq, i) => (
                      <li key={i} className="text-xs font-bold text-slate-750 flex items-center gap-2">
                        <Target size={12} className="text-slate-400" /> {prereq}
                      </li>
                    )) : <p className="text-xs text-slate-450 font-bold">No prerequisites listed.</p>}
                  </ul>
                </div>
              </div>

              {/* Sidebar Program Details */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-[2rem] p-6 space-y-6 self-start">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-550">Launch Checklist</h4>
                <div className="space-y-4 text-xs font-bold text-slate-750">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Curriculum Modules</span>
                    <span className="font-black text-slate-900">{topics.length} Modules</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Video Content</span>
                    <span className="font-black text-slate-900">{videosAdded} Modules mapped</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Live Class Sessions</span>
                    <span className="font-black text-slate-900">{livesSet} Sessions scheduled</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Access Type</span>
                    <span className="font-black text-slate-900">{accessPeriod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Completion Certificate</span>
                    <span className="font-black text-slate-900">{certificationAvailable ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between pt-4 border-t border-slate-200">
                    <span className="text-slate-400">Refund Policy</span>
                    <span className="font-black text-slate-900 text-right max-w-[150px] truncate" title={refundPolicy}>{refundPolicy}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Launch Preview curriculum accordion outline */}
          <div className="bg-white border-2 border-slate-250/70 rounded-[2.5rem] p-8 md:p-12 space-y-6 shadow-sm">
            <h3 className="font-black text-xl text-slate-900 tracking-tight">Curriculum Preview</h3>
            <div className="space-y-3">
              {topics.map((t, idx) => (
                <div key={t.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-250 flex items-center justify-center font-black text-xs text-slate-500">{idx + 1}</div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">{t.title || 'Untitled Module'}</h4>
                      {t.objective && <p className="text-[10px] text-slate-500 font-bold mt-0.5">{t.objective}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.videoUrl && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">VIDEO</span>}
                    {t.materials.length > 0 && <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">{t.materials.length} MATS</span>}
                    {t.liveSession && <span className="bg-[#eff6ff] text-[#1e40af] px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">LIVE</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Actions for Summary Step */}
          <div className="mt-8 bg-white border-2 border-slate-250/70 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div>
              <h3 className="font-black text-xl text-slate-900">Authorize Trileza Deployment</h3>
              <p className="text-slate-655 font-bold text-sm mt-1">Once deployed, this course becomes active and visible on the public student registry.</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              {courseId && (
                <button
                  onClick={async () => {
                    if (!window.confirm(`Are you sure you want to request deletion of "${courseTitle || 'this course'}"? An admin will review and approve your request.`)) return;
                    setIsSaving(true);
                    try {
                      const { error: courseErr } = await nexus.database
                        .from('courses')
                        .update({ status: 'pending_deletion' })
                        .eq('id', courseId);
                      if (courseErr) throw courseErr;

                      const { data: existingReview } = await nexus.database
                        .from('course_reviews')
                        .select('id')
                        .eq('course_id', courseId)
                        .maybeSingle();

                      if (existingReview) {
                        await nexus.database
                          .from('course_reviews')
                          .update({ status: 'pending_deletion', submitted_at: new Date().toISOString() })
                          .eq('id', existingReview.id);
                      } else {
                        await nexus.database
                          .from('course_reviews')
                          .insert([{
                            course_id: courseId,
                            submitted_by: user!.id,
                            status: 'pending_deletion',
                            submitted_at: new Date().toISOString()
                          }]);
                      }

                      alert('Course deletion requested! It is now pending admin review & approval.');
                      onBack();
                    } catch (err: any) {
                      console.error('Failed to request course deletion:', err);
                      alert('Failed to request deletion: ' + (err.message || err));
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 h-14 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-black transition-all border-2 border-red-200 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
                  title="Request admin approval to delete this course"
                >
                  <Trash2 size={16} /> Request Deletion
                </button>
              )}
              <button
                onClick={() => setEditStep('curriculum')}
                disabled={isSaving}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 h-14 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black transition-all border-2 border-slate-250 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
              >
                Edit Curriculum
              </button>
              <button
                onClick={async () => {
                  const success = await handleSave(true);
                  if (success) setEditStep('deployed');
                }}
                disabled={isSaving}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest shadow-xl shadow-green-600/20 transition-all disabled:opacity-50 cursor-pointer text-xs"
              >
                Deploy Course <Award size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEPLOYED SUCCESS STEP */}
      {editStep === 'deployed' && (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-white border-2 border-slate-200/80 rounded-[3rem] p-12 text-center shadow-xl relative overflow-hidden flex flex-col items-center">
            {/* Soft ambient background glows */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-green-200 rounded-full blur-[120px] opacity-30" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-200 rounded-full blur-[120px] opacity-35" />

            {/* Glowing success badge animation */}
            <div className="relative w-24 h-24 flex items-center justify-center mb-8">
              <div className="absolute inset-0 bg-green-150 rounded-full animate-ping opacity-25 duration-1000" />
              <div className="absolute -inset-2 bg-green-50 rounded-full border border-green-200/40" />
              <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-green-600/30 relative z-10">
                <CheckCircle size={40} className="animate-bounce" />
              </div>
            </div>

            <div className="space-y-4 max-w-lg z-10 relative">
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-700 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-150">Awaiting Review</span>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight pt-2">Submitted for Review!</h2>
              <p className="text-slate-500 font-bold text-base leading-relaxed">Your course blueprint has been successfully compiled and submitted to Content Managers for review. Mentees will be able to discover and enroll in your program once approved.</p>
            </div>

            {/* Deployed Course Miniature Card Preview */}
            <div className="w-full max-w-md bg-slate-50/70 border-2 border-slate-200 rounded-[2rem] p-5 flex items-center gap-4 mt-10 hover:border-green-405 hover:shadow-md transition-all duration-300 group z-10 relative">
              <div className="w-20 h-20 bg-slate-950 rounded-2xl overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt={courseTitle} className="w-full h-full object-cover" />
                ) : (
                  <Image className="text-slate-500 w-8 h-8" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-green-750 bg-green-100/50 px-2 py-0.5 rounded border border-green-200">{category || 'Technology'}</span>
                <h4 className="font-black text-slate-900 text-base truncate mt-1 group-hover:text-green-700 transition-colors">{courseTitle || 'Untitled Program'}</h4>
                <p className="text-[10px] text-slate-505 font-bold uppercase tracking-wider mt-0.5">{topics.length} Curriculum Modules • {user?.country === 'Nigeria' ? '₦' : '$'}{Number(priceStandard).toLocaleString()}</p>
              </div>
            </div>

            {/* Beautiful Quick Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md mt-10 z-10 relative">
              <button
                onClick={() => navigate('/courses')}
                className="h-14 bg-slate-900 hover:bg-slate-950 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-slate-900/10 border-none cursor-pointer"
              >
                <Globe size={15} /> View in Library
              </button>
              <button
                onClick={() => navigate('/tutor/courses')}
                className="h-14 bg-white border-2 border-slate-250 hover:border-slate-400 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Layers size={15} /> Manage Courses
              </button>
              <button
                onClick={() => setEditStep('curriculum')}
                className="h-12 bg-transparent text-slate-450 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest transition-colors border-none sm:col-span-2 text-center mt-2 cursor-pointer"
              >
                &larr; Revise Course Curriculum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseBuilder;
