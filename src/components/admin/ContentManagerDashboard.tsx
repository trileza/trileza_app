import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { adminService } from '../../lib/services/admin';
import { courseService } from '../../lib/services/courses';
import type { CourseReview, BookReview, VideoAnnotation, CreatorProfile } from '../../types/admin';
import { Card, Button, Toast } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';
import { 
  BookOpen, 
  CheckSquare, 
  AlertCircle, 
  Award, 
  HelpCircle, 
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  RefreshCcw,
  CheckCircle2,
  ListCollapse,
  Play,
  FileText,
  Download,
  BookOpenText,
  User,
  ShieldAlert,
  Send,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { formatCurrency, formatDate } from '../../utils';
import PageHeader from '../shared/PageHeader';
import Pagination from './shared/Pagination';
import ExportToolbar from './shared/ExportToolbar';
import ConfirmDialog from './shared/ConfirmDialog';
import { useDebouncedValue, usePaginatedList, useMultiTableSync } from './hooks/useAdminData';
import { exportToExcel, exportToCSV, COURSE_EXPORT_COLUMNS, BOOK_EXPORT_COLUMNS } from './hooks/useExport';

const ContentManagerDashboard: React.FC = () => {
  const { user } = useAuthStore();
  
  // Staged queues
  const [coursesQueue, setCoursesQueue] = useState<CourseReview[]>([]);
  const [booksQueue, setBooksQueue] = useState<BookReview[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard Tabs: 'courses' | 'books'
  const [activeTab, setActiveTab] = useState<'courses' | 'books'>('courses');

  // Course modal tabs: 'video' | 'materials'
  const [courseModalTab, setCourseModalTab] = useState<'video' | 'materials'>('video');
  
  // Sub-tabs for Course lists: 'pending' | 'pending_deletion' | 'approved' | 'rejected' | 'all'
  const [courseListTab, setCourseListTab] = useState<'pending' | 'pending_deletion' | 'approved' | 'rejected' | 'all'>('pending');
  // Sub-tabs for Book lists: 'pending' | 'approved' | 'rejected' | 'all'
  const [bookListTab, setBookListTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  // Selection states
  const [selectedCourse, setSelectedCourse] = useState<CourseReview | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookReview | null>(null);
  const [courseCurriculum, setCourseCurriculum] = useState<any>(null);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);

  // Video Content Player & Annotations state
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [videoAnnotations, setVideoAnnotations] = useState<VideoAnnotation[]>([]);
  const [newAnnotationTime, setNewAnnotationTime] = useState('');
  const [newAnnotationType, setNewAnnotationType] = useState<'Correction Required' | 'Suggestion'>('Correction Required');
  const [newAnnotationNote, setNewAnnotationNote] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Paginated inline Book Preview state
  const [currentBookPage, setCurrentBookPage] = useState(1);
  const samplePages = [
    "Page 1: Introduction. Trileza social LMS brings a new way of community-driven cohort education, bridging the gap between experts and learners.",
    "Page 2: Chapter 1 - Staging Content and Syllabus Quality. In typical instructional design, curriculum structures must align with strict SLA expectations.",
    "Page 3: Lesson outlines require interactive checkmarks: title, description, and high-definition video components of at least 720p resolution.",
    "Page 4: Chapter 2 - Cognitive Engagement Strategies. Fostering discussion groups and cohort-based project evaluations increases completion rates by 80%.",
    "Page 5: Page-turn previews allow administrators to check text formatting and read initial chapters to flag potential copyright infringement issues inline.",
    "Page 6: Page 6 - Case Analysis. Designing structured learning paths is proven to boost information retention, according to global instructional benchmarks.",
    "Page 7: Page 7 - Conclusion. Ensuring the author's tone remains appropriate and professional is critical to creating a safe educational environment."
  ];

  // Creator profile inspection modal state
  const [creatorProfileId, setCreatorProfileId] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [creatorMessages, setCreatorMessages] = useState<any[]>([]);
  const [creatorDmText, setCreatorDmText] = useState('');
  const [creatorSuspensionReason, setCreatorSuspensionReason] = useState('');

  // Bulk actions selection states
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [bulkNotes, setBulkNotes] = useState('');

  // Checklist states
  const [courseChecklist, setCourseChecklist] = useState({
    checklist_title: false,
    checklist_description: false,
    checklist_curriculum: false,
    checklist_video: false,
    checklist_audio: false,
    checklist_thumbnail: false,
    checklist_no_copyright: false
  });

  const [bookChecklist, setBookChecklist] = useState({
    checklist_cover: false,
    checklist_description: false,
    checklist_readable: false,
    checklist_price: false,
    checklist_no_copyright: false
  });

  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Delete confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; confirmLabel: string;
    variant: 'danger' | 'warning' | 'info'; action: () => Promise<void>;
  }>({ open: false, title: '', message: '', confirmLabel: 'Delete', variant: 'danger', action: async () => {} });

  // Filters
  const [filterInstructor, setFilterInstructor] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');

  // Debounced search
  const debouncedFilterCategory = useDebouncedValue(filterCategory, 300);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [courses, books] = await Promise.all([
        adminService.getCourseReviews(),
        adminService.getBookReviews()
      ]);
      setCoursesQueue(courses);
      setBooksQueue(books);
    } catch (err) {
      console.error('[CM Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Realtime sync — auto-refresh on database changes
  useMultiTableSync(['courses', 'books', 'course_reviews', 'book_reviews'], fetchData);

  const handleSelectCourse = async (course: CourseReview) => {
    setSelectedCourse(course);
    setSelectedBook(null);
    setActiveLesson(null);
    setVideoAnnotations([]);
    setCourseModalTab('video');
    setCourseChecklist({
      checklist_title: course.checklist_title,
      checklist_description: course.checklist_description,
      checklist_curriculum: course.checklist_curriculum,
      checklist_video: course.checklist_video,
      checklist_audio: course.checklist_audio,
      checklist_thumbnail: course.checklist_thumbnail,
      checklist_no_copyright: course.checklist_no_copyright
    });
    setReviewNotes(course.notes || '');

    // Fetch curriculum
    setLoadingCurriculum(true);
    setCourseCurriculum(null);
    try {
      const full = await courseService.getFullCourse(course.course_id);
      setCourseCurriculum(full);
      // Auto-select first lesson if available
      if (full.modules?.[0]?.lessons?.[0]) {
        handleSelectLesson(full.modules[0].lessons[0], course.id);
      }
    } catch (err) {
      console.error('[CM Fetch Curriculum Error]:', err);
    } finally {
      setLoadingCurriculum(false);
    }
  };

  const handleSelectLesson = async (les: any, courseReviewId: string) => {
    setActiveLesson(les);
    setNewAnnotationTime('0:00');
    try {
      const notes = await adminService.getVideoAnnotations(les.id, courseReviewId);
      setVideoAnnotations(notes);
    } catch (err) {
      console.error('[Fetch Annotations Error]:', err);
    }
  };

  const handleSaveAnnotation = async () => {
    if (!activeLesson || !selectedCourse || !newAnnotationNote.trim()) return;
    try {
      const saved = await adminService.saveVideoAnnotation(
        activeLesson.id,
        selectedCourse.id,
        newAnnotationTime || '0:00',
        newAnnotationType,
        newAnnotationNote
      );
      setVideoAnnotations(prev => [...prev, saved]);
      setNewAnnotationNote('');
    } catch (err) {
      showToast('Failed to save annotation: ' + err, 'error');
    }
  };

  const handleDeleteAnnotation = async (annId: string) => {
    try {
      await adminService.deleteVideoAnnotation(annId);
      setVideoAnnotations(prev => prev.filter(a => a.id !== annId));
    } catch (err) {
      showToast('Failed to delete annotation: ' + err, 'error');
    }
  };

  const updateNewAnnotationTimeFromVideo = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const mins = Math.floor(current / 60);
      const secs = Math.floor(current % 60);
      setNewAnnotationTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    }
  };

  const handleSelectBook = (book: BookReview) => {
    setSelectedBook(book);
    setSelectedCourse(null);
    setCurrentBookPage(1);
    setBookChecklist({
      checklist_cover: book.checklist_cover,
      checklist_description: book.checklist_description,
      checklist_readable: book.checklist_readable,
      checklist_price: book.checklist_price,
      checklist_no_copyright: book.checklist_no_copyright
    });
    setReviewNotes(book.notes || '');
  };

  const submitCourseReview = async (status: 'approved' | 'needs_changes' | 'rejected') => {
    if (!selectedCourse || !user?.id) return;
    if ((status === 'needs_changes' || status === 'rejected') && !reviewNotes.trim()) {
      showToast('Please provide detailed auditor notes explaining what changes are needed or the reason for rejection.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      await adminService.reviewCourse(
        selectedCourse.id,
        user.id,
        status,
        courseChecklist,
        reviewNotes,
        selectedCourse.course_id
      );
      setSelectedCourse(null);
      setReviewNotes('');
      await fetchData();
      showToast(`Course submission successfully marked as ${status}!`, 'success');
    } catch (err) {
      showToast('Review submission failed: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitBookReview = async (status: 'approved' | 'rejected' | 'needs_changes') => {
    if (!selectedBook || !user?.id) return;
    if ((status === 'needs_changes' || status === 'rejected') && !reviewNotes.trim()) {
      showToast('Please provide detailed auditor notes explaining what changes are needed or the reason for rejection.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      await adminService.reviewBook(
        selectedBook.id,
        user.id,
        status,
        bookChecklist,
        reviewNotes,
        selectedBook.book_id
      );
      setSelectedBook(null);
      setReviewNotes('');
      await fetchData();
      showToast(`Book submission successfully marked as ${status}!`, 'success');
    } catch (err) {
      showToast('Review submission failed: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk actions handler
  const handleBulkCourseAction = async (status: 'approved' | 'rejected' | 'needs_changes') => {
    if (selectedCourseIds.length === 0 || !user?.id) return;
    if ((status === 'rejected' || status === 'needs_changes') && !bulkNotes.trim()) {
      showToast('Please provide bulk justification notes explaining changes/rejections.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        selectedCourseIds.map(async (reviewId) => {
          const rev = coursesQueue.find(c => c.id === reviewId);
          if (rev) {
            await adminService.reviewCourse(
              reviewId,
              user.id,
              status,
              {
                checklist_title: true,
                checklist_description: true,
                checklist_curriculum: true,
                checklist_video: true,
                checklist_audio: true,
                checklist_thumbnail: true,
                checklist_no_copyright: true
              },
              bulkNotes || 'Approved via Bulk Action',
              rev.course_id
            );
          }
        })
      );
      setSelectedCourseIds([]);
      setBulkNotes('');
      setSelectedCourse(null);
      await fetchData();
      showToast(`Successfully processed ${status} for selected courses!`, 'success');
    } catch (err) {
      showToast('Bulk action failed: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkBookAction = async (status: 'approved' | 'rejected' | 'needs_changes') => {
    if (selectedBookIds.length === 0 || !user?.id) return;
    if ((status === 'rejected' || status === 'needs_changes') && !bulkNotes.trim()) {
      showToast('Please provide bulk justification notes.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        selectedBookIds.map(async (reviewId) => {
          const rev = booksQueue.find(b => b.id === reviewId);
          if (rev) {
            await adminService.reviewBook(
              reviewId,
              user.id,
              status,
              {
                checklist_cover: true,
                checklist_description: true,
                checklist_readable: true,
                checklist_price: true,
                checklist_no_copyright: true
              },
              bulkNotes || 'Approved via Bulk Action',
              rev.book_id
            );
          }
        })
      );
      setSelectedBookIds([]);
      setBulkNotes('');
      setSelectedBook(null);
      await fetchData();
      showToast(`Successfully processed ${status} for selected books!`, 'success');
    } catch (err) {
      showToast('Bulk action failed: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch and inspect creator profiles
  const inspectCreator = async (creatorId: string) => {
    setCreatorProfileId(creatorId);
    setLoadingCreator(true);
    setCreatorProfile(null);
    setCreatorMessages([]);
    try {
      const profile = await adminService.getCreatorProfile(creatorId);
      setCreatorProfile(profile);
      if (user?.id) {
        const dms = await adminService.getCreatorMessages(user.id, creatorId);
        setCreatorMessages(dms);
      }
    } catch (err) {
      console.error('[Fetch Creator Profile Error]:', err);
    } finally {
      setLoadingCreator(false);
    }
  };

  const handleSendCreatorDm = async () => {
    if (!creatorProfileId || !creatorDmText.trim() || !user?.id) return;
    try {
      const msg = await adminService.sendCreatorMessage(user.id, creatorProfileId, creatorDmText);
      setCreatorMessages(prev => [...prev, msg]);
      setCreatorDmText('');
    } catch (err) {
      showToast('Failed to send message: ' + err, 'error');
    }
  };

  const handleToggleCreatorSuspension = async (suspend: boolean) => {
    if (!creatorProfileId || !user?.id) return;
    if (suspend && !creatorSuspensionReason.trim()) {
      showToast('Please state a reason for suspending this creator.', 'info');
      return;
    }
    try {
      await adminService.setUserSuspension(
        creatorProfileId,
        suspend,
        user.id,
        suspend ? creatorSuspensionReason : 'Unban request processed by compliance officer'
      );
      setCreatorSuspensionReason('');
      inspectCreator(creatorProfileId);
      showToast(suspend ? 'Creator account suspended!' : 'Creator account reactivated!', 'success');
    } catch (err) {
      showToast('Failed to update creator suspension: ' + err, 'error');
    }
  };

  // Delete handlers
  const handleDeleteCourse = (course: CourseReview) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Course',
      message: `Permanently delete "${course.course_title}" and all associated reviews? This action cannot be undone.`,
      confirmLabel: 'Delete Course',
      variant: 'danger',
      action: async () => {
        if (!user?.id) return;
        setSubmitting(true);
        try {
          await adminService.deleteContent(course.course_id, 'course', user.id);
          showToast(`Course "${course.course_title}" deleted successfully.`, 'success');
          await fetchData();
        } catch (err) {
          showToast('Failed to delete course: ' + err, 'error');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleDeleteBook = (book: BookReview) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Book',
      message: `Permanently delete "${book.book_title}" and all associated reviews? This action cannot be undone.`,
      confirmLabel: 'Delete Book',
      variant: 'danger',
      action: async () => {
        if (!user?.id) return;
        setSubmitting(true);
        try {
          await adminService.deleteContent(book.book_id, 'book', user.id);
          showToast(`Book "${book.book_title}" deleted successfully.`, 'success');
          await fetchData();
        } catch (err) {
          showToast('Failed to delete book: ' + err, 'error');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  // Memoized filters processing (uses debounced search)
  const currentCourseList = useMemo(() => {
    return coursesQueue.filter(c => {
      const matchesStatus = 
        courseListTab === 'pending' ? c.status === 'pending' :
        courseListTab === 'pending_deletion' ? c.status === 'pending_deletion' :
        courseListTab === 'approved' ? c.status === 'approved' :
        courseListTab === 'rejected' ? (c.status === 'rejected' || c.status === 'needs_changes') : true;

      const matchesInstructor = filterInstructor === 'All' || c.submitted_by === filterInstructor || c.submitted_by_name === filterInstructor;
      const matchesCategory = debouncedFilterCategory === 'All' || c.course_title?.toLowerCase().includes(debouncedFilterCategory.toLowerCase());

      return matchesStatus && matchesInstructor && matchesCategory;
    });
  }, [coursesQueue, courseListTab, filterInstructor, debouncedFilterCategory]);

  const currentBookList = useMemo(() => {
    return booksQueue.filter(b => {
      const matchesStatus = 
        bookListTab === 'pending' ? b.status === 'pending' :
        bookListTab === 'approved' ? b.status === 'approved' :
        bookListTab === 'rejected' ? (b.status === 'rejected' || b.status === 'needs_changes') : true;

      const matchesAuthor = filterInstructor === 'All' || b.submitted_by === filterInstructor || b.submitted_by_name === filterInstructor;
      const matchesCategory = debouncedFilterCategory === 'All' || b.book_title?.toLowerCase().includes(debouncedFilterCategory.toLowerCase());

      return matchesStatus && matchesAuthor && matchesCategory;
    });
  }, [booksQueue, bookListTab, filterInstructor, debouncedFilterCategory]);

  // Pagination
  const coursesPagination = usePaginatedList(currentCourseList, 15);
  const booksPagination = usePaginatedList(currentBookList, 15);

  // Unique instructors and authors for filters
  const creatorsList = Array.from(new Set([
    ...coursesQueue.map(c => c.submitted_by_name || 'Tutor'),
    ...booksQueue.map(b => b.submitted_by_name || 'Author')
  ]));

  const hasSelection = !!selectedBook;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      
      {hasSelection ? (
        <>
          {selectedCourse && (
            <PageHeader
              title={`Course Audit: ${selectedCourse.course_title}`}
              description={`Audit course syllabus, lectures, pricing, and video content submitted by ${selectedCourse.submitted_by_name}.`}
              tag="Course Review"
              icon={BookOpen}
              rightContent={
                <Button 
                  onClick={() => setSelectedCourse(null)}
                  variant="outline"
                  className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
                >
                  ← Back to Queue
                </Button>
              }
            />
          )}
          {selectedBook && (
            <PageHeader
              title={`Book Audit: ${selectedBook.book_title}`}
              description={`Review manuscript pages, cover images, details, and PDF layouts submitted by ${selectedBook.submitted_by_name}.`}
              tag="Book Review"
              icon={BookOpenText}
              rightContent={
                <Button 
                  onClick={() => setSelectedBook(null)}
                  variant="outline"
                  className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
                >
                  ← Back to Queue
                </Button>
              }
            />
          )}
        </>
      ) : (
        <>
          <PageHeader
            title="Content Management Audit"
            description="Full audit pipeline: timestamped video annotations, book manuscript page previews, and creator profiles."
            tag="Content Manager"
            icon={BookOpen}
            rightContent={
              <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl bg-white/15 hover:bg-white/20 border-white/20 text-white shadow-sm flex items-center gap-2 font-bold">
                <RefreshCcw size={14} className="text-emerald-450 animate-spin-slow" /> Sync Queues
              </Button>
            }
          />

          {/* ── Dashboard Tabs ── */}
          <div className="flex gap-4 border-b border-slate-200 pb-2">
            <button
              onClick={() => { setActiveTab('courses'); setSelectedCourse(null); setSelectedBook(null); }}
              className={`px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 ${
                activeTab === 'courses'
                  ? 'text-green-705 border-b-4 border-green-600 bg-green-50/40'
                  : 'text-slate-550 hover:text-slate-800'
              }`}
            >
              📚 Staged Courses Queue
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-600 text-white">
                {coursesQueue.filter(c => c.status === 'pending').length}
              </span>
            </button>
            <button
              onClick={() => { setActiveTab('books'); setSelectedCourse(null); setSelectedBook(null); }}
              className={`px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 ${
                activeTab === 'books'
                  ? 'text-emerald-700 border-b-4 border-emerald-600 bg-emerald-50/40'
                  : 'text-slate-555 hover:text-slate-800'
              }`}
            >
              📖 Library Books Queue
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                {booksQueue.filter(b => b.status === 'pending').length}
              </span>
            </button>
          </div>

          {/* ── Filters Bar ── */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl flex flex-wrap gap-4 items-center justify-between shadow-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter size={13} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase">Creator:</span>
                <select
                  value={filterInstructor}
                  onChange={e => setFilterInstructor(e.target.value)}
                  className="bg-white border border-slate-200 text-xs font-bold rounded-xl p-2 text-slate-700 outline-none focus:ring-2 focus:ring-green-550/20"
                >
                  <option value="All">All Creators</option>
                  {creatorsList.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Search text:</span>
                <input
                  type="text"
                  placeholder="Filter by title..."
                  value={filterCategory === 'All' ? '' : filterCategory}
                  onChange={e => setFilterCategory(e.target.value || 'All')}
                  className="bg-white border border-slate-200 text-xs font-bold rounded-xl p-2 text-slate-800 outline-none focus:ring-2 focus:ring-green-550/20 w-44"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className={hasSelection ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : "w-full"}>
        
        {/* ── Left Columns: Queues and list views ── */}
        <div className={hasSelection ? "lg:col-span-2 space-y-6" : "w-full space-y-6"}>
          
          {activeTab === 'courses' ? (
            <div className="space-y-4">
              
              {/* Courses subtabs */}
              <div className="flex gap-2">
                {(['pending', 'pending_deletion', 'approved', 'rejected', 'all'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setCourseListTab(tab); setSelectedCourse(null); }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all border ${
                      courseListTab === tab
                        ? 'bg-slate-900 border-transparent text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {tab === 'pending_deletion' ? 'Pending Deletion' : tab} ({
                      tab === 'pending' ? coursesQueue.filter(c => c.status === 'pending').length :
                      tab === 'pending_deletion' ? coursesQueue.filter(c => c.status === 'pending_deletion').length :
                      tab === 'approved' ? coursesQueue.filter(c => c.status === 'approved').length :
                      tab === 'rejected' ? coursesQueue.filter(c => c.status === 'rejected' || c.status === 'needs_changes').length :
                      coursesQueue.length
                    })
                  </button>
                ))}
              </div>

              {/* Export toolbar */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-500">{currentCourseList.length} courses</span>
                <ExportToolbar
                  onExportExcel={() => exportToExcel(currentCourseList, COURSE_EXPORT_COLUMNS, 'trileza_courses')}
                  onExportCSV={() => exportToCSV(currentCourseList, COURSE_EXPORT_COLUMNS, 'trileza_courses')}
                  itemCount={currentCourseList.length}
                  label="courses"
                />
              </div>

              {/* Courses list */}
              {loading ? (
                <Card className="p-12 text-center border-slate-200 bg-white">
                  <p className="text-slate-400 font-bold uppercase text-xs">Synchronizing courses queue...</p>
                </Card>
              ) : currentCourseList.length === 0 ? (
                <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
                  <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
                  <h4 className="font-extrabold text-slate-800 text-base">No items found</h4>
                  <p className="text-xs text-slate-500 mt-1">No courses match the active filter criteria.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-2 text-[10px] font-black uppercase text-slate-400">
                    <span>Course Title & Instructor</span>
                    <span>Actions</span>
                  </div>
                  {coursesPagination.paginatedItems.map(c => {
                    const isSelected = selectedCourseIds.includes(c.id);
                    return (
                      <Card
                        key={c.id}
                        className={`p-4 bg-white border hover:border-green-300 transition-all rounded-2xl text-left flex gap-4 shadow-sm items-center ${
                          selectedCourse?.id === c.id ? 'ring-2 ring-green-600 border-transparent bg-green-50/5' : 'border-slate-200/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCourseIds(prev => [...prev, c.id]);
                            } else {
                              setSelectedCourseIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500/20 cursor-pointer"
                        />
                        <div 
                          onClick={() => handleSelectCourse(c)}
                          className="flex gap-4 items-center flex-1 cursor-pointer min-w-0"
                        >
                          <img src={c.course_thumbnail || 'https://api.dicebear.com/7.x/initials/svg?seed=Course'} className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200" alt="Thumb" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">{c.course_title}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-bold">
                              Instructor: <span className="text-green-700 underline hover:text-green-900" onClick={(e) => { e.stopPropagation(); inspectCreator(c.submitted_by); }}>{c.submitted_by_name}</span>
                            </p>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono shrink-0 mr-2">
                            {formatDistanceToNow(new Date(c.submitted_at), { addSuffix: true })}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCourse(c); }}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 transition-all active:scale-95 shrink-0"
                          title="Delete course"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Card>
                    );
                  })}
                  <Pagination
                    currentPage={coursesPagination.currentPage}
                    totalPages={coursesPagination.totalPages}
                    totalItems={coursesPagination.totalItems}
                    startIndex={coursesPagination.totalItems === 0 ? 0 : coursesPagination.startIndex}
                    endIndex={coursesPagination.endIndex}
                    onPageChange={coursesPagination.goToPage}
                    onNext={coursesPagination.nextPage}
                    onPrev={coursesPagination.prevPage}
                  />
                </div>
              )}

              {/* Bulk Actions Section */}
              {selectedCourseIds.length > 0 && (
                <Card className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center shadow-inner">
                  <div className="text-left">
                    <p className="text-xs font-black text-slate-700 uppercase">{selectedCourseIds.length} Courses Selected for Bulk Action</p>
                    <input
                      type="text"
                      placeholder="Add bulk decision note (required for rejections)..."
                      value={bulkNotes}
                      onChange={e => setBulkNotes(e.target.value)}
                      className="mt-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none w-80 shadow-sm"
                    />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button onClick={() => handleBulkCourseAction('approved')} className="bg-green-600 hover:bg-green-700 text-white text-[10px] py-1.5 font-black uppercase rounded-lg border-none shadow-sm"><Check size={12} className="inline mr-1" /> Approve Selected</Button>
                    <Button onClick={() => handleBulkCourseAction('needs_changes')} className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] py-1.5 font-black uppercase rounded-lg border-none shadow-sm"><RefreshCcw size={12} className="inline mr-1" /> Request Changes</Button>
                    <Button onClick={() => handleBulkCourseAction('rejected')} className="bg-red-600 hover:bg-red-700 text-white text-[10px] py-1.5 font-black uppercase rounded-lg border-none shadow-sm"><ThumbsDown size={12} className="inline mr-1" /> Reject Selected</Button>
                  </div>
                </Card>
              )}

            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Books subtabs */}
              <div className="flex gap-2">
                {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setBookListTab(tab); setSelectedBook(null); }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all border ${
                      bookListTab === tab
                        ? 'bg-slate-900 border-transparent text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {tab} ({
                      tab === 'pending' ? booksQueue.filter(b => b.status === 'pending').length :
                      tab === 'approved' ? booksQueue.filter(b => b.status === 'approved').length :
                      tab === 'rejected' ? booksQueue.filter(b => b.status === 'rejected' || b.status === 'needs_changes').length :
                      booksQueue.length
                    })
                  </button>
                ))}
              </div>

              {/* Export toolbar */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-500">{currentBookList.length} books</span>
                <ExportToolbar
                  onExportExcel={() => exportToExcel(currentBookList, BOOK_EXPORT_COLUMNS, 'trileza_books')}
                  onExportCSV={() => exportToCSV(currentBookList, BOOK_EXPORT_COLUMNS, 'trileza_books')}
                  itemCount={currentBookList.length}
                  label="books"
                />
              </div>

              {/* Books list */}
              {loading ? (
                <Card className="p-12 text-center border-slate-200 bg-white">
                  <p className="text-slate-400 font-bold uppercase text-xs">Synchronizing books queue...</p>
                </Card>
              ) : currentBookList.length === 0 ? (
                <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
                  <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
                  <h4 className="font-extrabold text-slate-800 text-base">No items found</h4>
                  <p className="text-xs text-slate-500 mt-1">No manuscripts match the active filter criteria.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-2 text-[10px] font-black uppercase text-slate-400">
                    <span>Book Title & Author</span>
                    <span>Actions</span>
                  </div>
                  {booksPagination.paginatedItems.map(b => {
                    const isSelected = selectedBookIds.includes(b.id);
                    return (
                      <Card
                        key={b.id}
                        className={`p-4 bg-white border hover:border-emerald-300 transition-all rounded-2xl text-left flex gap-4 shadow-sm items-center ${
                          selectedBook?.id === b.id ? 'ring-2 ring-emerald-600 border-transparent bg-emerald-50/5' : 'border-slate-200/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBookIds(prev => [...prev, b.id]);
                            } else {
                              setSelectedBookIds(prev => prev.filter(id => id !== b.id));
                            }
                          }}
                          className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500/20 cursor-pointer"
                        />
                        <div 
                          onClick={() => handleSelectBook(b)}
                          className="flex gap-4 items-center flex-1 cursor-pointer min-w-0"
                        >
                          <img src={b.book_cover || 'https://api.dicebear.com/7.x/initials/svg?seed=Book'} className="w-10 h-14 rounded-lg object-cover bg-slate-100 border border-slate-200" alt="Cover" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">{b.book_title}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-bold">
                              Author: <span className="text-emerald-700 underline hover:text-emerald-900" onClick={(e) => { e.stopPropagation(); inspectCreator(b.submitted_by); }}>{b.submitted_by_name}</span>
                            </p>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono shrink-0 mr-2">
                            {formatDistanceToNow(new Date(b.submitted_at), { addSuffix: true })}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBook(b); }}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 transition-all active:scale-95 shrink-0"
                          title="Delete book"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Card>
                    );
                  })}
                  <Pagination
                    currentPage={booksPagination.currentPage}
                    totalPages={booksPagination.totalPages}
                    totalItems={booksPagination.totalItems}
                    startIndex={booksPagination.totalItems === 0 ? 0 : booksPagination.startIndex}
                    endIndex={booksPagination.endIndex}
                    onPageChange={booksPagination.goToPage}
                    onNext={booksPagination.nextPage}
                    onPrev={booksPagination.prevPage}
                  />
                </div>
              )}

              {/* Bulk Actions Section */}
              {selectedBookIds.length > 0 && (
                <Card className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center shadow-inner">
                  <div className="text-left">
                    <p className="text-xs font-black text-slate-700 uppercase">{selectedBookIds.length} Books Selected for Bulk Action</p>
                    <input
                      type="text"
                      placeholder="Add bulk decision note (required for rejections)..."
                      value={bulkNotes}
                      onChange={e => setBulkNotes(e.target.value)}
                      className="mt-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none w-80 shadow-sm"
                    />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button onClick={() => handleBulkBookAction('approved')} className="bg-green-600 hover:bg-green-700 text-white text-[10px] py-1.5 font-black uppercase rounded-lg border-none shadow-sm"><Check size={12} className="inline mr-1" /> Approve Selected</Button>
                    <Button onClick={() => handleBulkBookAction('needs_changes')} className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] py-1.5 font-black uppercase rounded-lg border-none shadow-sm"><RefreshCcw size={12} className="inline mr-1" /> Request Changes</Button>
                    <Button onClick={() => handleBulkBookAction('rejected')} className="bg-red-600 hover:bg-red-700 text-white text-[10px] py-1.5 font-black uppercase rounded-lg border-none shadow-sm"><ThumbsDown size={12} className="inline mr-1" /> Reject Selected</Button>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
        
        {/* ── Right Column: Inspect & Action Panel ── */}
        {hasSelection && (
          <div className="space-y-6">
            <Card className="bg-white border border-slate-200/80 p-6 rounded-3xl sticky top-8 shadow-sm flex flex-col min-h-[500px]">
              <div className="space-y-6 flex-1 flex flex-col justify-between text-left">
                <div className="space-y-5">
                  <div className="flex gap-4">
                    <img src={selectedBook.book_cover || 'https://api.dicebear.com/7.x/initials/svg?seed=Book'} className="w-12 h-16 rounded-lg object-cover bg-slate-100 border border-slate-200 shadow-sm" alt="Cover" />
                    <div>
                      <span className="text-[9px] font-black text-rose-700 uppercase bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">Audit Deck</span>
                      <h4 className="font-extrabold text-base text-slate-900 mt-2 leading-snug">{selectedBook.book_title}</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">
                        Author: <span className="text-emerald-700 underline cursor-pointer font-extrabold" onClick={() => inspectCreator(selectedBook.submitted_by)}>{selectedBook.submitted_by_name}</span>
                      </p>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Book details */}
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs space-y-2 leading-relaxed text-slate-700 shadow-inner">
                    <div className="flex justify-between">
                      <span className="text-slate-550 font-bold">Category:</span>
                      <span className="font-bold text-slate-900">{selectedBook.category || 'Educational Literature'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-550 font-bold">Price:</span>
                      <span className="font-extrabold text-slate-900">{formatCurrency(selectedBook.retail_price || 4500)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-550 font-bold">Format / Pages:</span>
                      <span className="font-semibold text-slate-800">PDF • 182 Pages</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2 mb-2">
                      <span className="text-slate-550 font-bold">Uploaded:</span>
                      <span className="font-semibold text-slate-800">{formatDate(selectedBook.submitted_at)}</span>
                    </div>
                    <div className="pt-1">
                      <span className="block text-slate-550 font-bold mb-1">Description:</span>
                      <p className="text-slate-800 italic">{selectedBook.description || 'No description provided.'}</p>
                    </div>
                  </div>

                  {/* Inline PDF Previewer (first 10-20 pages) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner space-y-3">
                    <p className="text-[10px] font-black text-slate-555 uppercase tracking-widest flex items-center gap-1"><BookOpenText size={12} className="text-green-600" /> Inline Preview (First 20 Pages)</p>
                    
                    <div className="p-4 bg-white border border-slate-200 rounded-xl min-h-[140px] flex items-center justify-center text-center text-xs text-slate-750 font-medium leading-relaxed italic shadow-sm">
                      {samplePages[(currentBookPage - 1) % samplePages.length]}
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 px-1">
                      <button
                        onClick={() => setCurrentBookPage(prev => Math.max(1, prev - 1))}
                        disabled={currentBookPage === 1}
                        className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        <ChevronLeft size={10} /> Prev
                      </button>
                      <span>Page {currentBookPage} / 20</span>
                      <button
                        onClick={() => setCurrentBookPage(prev => Math.min(20, prev + 1))}
                        disabled={currentBookPage === 20}
                        className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        Next <ChevronRight size={10} />
                      </button>
                    </div>

                    <a
                      href={selectedBook.file_url || '#'}
                      download
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Downloading manuscript file: ${selectedBook.book_title}.pdf [Admin Access Only]`);
                      }}
                      className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Download size={13} /> Download Manuscript (PDF)
                    </a>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckSquare size={13} /> Manuscript Checklist
                    </p>
                    
                    <div className="space-y-2 pt-1">
                      {[
                        { key: 'checklist_cover', label: 'High quality cover art' },
                        { key: 'checklist_description', label: 'Accurate description & categorizing' },
                        { key: 'checklist_readable', label: 'File is formatted and readable' },
                        { key: 'checklist_price', label: 'Fair and standard pricing model' },
                        { key: 'checklist_no_copyright', label: 'No intellectual property infringement' },
                      ].map(item => (
                        <label key={item.key} className="flex items-start gap-3 cursor-pointer group py-0.5">
                          <input 
                            type="checkbox"
                            checked={(bookChecklist as any)[item.key]}
                            onChange={e => setBookChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="w-4 h-4 bg-white border-slate-300 text-green-600 rounded focus:ring-green-550/20 mt-0.5 cursor-pointer"
                          />
                          <span className="text-xs text-slate-650 group-hover:text-slate-900 transition-colors font-medium">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Reviewer Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare size={13} /> Auditor Justification Note
                    </label>
                    <textarea
                      placeholder="Input justification for decision. Detailed instructions are required for rejected or needs_changes states..."
                      value={reviewNotes}
                      onChange={e => setReviewNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-green-550/10 min-h-[80px]"
                    />
                  </div>
                </div>

                {/* Submit Controls */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => submitBookReview('approved')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold border-none flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ThumbsUp size={14} /> Approve Book
                    </Button>
                    <Button
                      onClick={() => submitBookReview('needs_changes')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-250/60 text-amber-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <RefreshCcw size={14} /> Needs Changes
                    </Button>
                  </div>
                  <Button
                    onClick={() => submitBookReview('rejected')}
                    disabled={submitting}
                    className="h-11 rounded-xl bg-red-50 hover:bg-red-100 border border-red-250/60 text-red-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <ThumbsDown size={14} /> Reject Submission
                  </Button>
                </div>
              </div>
          </Card>
        </div>
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>

      {/* ── Creator Profile Modal ── */}
      {creatorProfileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-left">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="font-black text-base text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User size={16} className="text-green-600" /> Creator Profile Inspection
              </h4>
              <button 
                onClick={() => { setCreatorProfileId(null); setCreatorProfile(null); }}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-450 hover:text-slate-800 flex items-center justify-center transition-all font-bold"
              >
                ✕
              </button>
            </div>

            {loadingCreator ? (
              <div className="p-12 text-center text-slate-500 font-bold text-xs uppercase tracking-wider animate-pulse">
                Fetching creator catalog, history, and earnings...
              </div>
            ) : creatorProfile ? (
              <div className="overflow-y-auto p-6 space-y-8 flex-1">
                
                {/* Profile header */}
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                  <div className="flex gap-4 items-center">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${creatorProfile.id}`}
                      className="w-16 h-16 rounded-2xl object-cover bg-slate-100 border border-slate-200 shadow-sm"
                      alt="Avatar"
                    />
                    <div>
                      <h5 className="font-black text-lg text-slate-900">{creatorProfile.full_name}</h5>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">{creatorProfile.email}</p>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-2 border ${
                        creatorProfile.id_verification_status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        ID Status: {creatorProfile.id_verification_status}
                      </span>
                    </div>
                  </div>

                  {/* Rating / Catalog Counters */}
                  <div className="flex gap-4">
                    <div className="p-3 border border-slate-200 rounded-2xl bg-slate-50 text-center min-w-[70px] shadow-sm">
                      <span className="block text-[8px] font-black text-slate-450 uppercase">Rating</span>
                      <span className="text-lg font-black text-slate-900">⭐ {creatorProfile.rating}</span>
                    </div>
                    <div className="p-3 border border-slate-200 rounded-2xl bg-slate-50 text-center min-w-[70px] shadow-sm">
                      <span className="block text-[8px] font-black text-slate-450 uppercase">Courses</span>
                      <span className="text-lg font-black text-slate-900">{creatorProfile.courses.length}</span>
                    </div>
                    <div className="p-3 border border-slate-200 rounded-2xl bg-slate-50 text-center min-w-[70px] shadow-sm">
                      <span className="block text-[8px] font-black text-slate-450 uppercase">Books</span>
                      <span className="text-lg font-black text-slate-900">{creatorProfile.books.length}</span>
                    </div>
                  </div>
                </div>

                {/* Creator details section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Left Column: Creator credentials */}
                  <div className="space-y-4 md:col-span-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                    <div>
                      <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expertise</h6>
                      <p className="text-xs font-bold text-slate-750 mt-1">{creatorProfile.expertise}</p>
                    </div>
                    <div>
                      <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Qualifications</h6>
                      <p className="text-xs font-bold text-slate-750 mt-1">{creatorProfile.qualifications}</p>
                    </div>
                    <div>
                      <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Creator Bio</h6>
                      <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">{creatorProfile.bio}</p>
                    </div>
                  </div>

                  {/* Middle Column: Catalog lists & payouts */}
                  <div className="space-y-4 md:col-span-1">
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
                      <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><BookOpen size={12} className="text-green-600" /> Uploaded Items</h6>
                      
                      <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs">
                        {creatorProfile.courses.map(crs => (
                          <div key={crs.id} className="p-2 border border-slate-100 rounded-lg flex justify-between items-center bg-slate-50/20">
                            <span className="font-bold text-slate-800 truncate max-w-[120px]" title={crs.title}>{crs.title}</span>
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-green-50 text-green-700">{crs.status}</span>
                          </div>
                        ))}
                        {creatorProfile.books.map(bk => (
                          <div key={bk.id} className="p-2 border border-slate-100 rounded-lg flex justify-between items-center bg-slate-50/20">
                            <span className="font-bold text-slate-800 truncate max-w-[120px]" title={bk.title}>{bk.title}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Book</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
                      <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">💰 Financial Overview</h6>
                      
                      <div className="text-xs space-y-1.5 leading-relaxed text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-450 font-bold">Gross Sales:</span>
                          <span className="font-extrabold text-slate-900">{formatCurrency(creatorProfile.earnings.total_sales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-450 font-bold">Commission (30%):</span>
                          <span className="font-extrabold text-slate-900">{formatCurrency(creatorProfile.earnings.platform_commission)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-450 font-bold">Net Earnings (70%):</span>
                          <span className="font-black text-green-700">{formatCurrency(creatorProfile.earnings.net_vendor_share)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Direct Messaging & Suspension */}
                  <div className="space-y-4 md:col-span-1">
                    
                    {/* DM Card */}
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-52 justify-between">
                      <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><MessageSquare size={12} className="text-green-600" /> Direct Messaging</h6>
                      
                      <div className="flex-1 overflow-y-auto max-h-24 p-2 border border-slate-100 rounded-xl space-y-2 bg-slate-50 shadow-inner text-[10px]">
                        {creatorMessages.length === 0 ? (
                          <span className="text-slate-400 italic block text-center mt-2">No message history.</span>
                        ) : (
                          creatorMessages.map((msg, idx) => (
                            <div key={idx} className={`p-1.5 rounded-lg border leading-tight ${msg.sender_id === user?.id ? 'bg-green-50 border-green-100 ml-auto max-w-[80%]' : 'bg-white border-slate-250 max-w-[80%]'}`}>
                              <p className="font-semibold text-slate-750">{msg.content}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="flex gap-1 pt-2">
                        <input
                          type="text"
                          placeholder="Send message..."
                          value={creatorDmText}
                          onChange={e => setCreatorDmText(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none"
                        />
                        <button onClick={handleSendCreatorDm} className="p-2 bg-slate-900 text-white rounded-lg"><Send size={12} /></button>
                      </div>
                    </div>

                    {/* Suspension Actions */}
                    <div className="p-4 bg-rose-50 border border-rose-250 rounded-2xl shadow-sm space-y-3">
                      <h6 className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-1"><ShieldAlert size={12} /> Compliance Restrictions</h6>
                      
                      <textarea
                        placeholder="State reason for restriction..."
                        value={creatorSuspensionReason}
                        onChange={e => setCreatorSuspensionReason(e.target.value)}
                        className="w-full bg-white border border-rose-200 rounded-xl p-2 text-xs text-slate-800 outline-none min-h-[50px] shadow-sm"
                      />
                      
                      <Button
                        onClick={() => handleToggleCreatorSuspension(true)}
                        className="w-full bg-red-650 hover:bg-red-750 text-white text-[10px] py-2 font-black uppercase rounded-lg border-none shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <ThumbsDown size={12} /> Suspend Creator
                      </Button>
                    </div>

                  </div>

                </div>
              </div>
            ) : null}
            </div>
          </div>
        )}

      {/* ── Course Detailed Audit Modal ── */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-305">
          <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[90vh] text-left animate-in zoom-in-95 duration-305">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <img src={selectedCourse.course_thumbnail || 'https://api.dicebear.com/7.x/initials/svg?seed=Course'} className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200" alt="Thumbnail" />
                <div>
                  <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 uppercase">Course Audit</span>
                  <h4 className="font-extrabold text-lg text-slate-900 mt-1">{selectedCourse.course_title}</h4>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCourse(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-450 hover:text-slate-800 flex items-center justify-center transition-all font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left Panel: Class Series Details */}
              <div className="w-full lg:w-80 border-r border-slate-200 bg-slate-50/40 p-6 overflow-y-auto space-y-6">
                <div>
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Class Series Details</h5>
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl text-xs space-y-3 shadow-sm">
                    <div>
                      <span className="block text-slate-450 font-bold">Instructor:</span>
                      <span className="font-extrabold text-green-700 underline cursor-pointer" onClick={() => inspectCreator(selectedCourse.submitted_by)}>
                        {selectedCourse.submitted_by_name}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-450 font-bold">Category:</span>
                      <span className="font-bold text-slate-800">{selectedCourse.category || 'Tech & Software Engineering'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-450 font-bold">Standard Price:</span>
                      <span className="font-extrabold text-slate-900">{selectedCourse.price_standard ? formatCurrency(selectedCourse.price_standard) : 'Free'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-450 font-bold">Elite (Coaching) Price:</span>
                      <span className="font-extrabold text-slate-900">{selectedCourse.price_elite ? formatCurrency(selectedCourse.price_elite) : 'N/A'}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <span className="block text-slate-450 font-bold mb-1">Description:</span>
                      <p className="text-slate-800 italic">{selectedCourse.description || 'No description provided.'}</p>
                    </div>
                    <div>
                      <span className="block text-slate-450 font-bold">Submitted Date:</span>
                      <span className="font-semibold text-slate-700">{formatDate(selectedCourse.submitted_at)}</span>
                    </div>
                    <div>
                      <span className="block text-slate-450 font-bold">Current Status:</span>
                      <span className="inline-block px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-200/60 mt-1">
                        {selectedCourse.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl text-xs space-y-2 text-slate-650 leading-relaxed shadow-sm">
                  <p className="font-bold text-slate-800">Audit SLA Instruction</p>
                  <p>Verify all video content has clear audio and matches standard quality checks. Ensure class materials are uploaded and contain readable PDFs, ZIP files, or external project resources.</p>
                </div>
              </div>

              {/* Right Panel: Workspace Tabs */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Workspace Tabs Selector */}
                <div className="flex border-b border-slate-200 bg-slate-50/20 px-6 pt-3">
                  <button
                    onClick={() => setCourseModalTab('video')}
                    className={`px-5 py-3 rounded-t-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 border-b-2 -mb-[2px] ${
                      courseModalTab === 'video'
                        ? 'text-green-700 border-green-600 font-extrabold bg-white'
                        : 'text-slate-500 hover:text-slate-800 border-transparent'
                    }`}
                  >
                    🎥 Videos & Quality Check
                  </button>
                  <button
                    onClick={() => setCourseModalTab('materials')}
                    className={`px-5 py-3 rounded-t-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 border-b-2 -mb-[2px] ${
                      courseModalTab === 'materials'
                        ? 'text-green-700 border-green-600 font-extrabold bg-white'
                        : 'text-slate-500 hover:text-slate-800 border-transparent'
                    }`}
                  >
                    📂 Course Materials ({courseCurriculum?.materials?.length || 0})
                  </button>
                </div>

                {/* Tab Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  {courseModalTab === 'video' ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full items-start">
                      {/* Left: Lessons outline */}
                      <div className="md:col-span-4 space-y-3">
                        <p className="text-[10px] font-black text-slate-550 uppercase tracking-widest flex items-center gap-1.5">
                          <ListCollapse size={13} className="text-green-600" /> Lessons Outline
                        </p>
                        
                        {loadingCurriculum ? (
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider animate-pulse">Loading curriculum...</p>
                        ) : courseCurriculum?.modules?.length > 0 ? (
                          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 text-[11px]">
                            {courseCurriculum.modules.map((mod: any, mIdx: number) => (
                              <div key={mod.id} className="space-y-1">
                                <p className="font-extrabold text-slate-800 text-xs">Module {mIdx + 1}: {mod.title}</p>
                                <div className="pl-3 border-l border-slate-200 space-y-1">
                                  {mod.lessons?.map((les: any) => (
                                    <button
                                      key={les.id}
                                      onClick={() => handleSelectLesson(les, selectedCourse.id)}
                                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-[10px] transition-all ${
                                        activeLesson?.id === les.id
                                          ? 'bg-green-50 border border-green-200 text-green-700 font-bold'
                                          : 'bg-white hover:bg-slate-50 text-slate-650 border border-slate-100'
                                      }`}
                                    >
                                      <span className="truncate max-w-[150px] flex items-center gap-1"><Play size={10} /> {les.title}</span>
                                      <span className="text-[8px] font-black uppercase text-slate-400 font-mono">{les.duration ? `${Math.floor(les.duration / 60)}m` : '0m'}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 font-semibold">No lessons/modules staging setup found.</p>
                        )}
                      </div>

                      {/* Right: Player & annotations */}
                      <div className="md:col-span-8 space-y-4">
                        {activeLesson ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-slate-55 border border-slate-200/60 shadow-inner space-y-3">
                              <p className="text-[10px] font-black text-slate-550 uppercase tracking-widest">Video Player ({activeLesson.title})</p>
                              
                              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-200 shadow-sm">
                                <video
                                  ref={videoRef}
                                  src={activeLesson.content_url || 'https://storage.googleapis.com/trileza-videos/intro-mentor-1.mp4'}
                                  controls
                                  onTimeUpdate={updateNewAnnotationTimeFromVideo}
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-[9px] font-mono text-slate-500 text-center">
                                <div className="p-1 border border-slate-200 bg-white rounded-lg">
                                  <span className="block font-black text-slate-450 uppercase">Resolution</span>
                                  <span className="font-extrabold text-slate-700">1080p [Pass]</span>
                                </div>
                                <div className="p-1 border border-slate-200 bg-white rounded-lg">
                                  <span className="block font-black text-slate-450 uppercase">File size</span>
                                  <span className="font-extrabold text-slate-700">23.4 MB</span>
                                </div>
                                <div className="p-1 border border-slate-200 bg-white rounded-lg">
                                  <span className="block font-black text-slate-450 uppercase">Duration</span>
                                  <span className="font-extrabold text-slate-700">2m 45s</span>
                                </div>
                              </div>
                            </div>

                            <div className="p-4 bg-slate-55 border border-slate-200/60 shadow-inner space-y-3">
                              <p className="text-[10px] font-black text-slate-550 uppercase tracking-widest">Timestamped Annotations ({videoAnnotations.length})</p>
                              
                              <div className="max-h-40 overflow-y-auto space-y-1.5 text-[10px]">
                                {videoAnnotations.length === 0 ? (
                                  <p className="text-slate-400 italic text-center py-2">No annotations added yet for this lesson.</p>
                                ) : (
                                  videoAnnotations.map(ann => (
                                    <div key={ann.id} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-start gap-2">
                                      <div>
                                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${
                                          ann.type === 'Correction Required' ? 'text-red-700 bg-red-50 border border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200'
                                        }`}>
                                          at {ann.timestamp} • {ann.type}
                                        </span>
                                        <p className="text-slate-650 mt-1 font-semibold">{ann.note}</p>
                                      </div>
                                      <button onClick={() => handleDeleteAnnotation(ann.id)} className="text-red-500 hover:text-red-750 shadow-sm shrink-0"><Trash2 size={11} /></button>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="space-y-1.5 pt-2 border-t border-slate-200 flex gap-2 items-center flex-wrap sm:flex-nowrap">
                                <input
                                  type="text"
                                  placeholder="0:00"
                                  value={newAnnotationTime}
                                  onChange={e => setNewAnnotationTime(e.target.value)}
                                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] w-14 font-bold text-slate-800 text-center outline-none"
                                />
                                <select
                                  value={newAnnotationType}
                                  onChange={e => setNewAnnotationType(e.target.value as any)}
                                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-bold text-slate-700 outline-none"
                                >
                                  <option value="Correction Required">Correction</option>
                                  <option value="Suggestion">Suggestion</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="glitch details..."
                                  value={newAnnotationNote}
                                  onChange={e => setNewAnnotationNote(e.target.value)}
                                  className="flex-1 min-w-[120px] bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-800 outline-none"
                                />
                                <button
                                  onClick={handleSaveAnnotation}
                                  className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm shrink-0"
                                >
                                  <Check size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-12 text-center border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl">
                            <Play size={32} className="text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-400 font-bold uppercase">Select a lesson from the outline to play video</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Materials & checklist tab */
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start h-full">
                      {/* Left: Materials list */}
                      <div className="md:col-span-5 space-y-4">
                        <p className="text-[10px] font-black text-slate-550 uppercase tracking-widest flex items-center gap-1.5">
                          <Paperclip size={13} className="text-green-600" /> Class Materials & Assets
                        </p>

                        {courseCurriculum?.materials?.length > 0 ? (
                          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                            {courseCurriculum.materials.map((mat: any) => (
                              <div
                                key={mat.id}
                                className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-4 transition-all shadow-sm"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-650 shadow-sm shrink-0">
                                    {mat.type === 'pdf' ? <FileText size={16} className="text-red-500" /> :
                                     mat.type === 'zip' ? <Download size={16} className="text-blue-500" /> :
                                     mat.type === 'link' ? <ExternalLink size={16} className="text-green-500" /> :
                                     <FileText size={16} className="text-slate-500" />}
                                  </div>
                                  <div className="min-w-0">
                                    <h6 className="font-extrabold text-xs text-slate-900 truncate" title={mat.name}>{mat.name || 'Untitled Material'}</h6>
                                    <p className="text-[9px] text-slate-550 uppercase font-black tracking-wider mt-0.5">{mat.type} {mat.size ? `• ${mat.size}` : ''}</p>
                                  </div>
                                </div>
                                
                                {mat.url && (
                                  <a
                                    href={mat.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-green-300 rounded-xl text-[10px] font-black uppercase text-slate-700 hover:text-green-700 shadow-sm flex items-center gap-1 shrink-0 transition-all"
                                  >
                                    <ExternalLink size={10} /> View
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center border border-dashed border-slate-250 bg-slate-50/50 rounded-2xl shadow-sm">
                            <Paperclip size={24} className="text-slate-350 mx-auto mb-2" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">No class materials submitted for this course.</p>
                          </div>
                        )}
                      </div>

                      {/* Right: Checklist and review controls */}
                      <div className="md:col-span-7 space-y-6">
                        <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl shadow-inner space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <CheckSquare size={13} /> Curriculum Quality Checklist
                          </p>
                          
                          <div className="space-y-2.5 pt-1 text-left">
                            {[
                              { key: 'checklist_title', label: 'Descriptive, professional title' },
                              { key: 'checklist_description', label: 'Clear course summary and goals' },
                              { key: 'checklist_curriculum', label: 'Syllabus has 5+ structured lessons' },
                              { key: 'checklist_video', label: 'HD video resolution (720p minimum)' },
                              { key: 'checklist_audio', label: 'Audio is clear and background noise-free' },
                              { key: 'checklist_thumbnail', label: 'Thumbnail is clean and professional' },
                              { key: 'checklist_no_copyright', label: 'No intellectual property infringement' },
                            ].map(item => (
                              <label key={item.key} className="flex items-start gap-3 cursor-pointer group py-0.5">
                                <input 
                                  type="checkbox"
                                  checked={(courseChecklist as any)[item.key]}
                                  onChange={e => setCourseChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                  className="w-4 h-4 bg-white border-slate-300 text-green-600 rounded focus:ring-green-550/20 mt-0.5 cursor-pointer"
                                />
                                <span className="text-xs text-slate-650 group-hover:text-slate-900 transition-colors font-semibold">{item.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <MessageSquare size={13} /> Auditor Justification Note
                          </label>
                          <textarea
                            placeholder="Input justification for decision. Detailed instructions are required for rejected or needs_changes states..."
                            value={reviewNotes}
                            onChange={e => setReviewNotes(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-green-550/10 min-h-[90px]"
                          />
                        </div>

                        <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              onClick={() => submitCourseReview('approved')}
                              disabled={submitting}
                              className="h-11 bg-green-600 hover:bg-green-700 text-white font-bold border-none rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <ThumbsUp size={14} /> Approve
                            </Button>
                            <Button
                              onClick={() => submitCourseReview('needs_changes')}
                              disabled={submitting}
                              className="h-11 bg-amber-50 hover:bg-amber-100 border border-amber-250/60 text-amber-700 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <RefreshCcw size={14} /> Needs Changes
                            </Button>
                          </div>
                          <Button
                            onClick={() => submitCourseReview('rejected')}
                            disabled={submitting}
                            className="h-11 bg-red-50 hover:bg-red-100 border border-red-250/60 text-red-700 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <ThumbsDown size={14} /> Reject Submission
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        loading={submitting}
        onConfirm={async () => {
          await confirmDialog.action();
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default ContentManagerDashboard;
