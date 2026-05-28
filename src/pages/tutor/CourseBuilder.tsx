import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, Trash2, Video, FileText,
  Calendar, Upload, Save, Award, PlayCircle,
  GripVertical, X, CheckCircle, Paperclip, Clock, ChevronRight,
  Globe, Target, Sparkles, BookOpen, Search, Link2, Image,
  Settings, Layers
} from 'lucide-react';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { courseService } from '../../lib/services/courses';
import { LoadingOverlay } from '../../components/shared';
import { nexus } from '../../lib/nexus';

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
      const { data, error } = await nexus.storage
        .from('course-materials-trileza-784bc328')
        .uploadAuto(file);

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
          <Upload size={13} strokeWidth={2.5} /> Upload File
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
          <Link2 size={13} strokeWidth={2.5} /> Paste Link
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
              <X size={16} strokeWidth={3} />
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
            <Calendar size={18} strokeWidth={2.5} /> Confirm Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Topic Card ───────────────────────────────────────────────────────────────
const TopicCard = ({ topic, index, onChange, onRemove }: {
  topic: Topic; index: number;
  onChange: (t: Topic) => void; onRemove: () => void;
}) => {
  const [showScheduler, setShowScheduler] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const materialInputRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Topic>) => onChange({ ...topic, ...patch });

  // Real file upload handler for materials
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
    e.target.value = ''; // reset
  };

  // Video file handler
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) set({ videoUrl: file.name });
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
        {/* ── Topic Header ── */}
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

          {/* Status Badges */}
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
            className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shrink-0">
            <Calendar size={13} />
            {topic.liveSession ? 'Edit Live' : '+ Schedule Live'}
          </button>
          <button onClick={onRemove} className="p-2 text-slate-500 hover:text-rose-600 transition-colors shrink-0">
            <Trash2 size={16} />
          </button>
        </div>

        {/* ── Topic Body ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white">

          {/* Column 1: Video */}
          <div className="p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Video size={13} className="text-green-600" /> Lecture Video
            </h4>

            {topic.videoUrl ? (
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video shadow-inner">
                <div className="absolute inset-0 flex items-center justify-center">
                  <PlayCircle className="text-white opacity-90" size={36} />
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white text-[10px] font-bold truncate">{topic.videoUrl}</p>
                </div>
                <button onClick={() => set({ videoUrl: '' })}
                  className="absolute top-2 right-2 w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center text-white hover:bg-rose-700 transition-colors">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <label className="block aspect-video rounded-2xl bg-slate-50 border-2 border-dashed border-slate-350 hover:border-green-500 hover:bg-green-50/10 cursor-pointer transition-all group">
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-white border border-slate-200 group-hover:bg-green-50 group-hover:border-green-150 rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <Upload size={20} className="text-slate-500 group-hover:text-green-600 transition-colors" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-sm font-black text-slate-700 group-hover:text-green-800">Upload Video</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-bold">MP4, MOV, AVI</p>
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
              value={topic.videoUrl.startsWith('local') ? '' : topic.videoUrl}
              onChange={e => set({ videoUrl: e.target.value })}
              placeholder="Paste YouTube / Vimeo link..."
              className="w-full h-11 px-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-800 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all"
            />
          </div>

          {/* Column 2: Materials */}
          <div className="p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Paperclip size={13} className="text-green-600" /> Class Materials
            </h4>

            {/* Uploaded files list */}
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
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all shrink-0">
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

            {/* Selection Area: Either/Or */}
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
                 className="h-11 bg-white border-2 border-slate-250 hover:border-green-500 hover:bg-green-50/10 text-slate-600 hover:text-green-700 rounded-xl flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest"
               >
                  <Paperclip size={14} /> Link
               </button>
            </div>
          </div>

          {/* Column 3: Objective + Live */}
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
                  <button onClick={() => setShowScheduler(true)} className="flex-1 h-8 bg-white hover:bg-slate-100 border-2 border-slate-250 rounded-lg text-[10px] font-black text-slate-700 transition-colors">Edit</button>
                  <button onClick={() => set({ liveSession: null })} className="flex-1 h-8 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-black text-rose-700 transition-colors">Remove</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowScheduler(true)}
                className="w-full h-14 rounded-2xl border-2 border-dashed border-green-300 bg-green-50/20 hover:bg-green-50 hover:border-green-400 text-green-700 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
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
const CourseSetupModal = ({ onSave, onClose }: { onSave: (title: string, desc: string) => void; onClose: () => void }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-slate-50 border-b-2 border-slate-200 px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Course Architecture Setup</h3>
              <p className="text-green-700 text-xs mt-1 font-black tracking-widest uppercase">Define the blueprint</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-550 hover:bg-slate-200 transition-colors">
              <X size={16} strokeWidth={3} />
            </button>
          </div>
        </div>
        <div className="p-8 space-y-5 bg-slate-50/50">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Course Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Advanced Agentic AI" className="w-full h-12 px-4 bg-white border-2 border-slate-300 rounded-xl text-sm font-black text-slate-850 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Short Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="What will mentees learn..." className="w-full p-4 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none resize-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all" />
          </div>
          <button onClick={() => { if(title) onSave(title, desc); }} className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-600/20 mt-4 border-none">
            Enter Course Atelier <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Builder ─────────────────────────────────────────────────────────────
const CourseBuilder = ({ onBack }: { onBack: () => void }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
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
          setTopics(fullCourse.modules.map((m: any) => ({
            id: m.id,
            title: m.title,
            objective: m.objective || '',
            videoUrl: '', // To be implemented with storage
            materials: [], // To be implemented with storage
            liveSession: null, // To be implemented with liveSessions table
            expanded: false
          })));
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
      setTopics([emptyTopic(1)]);
      setWizardStep(1);
      setEditStep('curriculum');
    }
  }, [courseId]);

  // Load tutor's course list if courseId is undefined (Index View)
  React.useEffect(() => {
    if (!courseId && user) {
      const fetchTutorCourses = async () => {
        setLoadingList(true);
        try {
          const list = await courseService.getTutorCourses(user.id);
          setCoursesList(list);
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
    return <LoadingOverlay message="Loading Blueprint" submessage="Retrieving course architecture from Nexus..." />;
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
      if (!courseTitle || !courseDesc || !language || !level || !duration || !priceStandard || !accessPeriod || !refundPolicy || !learningObjectives || !prerequisites || !thumbnailUrl) {
        alert('Please fill out all required fields marked with * before publishing.');
        return false;
      }
      if (topics.length === 0 || topics.some(t => !t.title)) {
        alert('Please provide at least one topic module with a valid title.');
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
        status: publish ? 'published' : 'draft',
      });

      // 2. Save Modules (Topics)
      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        if (topic.id.includes('-') && courseId) {
          await courseService.addModule(courseId, topic.title, i);
        }
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
    
    // Final verification of required fields
    if (!courseTitle.trim() || !courseDesc.trim() || !thumbnailUrl.trim() ||
        !language.trim() || !duration.trim() || !level.trim() || !accessPeriod.trim() ||
        !priceStandard.trim() || isNaN(Number(priceStandard)) || !refundPolicy.trim() ||
        !learningObjectives.trim() || !prerequisites.trim()) {
      alert('Please fill out all required fields before creating the course.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Create skeleton
      const newCourse = await courseService.createCourse(user.id, courseTitle);
      
      // 2. Unconditionally update with all wizard fields as draft
      await courseService.updateCourse(newCourse.id, {
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
        materials: [],
        status: 'draft',
      });

      // 3. Add a default module so they have a starting point in their curriculum
      await courseService.addModule(newCourse.id, 'Module 1: Introduction', 0);

      // Reset wizard step
      setWizardStep(1);
      
      // 4. Navigate to the newly created course!
      navigate(`/tutor/courses/${newCourse.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to create course blueprint:', err);
      alert('Failed to initialize course blueprint. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── View: Course Index (No CourseId) ───
  if (!courseId) {
    return (
      <div className="max-w-7xl mx-auto pb-24 space-y-8 animate-in fade-in duration-500 font-sans">
        {/* Soft elegant gray banner with green elements */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border-2 border-slate-250/70 p-8 md:p-12 rounded-[2.5rem] shadow-sm relative overflow-hidden">
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-green-200 rounded-full blur-[100px] opacity-25" />
          <div className="relative z-10 space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Course Architect</h1>
            <p className="text-slate-655 font-bold max-w-xl text-lg mt-2">Manage your published programs and build new learning experiences.</p>
          </div>
          <button onClick={() => navigate('/tutor/courses/new')} className="relative z-10 bg-green-600 hover:bg-green-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-green-600/15 flex items-center gap-2 transition-all border-none">
            <Plus size={20} /> Build New Course
          </button>
        </div>

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
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">Establish your mentor node by initiating your first program blueprint.</p>
            <button 
              onClick={() => navigate('/tutor/courses/new')}
              className="bg-green-600 hover:bg-green-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-green-600/15 transition-all border-none"
            >
              Start First Blueprint &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coursesList.map((course) => (
              <div 
                key={course.id} 
                onClick={() => navigate(`/tutor/courses/${course.id}`)} 
                className="bg-white border-2 border-slate-250/70 hover:border-green-405 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[200px]"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-slate-50 group-hover:bg-green-50 text-slate-500 group-hover:text-green-700 rounded-xl flex items-center justify-center transition-all border-2 border-slate-200 shadow-inner">
                      <FileText size={24}/>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      course.status === 'published' 
                        ? "bg-green-100 text-green-800 border-green-200" 
                        : "bg-amber-100 text-amber-800 border-amber-200"
                    )}>
                      {course.status}
                    </span>
                  </div>
                  <h3 className="font-black text-xl text-slate-900 group-hover:text-green-700 transition-colors leading-tight line-clamp-2">{course.title}</h3>
                </div>
                <div className="mt-4 pt-4 border-t-2 border-slate-150 flex items-center justify-between text-xs font-black text-slate-550">
                  <span>{course.enrolled_count || 0} Enrolled Students</span>
                  <span className="group-hover:translate-x-1 transition-transform text-slate-700 group-hover:text-green-700">Edit Blueprint &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── View: Immersive Step-by-Step Creation Wizard ───
  if (courseId === 'new') {
    const isStep1Valid = !!courseTitle.trim() && !!courseDesc.trim() && !!thumbnailUrl.trim();
    const isStep2Valid = !!language.trim() && !!duration.trim() && !!level.trim() && !!accessPeriod.trim();
    const isStep3Valid = !!priceStandard.trim() && !isNaN(Number(priceStandard)) && !!refundPolicy.trim();
    const isStep4Valid = !!learningObjectives.trim() && !!prerequisites.trim();

    return (
      <div className="max-w-4xl mx-auto pb-24 space-y-8 animate-in fade-in duration-500 font-sans">
        {/* Wizard Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 border border-slate-800 p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-green-500 rounded-full blur-[100px] opacity-10" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-green-400 rounded-full blur-[100px] opacity-10" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2 text-green-400 font-black tracking-widest text-xs uppercase mb-1">
              <Sparkles size={14} /> New Course Architect
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Create Course Blueprint</h1>
            <p className="text-slate-400 font-medium max-w-xl text-sm">Provide the foundational metadata before entering the curriculum atelier. All fields marked with * are required.</p>
          </div>
          <button onClick={() => navigate('/tutor/courses')} className="relative z-10 h-11 px-5 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white font-bold flex items-center gap-2 transition-all border-none font-sans">
            <ChevronLeft size={16} /> Dashboard
          </button>
        </div>

        {/* Premium Timeline Tracker */}
        <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-6 shadow-sm">
          <div className="flex items-center justify-between relative px-2">
            {/* Background progress line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
            <div 
              className="absolute top-1/2 left-0 h-1 bg-green-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500" 
              style={{ width: `${((wizardStep - 1) / 3) * 100}%` }}
            />

            {[
              { step: 1, label: 'Identity', icon: Globe },
              { step: 2, label: 'Specs', icon: Clock },
              { step: 3, label: 'Finance & Policies', icon: Award },
              { step: 4, label: 'Pedagogy', icon: Target },
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
                      else if (s.step === 3 && isStep1Valid && isStep2Valid) setWizardStep(3);
                      else if (s.step === 4 && isStep1Valid && isStep2Valid && isStep3Valid) setWizardStep(4);
                    }}
                    disabled={s.step > wizardStep}
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300",
                      isActive 
                        ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-110"
                        : isCompleted
                          ? "bg-green-600 border-green-600 text-white"
                          : "bg-white border-slate-250 text-slate-400 cursor-not-allowed hover:border-slate-350"
                    )}
                  >
                    {isCompleted ? <CheckCircle size={18} strokeWidth={3} /> : <Icon size={18} />}
                  </button>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider mt-2.5",
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
            {wizardStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-905 tracking-tight font-sans">Step 1: Course Identity & Story</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1 font-sans">Introduce your program with an arresting title, clear description, and thumbnail.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-550 block font-sans">Course Title *</label>
                    <input
                      value={courseTitle}
                      onChange={e => setCourseTitle(e.target.value)}
                      placeholder="e.g. Advanced Agentic AI Architecture"
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all border border-slate-250 font-sans"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Category</label>
                    <CategoryAutocomplete value={category} onChange={setCategory} />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Short Description *</label>
                    <textarea
                      value={courseDesc}
                      onChange={e => setCourseDesc(e.target.value)}
                      rows={4}
                      placeholder="Give a compelling summary of what the course covers, who it is for, and why they should enroll."
                      className="w-full p-4 bg-slate-50 rounded-xl text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all border border-slate-250 resize-none leading-relaxed font-sans"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Thumbnail Image *</label>
                    <ThumbnailSelector value={thumbnailUrl} onChange={setThumbnailUrl} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Tags / Keywords <span className="text-[10px] text-slate-400 normal-case">(optional)</span></label>
                    <input
                      value={tags}
                      onChange={e => setTags(e.target.value)}
                      placeholder="react, web, artificial intelligence"
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    />
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-905 tracking-tight font-sans">Step 2: Course Specs & Pedagogy</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1 font-sans">Specify technical requirements, duration, and accessibility details.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Language *</label>
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-905 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Skill Level *</label>
                    <select
                      value={level}
                      onChange={e => setLevel(e.target.value)}
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-905 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Expert">Expert</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Total Duration *</label>
                    <input
                      value={duration}
                      onChange={e => setDuration(e.target.value)}
                      placeholder="e.g. 15 hours 45 mins"
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-905 placeholder:text-slate-550 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Access Period *</label>
                    <select
                      value={accessPeriod}
                      onChange={e => setAccessPeriod(e.target.value)}
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-905 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    >
                      <option value="Lifetime">Lifetime</option>
                      <option value="1 Year">1 Year</option>
                      <option value="6 Months">6 Months</option>
                      <option value="3 Months">3 Months</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-905 tracking-tight font-sans">Step 3: Financials & Policy</h3>
                  <p className="text-xs text-slate-550 font-bold mt-1 font-sans">Configure standard pricing, certificates, refund logic, and borrowing options.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Base Price ({user?.country === 'Nigeria' ? 'NGN' : 'USD'}) *</label>
                    <input
                      type="number"
                      value={priceStandard}
                      onChange={e => setPriceStandard(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    />
                    <p className="text-[10px] font-bold text-green-600 mt-1 uppercase tracking-widest font-sans">{user?.country === 'Nigeria' ? 'Regional PPP applied in NGN' : 'Regional Tiered Pricing will be automatically calculated.'}</p>
                  </div>
                  
                  <div className="space-y-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl md:col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 font-sans">Provide Certification? *</h4>
                        <p className="text-[10px] font-bold text-slate-500 font-sans">Mentees receive a verifiable certificate upon completion.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={certificationAvailable} onChange={e => setCertificationAvailable(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </div>
                    
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Refund Policy *</label>
                    <textarea
                      value={refundPolicy}
                      onChange={e => setRefundPolicy(e.target.value)}
                      rows={3}
                      placeholder="e.g. 100% refund within 14 days if course progress is under 10%."
                      className="w-full p-4 bg-slate-50 rounded-xl text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 resize-none leading-relaxed font-sans"
                    />
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-905 tracking-tight font-sans">Step 4: Pedagogy & Outcomes</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1 font-sans">Define learning objectives, requirements, and promotional media.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block flex justify-between font-sans">
                      <span>Learning Outcomes *</span>
                      <span className="text-[10px] text-slate-400 normal-case font-sans">(One outcome per line)</span>
                    </label>
                    <textarea
                      value={learningObjectives}
                      onChange={e => setLearningObjectives(e.target.value)}
                      rows={3}
                      placeholder="By the end of this course, students will build a custom agentic pipeline...&#10;Understand system level orchestration..."
                      className="w-full p-4 bg-slate-50 rounded-xl text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 resize-none leading-relaxed font-sans"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block flex justify-between font-sans">
                      <span>Course Prerequisites *</span>
                      <span className="text-[10px] text-slate-400 normal-case font-sans">(One prerequisite per line)</span>
                    </label>
                    <textarea
                      value={prerequisites}
                      onChange={e => setPrerequisites(e.target.value)}
                      rows={3}
                      placeholder="Basic familiarity with JavaScript or Python.&#10;Foundational knowledge of relational databases."
                      className="w-full p-4 bg-slate-50 rounded-xl text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 resize-none leading-relaxed font-sans"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-555 block font-sans">Promotional Trailer Video URL <span className="text-[10px] text-slate-400 normal-case">(optional)</span></label>
                    <input
                      value={trailerUrl}
                      onChange={e => setTrailerUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-905 placeholder:text-slate-500 outline-none focus:bg-white focus:border-green-500 transition-all border border-slate-250 font-sans"
                    />
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
              className="h-14 px-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black transition-all flex items-center gap-2 border border-slate-250 shadow-sm font-sans"
            >
              <ChevronLeft size={18} /> {wizardStep === 1 ? 'Cancel' : 'Back'}
            </button>

            {wizardStep < 4 ? (
              <button
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={
                  (wizardStep === 1 && !isStep1Valid) ||
                  (wizardStep === 2 && !isStep2Valid) ||
                  (wizardStep === 3 && !isStep3Valid)
                }
                className="h-14 px-8 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-green-600/10 disabled:opacity-50 disabled:cursor-not-allowed border-none font-sans"
              >
                Next Step <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleCreateCourse}
                disabled={isSaving || !isStep4Valid}
                className="h-14 px-8 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed border-none font-sans"
              >
                {isSaving ? 'Engrafting Blueprint...' : 'Create Course & Enter Atelier'} <Award size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── View: Atelier (Builder) ───
  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6 animate-in fade-in duration-500 relative font-sans">
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
              <h3 className="font-black text-xl text-slate-900">Synchronize Draft Architecture</h3>
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
                <CheckCircle size={40} strokeWidth={2.5} className="animate-bounce" />
              </div>
            </div>

            <div className="space-y-4 max-w-lg z-10 relative">
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-green-700 bg-green-50 px-4 py-1.5 rounded-full border border-green-150">Engine Active</span>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight pt-2">Course Successfully Deployed!</h2>
              <p className="text-slate-500 font-bold text-base leading-relaxed">Your course blueprint has been successfully compiled and deployed to the Trileza Public Network. Mentees can now discover and enroll in your program.</p>
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
