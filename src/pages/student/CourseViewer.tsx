import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Play, 
  BookOpen, 
  Download,
  Link as LinkIcon,
  ChevronLeft,
  CheckCircle,
  FileText,
  Clock,
  CheckCircle2,
  HelpCircle,
  Video,
  Award,
  BookMarked
} from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { LoadingOverlay } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';
import { enrollmentService } from '../../lib/services/enrollments';
import { courseService } from '../../lib/services/courses';
import { cn } from '../../utils';
import type { Enrollment } from '../../lib/database.types';
import { nexus } from '../../lib/nexus';
import { TrilezaVideoPlayer } from '../../components/shared';

const CourseViewer = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  
  // Active course full details
  const [activeCourse, setActiveCourse] = useState<any | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [activeLesson, setActiveLesson] = useState<any | null>(null);
  const [completingLesson, setCompletingLesson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playbackUrl, setPlaybackUrl] = useState<string>('');
  const [loadingPlayback, setLoadingPlayback] = useState<boolean>(false);

  // Load course details when enrollment is selected
  const handleSelectEnrollment = async (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setLoadingCourse(true);
    setError(null);
    try {
      const fullCourse = await courseService.getFullCourse(enrollment.item_id);
      setActiveCourse(fullCourse);
      
      // Default to first lesson of first module
      if (fullCourse.modules && fullCourse.modules.length > 0) {
        const firstModule = fullCourse.modules[0];
        if (firstModule.lessons && firstModule.lessons.length > 0) {
          setActiveLesson(firstModule.lessons[0]);
        } else {
          setActiveLesson(null);
        }
      } else {
        setActiveLesson(null);
      }
    } catch (err) {
      console.error('Error fetching course curriculum:', err);
      setError('Failed to retrieve course lessons. Please try again.');
    } finally {
      setLoadingCourse(false);
    }
  };

  const fetchEnrollments = async () => {
    try {
      setLoadingList(true);
      const data = await enrollmentService.getUserEnrollments(user!.id);
      // Filter only course type enrollments
      const courseEnrollments = data.filter((e) => e.item_type === 'course');
      setEnrollments(courseEnrollments);

      // Auto-select course if courseId is passed in search query param
      const courseId = searchParams.get('courseId');
      if (courseId) {
        const matchingEnrollment = courseEnrollments.find(e => e.item_id === courseId);
        if (matchingEnrollment) {
          handleSelectEnrollment(matchingEnrollment);
        }
      }
    } catch (err) {
      console.error('Error fetching enrollments:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // Signed URL cache — avoids re-fetching for already-resolved video IDs
  const signedUrlCache = useRef<Record<string, string>>({});

  // Extract Bunny video ID from a playlist.m3u8 URL
  const extractVideoId = (url: string): string | null => {
    if (!url || !url.includes('.m3u8')) return null;
    const parts = url.split('/');
    // URL pattern: https://{pullZone}/{videoId}/playlist.m3u8
    const m3u8Idx = parts.findIndex(p => p.includes('.m3u8'));
    return m3u8Idx > 0 ? parts[m3u8Idx - 1] : null;
  };

  // Fetch a signed playback URL from the bunny-proxy function
  const fetchSignedUrl = async (videoId: string): Promise<string> => {
    // Return from cache if available
    if (signedUrlCache.current[videoId]) return signedUrlCache.current[videoId];
    try {
      const { data, error } = await nexus.functions.invoke('bunny-proxy', {
        body: { action: 'get-signed-url', payload: { videoId } }
      });
      if (!error && data?.data?.signedUrl) {
        signedUrlCache.current[videoId] = data.data.signedUrl;
        return data.data.signedUrl;
      }
    } catch (err) {
      console.error('Failed to get signed URL for', videoId, err);
    }
    // Fallback: return the original URL (will likely 403 but better than nothing)
    return '';
  };

  // Pre-fetch signed URLs for ALL video lessons when the course loads
  useEffect(() => {
    if (!activeCourse?.modules) return;
    const videoLessons: { id: string; contentUrl: string }[] = [];
    for (const mod of activeCourse.modules) {
      for (const lesson of mod.lessons || []) {
        if (lesson.type === 'video' && lesson.content_url?.includes('.m3u8')) {
          const videoId = extractVideoId(lesson.content_url);
          if (videoId && !signedUrlCache.current[videoId]) {
            videoLessons.push({ id: videoId, contentUrl: lesson.content_url });
          }
        }
      }
    }
    // Fire all fetches in parallel (non-blocking)
    videoLessons.forEach(v => fetchSignedUrl(v.id));
  }, [activeCourse]);

  // Resolve playback URL when activeLesson changes
  useEffect(() => {
    if (!activeLesson || activeLesson.type !== 'video' || !activeLesson.content_url) {
      setPlaybackUrl('');
      setLoadingPlayback(false);
      return;
    }

    const videoId = extractVideoId(activeLesson.content_url);
    if (!videoId) {
      // Non-HLS video — use directly
      setPlaybackUrl(activeLesson.content_url);
      setLoadingPlayback(false);
      return;
    }

    // Direct HLS playlist URL format for Bunny Stream:
    // https://vz-5d94ab2c-5c7.b-cdn.net/{videoId}/playlist.m3u8
    const directUrl = activeLesson.content_url.includes('.m3u8')
      ? activeLesson.content_url
      : `https://vz-5d94ab2c-5c7.b-cdn.net/${videoId}/playlist.m3u8`;

    // Set initial playback URL immediately so player begins loading instantly
    setPlaybackUrl(signedUrlCache.current[videoId] || directUrl);
    setLoadingPlayback(false);

    // Fetch signed URL in background if not already cached
    if (!signedUrlCache.current[videoId]) {
      fetchSignedUrl(videoId).then(signedUrl => {
        if (signedUrl && signedUrl !== directUrl) {
          setPlaybackUrl(signedUrl);
        }
      });
    }
  }, [activeLesson]);

  // Fetch student enrollments on mount
  useEffect(() => {
    if (user) {
      fetchEnrollments();
    }
  }, [user]);

  // Calculate total lessons in course
  const getTotalLessonsCount = () => {
    if (!activeCourse || !activeCourse.modules) return 0;
    return activeCourse.modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0);
  };

  // Handle Mark as Complete
  const handleMarkAsComplete = async () => {
    if (!selectedEnrollment || !activeLesson || completingLesson) return;
    setCompletingLesson(true);
    try {
      const completed = selectedEnrollment.completed_lessons || [];
      if (!completed.includes(activeLesson.id)) {
        const updatedCompleted = [...completed, activeLesson.id];
        const total = getTotalLessonsCount();
        const newProgress = total > 0 ? Math.min(100, Math.round((updatedCompleted.length / total) * 100)) : 100;
        
        const updated = await enrollmentService.updateProgress(
          selectedEnrollment.id,
          updatedCompleted,
          newProgress
        );
        
        // Update local enrollment state
        setSelectedEnrollment(updated);
        // Refresh local list
        setEnrollments(prev => prev.map(e => e.id === updated.id ? updated : e));

        // Auto play / transition to next lesson if available
        triggerNextLesson(updatedCompleted);
      }
    } catch (err) {
      console.error('Error completing lesson:', err);
    } finally {
      setCompletingLesson(false);
    }
  };

  // Find and select next lesson automatically
  const triggerNextLesson = (completedList: string[]) => {
    if (!activeCourse || !activeCourse.modules || !activeLesson) return;
    
    // Flatten all lessons
    const allLessons: any[] = [];
    activeCourse.modules.forEach((m: any) => {
      if (m.lessons) {
        allLessons.push(...m.lessons);
      }
    });

    const currentIndex = allLessons.findIndex((l) => l.id === activeLesson.id);
    if (currentIndex !== -1 && currentIndex < allLessons.length - 1) {
      setActiveLesson(allLessons[currentIndex + 1]);
    }
  };

  const handleBackToCoursesList = () => {
    setSelectedEnrollment(null);
    setActiveCourse(null);
    setActiveLesson(null);
    setSearchParams({});
  };

  // ── VIEW 1: Grid List of enrolled courses ───────────────────────────
  if (!selectedEnrollment) {
    return (
      <div className="space-y-8 w-full font-sans">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Learning Portal</h1>
            <p className="text-slate-500 font-semibold mt-1.5 text-xs">Resume where you left off in your professional development curriculum.</p>
          </div>
          <Button 
            onClick={() => navigate('/courses')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl py-4.5 px-6 border-none"
          >
            Browse Course Catalog
          </Button>
        </div>

        {enrollments.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-[2.5rem] space-y-6 max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-emerald-100 dark:border-emerald-900">
              <BookOpen size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-tight">No Enrolled Courses</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                When you enroll in or purchase a course from the catalog, it will appear here immediately with real-time progress syncing.
              </p>
            </div>
            <Button 
              onClick={() => navigate('/courses')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl border-none"
            >
              Explore Courses
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrollments.map((e) => (
              <Card 
                key={e.id}
                className="bg-white dark:bg-slate-900 border border-slate-250/50 dark:border-slate-800 rounded-[2rem] overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col group cursor-pointer"
                onClick={() => handleSelectEnrollment(e)}
              >
                <div className="aspect-video relative overflow-hidden bg-slate-100 dark:bg-slate-950 border-b border-slate-200/40 dark:border-slate-800/40">
                  {e.item_thumbnail ? (
                    <img 
                      src={e.item_thumbnail} 
                      alt={e.item_title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-slate-800">
                      <BookMarked size={48} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
                    Course
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-black text-slate-900 dark:text-white text-base tracking-tight leading-snug group-hover:text-emerald-600 transition-colors">
                      {e.item_title}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span>Progress</span>
                        <span className="text-emerald-500">{e.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-550" 
                          style={{ width: `${e.progress}%` }} 
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={(evt) => {
                        evt.stopPropagation();
                        handleSelectEnrollment(e);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl border-none shadow-md shadow-emerald-500/10"
                    >
                      {e.progress === 0 ? 'Start Learning' : 'Resume Learning'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── VIEW 2: Curriculum / Player view for selected course ───────────
  if (loadingCourse) {
    return <LoadingOverlay message="Synchronizing Course" submessage="Retrieving syllabus and lesson plan..." />;
  }

  return (
    <div className="space-y-6 w-full font-sans">
      {/* Header with back button */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={handleBackToCoursesList}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs font-black uppercase tracking-widest self-start"
        >
          <ChevronLeft size={16} /> Back to My Learning
        </button>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            {selectedEnrollment.item_title}
          </h1>
          <div className="inline-flex items-center gap-3">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Course Progress: {selectedEnrollment.progress}%
            </span>
            <div className="w-24 bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${selectedEnrollment.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center bg-rose-50 border border-rose-100 rounded-3xl text-rose-800 font-medium">
          {error}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Media Player area */}
          <div className="flex-1 space-y-6">
            {activeLesson ? (
              <div className="space-y-6">
                
                {/* Visual content container */}
                <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-center">
                  {activeLesson.type === 'video' && activeLesson.content_url ? (
                    loadingPlayback ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 z-10 backdrop-blur-[2px] w-full h-full">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] font-black text-emerald-400">Loading</span>
                        </div>
                      </div>
                    ) : (
                      <TrilezaVideoPlayer
                        key={activeLesson.id}
                        src={playbackUrl}
                        title={activeLesson.title || 'Course Lesson'}
                        poster={activeCourse?.thumbnail_url || ''}
                      />
                    )
                  ) : (
                    // Default simulated lecture media/asset placeholder
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                        {activeLesson.type === 'pdf' ? <FileText size={28} /> : 
                         activeLesson.type === 'quiz' ? <HelpCircle size={28} /> : 
                         <Video size={28} />}
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tight mb-2">{activeLesson.title}</h3>
                      <p className="text-xs text-slate-400 font-semibold max-w-sm mb-6 capitalize leading-relaxed">
                        {activeLesson.type || 'Lecture'} Module Resource
                      </p>
                      
                      {activeLesson.content_url && (
                        <a 
                          href={activeLesson.content_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
                        >
                          {activeLesson.type === 'pdf' ? <Download size={16} /> : <LinkIcon size={16} />} Open Resource Link
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Lesson Header Details */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 mb-2">
                      {activeLesson.type || 'Lecture'}
                    </span>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{activeLesson.title}</h2>
                  </div>
                  
                  {selectedEnrollment.completed_lessons?.includes(activeLesson.id) ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-black text-xs uppercase tracking-wider">
                      <CheckCircle2 size={16} /> Completed
                    </span>
                  ) : (
                    <Button 
                      onClick={handleMarkAsComplete}
                      disabled={completingLesson}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl border-none shadow-md shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      {completingLesson ? 'Updating...' : 'Mark as Complete'}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-16 text-center bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800 text-slate-400 dark:text-slate-600 font-bold italic">
                No syllabus modules or lessons have been published for this course yet.
              </div>
            )}
          </div>

          {/* Right Curriculum & Materials Sidebar */}
          <div className="w-full lg:w-80 shrink-0 space-y-6">
            {/* Video Playlist Sidebar */}
            <Card className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-[2rem] shadow-sm">
              <h3 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                <Video size={16} className="text-emerald-500" /> Video Lectures
              </h3>
              
              {activeCourse.modules && activeCourse.modules.length > 0 ? (
                <div className="space-y-6">
                  {activeCourse.modules.map((mod: any, mIdx: number) => {
                    const videoOnlyLessons = (mod.lessons || []).filter((l: any) => l.type === 'video');
                    if (videoOnlyLessons.length === 0) return null;

                    return (
                      <div key={mod.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Module {mIdx + 1}: {mod.title}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {videoOnlyLessons.map((les: any) => {
                            const isCompleted = selectedEnrollment.completed_lessons?.includes(les.id);
                            const isActive = activeLesson?.id === les.id;
                            
                            return (
                              <div 
                                key={les.id}
                                onClick={() => setActiveLesson(les)}
                                className={cn(
                                  "p-3 rounded-xl cursor-pointer border transition-all text-left flex items-start justify-between gap-3",
                                  isActive 
                                    ? "bg-emerald-50/50 border-emerald-500/20 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-500/20" 
                                    : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                )}
                              >
                                <div className="space-y-1 flex-1 min-w-0">
                                  <h4 className={cn(
                                    "text-xs font-bold truncate leading-snug",
                                    isActive ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "text-slate-700 dark:text-slate-300"
                                  )}>
                                    {les.title}
                                  </h4>
                                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                    Video Lecture
                                  </span>
                                </div>
                                
                                <div className="shrink-0 pt-0.5">
                                  {isCompleted ? (
                                    <CheckCircle size={14} className="text-emerald-500" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 dark:border-slate-700" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-4">No video lectures published.</p>
              )}
            </Card>

            {/* Dedicated Class Materials Section */}
            <Card className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-[2rem] shadow-sm">
              {(() => {
                const materials: any[] = [];
                if (activeCourse?.materials && Array.isArray(activeCourse.materials)) {
                  materials.push(...activeCourse.materials);
                }
                if (activeCourse?.modules) {
                  activeCourse.modules.forEach((mod: any) => {
                    (mod.lessons || []).forEach((les: any) => {
                      if (les.type !== 'video' && les.content_url) {
                        materials.push(les);
                      }
                    });
                  });
                }

                const handleDownloadAll = async () => {
                  if (materials.length === 0) return;
                  try {
                    const JSZip = (await import('jszip')).default;
                    const zip = new JSZip();
                    const folder = zip.folder('Class_Materials');
                    
                    for (let i = 0; i < materials.length; i++) {
                      const m = materials[i];
                      const name = m.title || m.name || `material_${i+1}`;
                      const url = m.content_url || m.url;
                      if (url) {
                        try {
                          const res = await fetch(url);
                          const blob = await res.blob();
                          const ext = m.type === 'pdf' ? '.pdf' : '.dat';
                          folder?.file(`${name.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`, blob);
                        } catch (e) {
                          folder?.file(`${name.replace(/[^a-zA-Z0-9_-]/g, '_')}_link.txt`, `Download URL: ${url}`);
                        }
                      }
                    }

                    const zipContent = await zip.generateAsync({ type: 'blob' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(zipContent);
                    a.download = `${(selectedEnrollment?.item_title || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_')}_Materials.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  } catch (err) {
                    console.error('Failed to bundle zip', err);
                    materials.forEach(m => {
                      const u = m.content_url || m.url;
                      if (u) window.open(u, '_blank');
                    });
                  }
                };

                return (
                  <div>
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h3 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-widest flex items-center gap-2">
                        <FileText size={16} className="text-emerald-500" /> Class Materials ({materials.length})
                      </h3>
                      {materials.length > 0 && (
                        <button
                          onClick={handleDownloadAll}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border-none cursor-pointer shadow-sm transition-all"
                          title="Download all class materials as a ZIP package"
                        >
                          <Download size={12} /> Download All
                        </button>
                      )}
                    </div>

                    {materials.length === 0 ? (
                      <p className="text-xs text-slate-400 font-semibold italic text-center py-4">No additional class materials attached.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {materials.map((mat: any, idx: number) => {
                          const url = mat.content_url || mat.url;
                          const title = mat.title || mat.name || `Material ${idx + 1}`;

                          return (
                            <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100/50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <FileText size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{title}</p>
                                  <p className="text-[9px] font-black uppercase text-slate-400">{mat.type || 'Document'}</p>
                                </div>
                              </div>
                              {url && (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
                                  title={`Download ${title}`}
                                >
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          </div>

        </div>
      )}
    </div>
  );
};

export default CourseViewer;
