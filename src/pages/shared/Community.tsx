import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { 
  Users, MessageSquare, Search, CheckCircle2,
  Heart, Share2, Award, MoreVertical, Send,
  Image as ImageIcon, Video, Calendar, Bell, BellOff, Link, Clock, X, Radio, Rss
} from 'lucide-react';
import { cn } from '../../utils';
import { Toast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';
import { liveService, type LiveSession } from '../../lib/services/live';
import ShareMeetingModal from '../../components/live/ShareMeetingModal';
import { Feeds } from './Feeds';

const STUDY_POD_THUMBNAILS = [
  { id: 'uiux', name: 'UI/UX Design', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop' },
  { id: 'react', name: 'React Development', url: 'https://images.unsplash.com/photo-1517245385169-d238b036de88?w=600&h=400&fit=crop' },
  { id: 'algo', name: 'Algorithms', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop' },
  { id: 'cyber', name: 'Cyber Security', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&h=400&fit=crop' }
];

const CommunityPortal: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'feed' | 'live' | 'schedule'>('feed');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [previewProfile, setPreviewProfile] = useState<any | null>(null);
  
  // Data States
  const [liveMeetings, setLiveMeetings] = useState<LiveSession[]>([]);
  const [scheduledMeetings, setScheduledMeetings] = useState<LiveSession[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Sharing states
  const [shareMeeting, setShareMeeting] = useState<LiveSession | null>(null);

  // Feed composer & Image attachment state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentInputText, setCommentInputText] = useState('');

  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ message: msg, type });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showFeedback('Image size must be under 5MB', 'info');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderFormattedContent = (content: string) => {
    if (!content) return null;
    const parts = content.split(/(@[a-zA-Z0-9_\-\.\s]+?\b|@[a-zA-Z0-9_\-]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const cleanName = part.replace(/^@/, '').trim();
        const matchedProfile = profiles.find(
          p => (p.username && p.username.toLowerCase() === cleanName.toLowerCase()) ||
               (p.full_name && p.full_name.toLowerCase() === cleanName.toLowerCase()) ||
               (p.full_name && p.full_name.toLowerCase().includes(cleanName.toLowerCase()))
        );

        return (
          <span
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              if (matchedProfile) {
                setPreviewProfile(matchedProfile);
              } else {
                showFeedback(`Tagged: ${part}`, 'info');
              }
            }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold cursor-pointer hover:bg-emerald-500/20 transition-colors"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const getMentionMatches = (text: string) => {
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex === -1) return [];
    const query = text.slice(lastAtIndex + 1).toLowerCase();
    if (query.includes(' ')) return [];
    return profiles.filter(p => 
      (p.full_name && p.full_name.toLowerCase().includes(query)) ||
      (p.username && p.username.toLowerCase().includes(query))
    ).slice(0, 4);
  };

  const toggleReminder = (meetingId: string) => {
    let updated;
    if (reminders.includes(meetingId)) {
      updated = reminders.filter(id => id !== meetingId);
      showFeedback('Reminder cancelled.', 'info');
    } else {
      updated = [...reminders, meetingId];
      showFeedback('🔔 Reminder set! We will alert you before class starts.', 'success');
    }
    setReminders(updated);
    localStorage.setItem('trileza_meeting_reminders', JSON.stringify(updated));
  };

  const [reminders, setReminders] = useState<string[]>(() => {
    const stored = localStorage.getItem('trileza_meeting_reminders');
    return stored ? JSON.parse(stored) : [];
  });

  const fetchData = async (isFirstLoad = false) => {
    if (isFirstLoad) {
      setLoadingMeetings(true);
      setLoadingPosts(true);
    }
    try {
      const meetingsData = await liveService.getCourseSessions('global');
      if (meetingsData) {
        const now = new Date();
        setLiveMeetings(meetingsData.filter(m => m.status === 'live' || (m.status === 'scheduled' && new Date(m.scheduled_at) <= now)));
        setScheduledMeetings(meetingsData.filter(m => m.status === 'scheduled' && new Date(m.scheduled_at) > now));
      }

      const { data: profilesData } = await nexus.database.from('profiles').select('*');
      if (profilesData) {
        setProfiles(profilesData);
      }
      const profilesMap = new Map((profilesData || []).map((prof: any) => [prof.id, prof]));

      const { data: postsData, error: postsError } = await nexus.database
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;
      if (postsData) {
        const { data: commentsData } = await nexus.database.from('comments').select('*').order('created_at', { ascending: true });

        const mappedPosts = postsData.map((post: any) => {
          const author = profilesMap.get(post.author_id) || {
            id: post.author_id,
            full_name: 'Academic Scholar',
            role: 'User',
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_id}`
          };
          const postComments = (commentsData || []).filter((c: any) => c.post_id === post.id);
          const mappedComments = postComments.map((c: any) => {
            const commentAuthor = profilesMap.get(c.author_id) || {
              id: c.author_id,
              full_name: 'Peer Scholar',
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.author_id}`
            };
            return {
              id: c.id,
              author: commentAuthor,
              user: {
                name: commentAuthor.full_name,
                avatar: commentAuthor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${commentAuthor.full_name}`
              },
              text: c.content,
              time: 'Recently'
            };
          });

          return {
            id: post.id,
            author: author,
            user: {
              name: author.full_name,
              role: author.role === 'tutor' || author.role === 'mentor' ? 'Tutor' : 'Student',
              avatar: author.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author.full_name}`,
              points: 1000
            },
            time: 'Recently',
            content: post.content,
            likes: post.likes_count,
            imageUrl: post.image_url,
            isAd: post.is_ad,
            replies: mappedComments
          };
        });
        setPosts(mappedPosts);
      }
    } catch (err) {
      console.error('[Community] Failed to load data from database:', err);
    } finally {
      if (isFirstLoad) {
        setLoadingMeetings(false);
        setLoadingPosts(false);
      }
    }
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreatePost = async () => {
    if ((!newPostContent.trim() && !selectedImage) || !user) return;
    try {
      const { error } = await nexus.database.from('posts').insert([{
        author_id: user.id,
        content: newPostContent,
        image_url: selectedImage || null,
        is_ad: false,
        likes_count: 0
      }]);
      if (error) throw error;
      setNewPostContent('');
      setSelectedImage(null);
      showFeedback('Post successfully published!');
      fetchData(false);
    } catch (err) {
      console.error('[Community] Failed to create post:', err);
      showFeedback('Failed to publish post', 'info');
    }
  };

  const handleLikePost = async (post: any) => {
    if (!user) return;
    try {
      const { data: alreadyLiked } = await nexus.database
        .from('post_likes')
        .select('*')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (alreadyLiked) {
        showFeedback('You already liked this post!', 'info');
        return;
      }

      await nexus.database.from('post_likes').insert([{ post_id: post.id, user_id: user.id }]);
      await nexus.database.from('posts').update({ likes_count: post.likes + 1 }).eq('id', post.id);
      
      showFeedback('+1 Reaction logged');
      fetchData();
    } catch (err) {
      console.error('[Community] Failed to like post:', err);
    }
  };

  const handleSharePost = (post: any) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/community#post-${post.id}`);
    }
    showFeedback('🔗 Post link copied to clipboard!');
  };

  const getHostName = (tutorId: string) => {
    const hostProfile = profiles.find(p => p.id === tutorId);
    return hostProfile ? hostProfile.full_name : 'Academic Expert';
  };

  const getMeetingThumbnail = (session: LiveSession) => {
    if (session.image_url) return session.image_url;
    const index = Math.abs(session.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % STUDY_POD_THUMBNAILS.length;
    return STUDY_POD_THUMBNAILS[index].url;
  };

  const handleJoinMeeting = (session: LiveSession) => {
    if (window.innerWidth >= 768) {
      window.open(`/live/${session.dyte_meeting_id}`, '_blank');
    } else {
      navigate(`/live/${session.dyte_meeting_id}`);
    }
  };

  const handleStartScheduledMeeting = async (session: LiveSession) => {
    try {
      showFeedback('Starting classroom session...', 'info');
      await liveService.updateStatus(session.id, 'live');
      
      if (window.innerWidth >= 768) {
        window.open(`/live/${session.dyte_meeting_id}`, '_blank');
      } else {
        navigate(`/live/${session.dyte_meeting_id}`);
      }
      
      fetchData();
    } catch (err: any) {
      console.error('[Community] Failed to start scheduled meeting:', err);
      showFeedback(`Failed to start session: ${err.message || err.toString()}`, 'info');
    }
  };

  const totalMembers = (profiles.length || 4) * 452;
  const postMentionMatches = getMentionMatches(newPostContent);
  const commentMentionMatches = getMentionMatches(commentInputText);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 w-full font-sans">
      <PageHeader 
        title="Community Hub"
        description="Connect, collaborate, share insights, and study together with your cohort peers."
        tag="Global Network"
        icon={Users}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        <div className="lg:col-span-3 space-y-6">
          
          <div className="flex gap-2 sm:gap-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar pb-2">
            {[
              { id: 'feed', label: 'Feeds', icon: Rss },
              { id: 'live', label: 'Live Meetings', icon: Radio, count: liveMeetings.length },
              { id: 'schedule', label: 'Scheduled Meetings', icon: Calendar, count: scheduledMeetings.length }
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-4 sm:px-6 py-3 rounded-xl sm:rounded-t-xl font-bold transition-all whitespace-nowrap text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shrink-0 border-none",
                    activeTab === tab.id 
                      ? "text-white bg-emerald-600 shadow-md shadow-emerald-600/20" 
                      : "text-slate-500 hover:text-slate-900 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  <TabIcon size={14} className={activeTab === tab.id ? "text-white" : "text-emerald-500"} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black",
                      activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === 'schedule' && (
            <div className="space-y-4 animate-in fade-in duration-500 text-left">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5 mb-6">
                <Calendar size={16} className="text-emerald-500" /> Upcoming Scheduled meetings ({scheduledMeetings.length})
              </h3>

              {loadingMeetings ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2].map(i => (
                    <Card key={i} className="h-56 animate-pulse bg-slate-150 dark:bg-slate-800 border-none rounded-[2.5rem]" />
                  ))}
                </div>
              ) : scheduledMeetings.length === 0 ? (
                <div className="p-12 bg-slate-50 dark:bg-slate-900/10 rounded-[2.5rem] text-center border border-slate-100 dark:border-slate-850">
                  <p className="text-xs font-semibold text-slate-400">No upcoming meetings scheduled. Visit the Live Studio to set one up!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {scheduledMeetings.map((meeting) => {
                    const hasReminder = reminders.includes(meeting.id);
                    const hostName = getHostName(meeting.tutor_id);

                    return (
                      <Card 
                        key={meeting.id} 
                        className="p-0 overflow-hidden border border-slate-100 dark:border-slate-850 shadow-md hover:shadow-xl rounded-2xl group transition-all duration-300 bg-white dark:bg-slate-900/50 flex flex-col justify-between"
                      >
                        <div className="relative">
                          <div className="absolute top-4 right-4 bg-emerald-950/80 backdrop-blur-md text-emerald-400 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20 border border-emerald-800">
                            <Calendar size={10} /> {new Date(meeting.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                          
                          <div className="h-36 overflow-hidden relative">
                            <div className="absolute inset-0 bg-slate-950/30 group-hover:bg-slate-950/15 transition-colors z-10" />
                            <img src={getMeetingThumbnail(meeting)} alt={meeting.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          </div>
                          
                          <div className="p-6 relative text-left">
                            <div className="absolute -top-6 left-6 shadow-md flex items-center z-20 bg-white dark:bg-slate-900 p-1 rounded-xl">
                              <span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {meeting.recurring && meeting.recurring !== 'none' ? `Recurring: ${meeting.recurring}` : 'Syllabus Class'}
                              </span>
                            </div>

                            <div className="mt-4 space-y-1">
                              <h4 className="font-black text-lg text-slate-905 dark:text-white leading-snug group-hover:text-emerald-500 transition-colors">
                                {meeting.title}
                              </h4>
                              <p className="text-slate-450 dark:text-slate-400 text-xs font-semibold leading-normal mt-1">
                                Scheduled broadcast by <strong className="text-slate-700 dark:text-slate-350">{hostName}</strong>
                              </p>
                            </div>
                            
                            <div className="flex gap-4 mt-4 bg-slate-50 dark:bg-slate-850/40 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-650 dark:text-slate-400 font-bold uppercase tracking-wider">
                                <Clock size={12} className="text-emerald-500" />
                                {new Date(meeting.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="px-6 pb-6 pt-0 flex gap-2 w-full">
                          <Button 
                            variant="outline"
                            onClick={() => setShareMeeting(meeting)}
                            className="rounded-xl h-11 px-4 border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-center cursor-pointer hover:bg-slate-100"
                            title="Share meeting details"
                          >
                            <Share2 size={14} className="text-slate-550" />
                          </Button>

                          <button
                            onClick={() => toggleReminder(meeting.id)}
                            className={cn(
                              "flex-1 rounded-xl h-11 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all active:scale-[0.98] cursor-pointer",
                              hasReminder 
                                ? "bg-emerald-50 border-emerald-250 text-emerald-650 dark:bg-emerald-950/20 dark:border-emerald-900/30" 
                                : "bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-305"
                            )}
                          >
                            {hasReminder ? (
                              <>
                                <BellOff size={12} /> Reminder Set
                              </>
                            ) : (
                              <>
                                <Bell size={12} /> Set Reminder
                              </>
                            )}
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-4 animate-in fade-in duration-500 text-left">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-905 dark:text-white flex items-center gap-1.5 mb-6">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> Live Now ({liveMeetings.length})
              </h3>
              
              {loadingMeetings ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2].map(i => (
                    <Card key={i} className="h-56 animate-pulse bg-slate-150 dark:bg-slate-800 border-none rounded-[2.5rem]" />
                  ))}
                </div>
              ) : liveMeetings.length === 0 ? (
                <div className="p-12 bg-slate-50 dark:bg-slate-900/10 rounded-[2.5rem] text-center border border-slate-100 dark:border-slate-850">
                  <p className="text-xs font-semibold text-slate-400">No meetings are live right now. Visit the Live Studio to start one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {liveMeetings.map((meeting) => {
                    const hostName = getHostName(meeting.tutor_id);

                    return (
                      <Card 
                        key={meeting.id} 
                        className="p-0 overflow-hidden border border-slate-100 dark:border-slate-850 shadow-md hover:shadow-xl rounded-2xl group transition-all duration-300 bg-white dark:bg-slate-900/50 flex flex-col justify-between"
                      >
                        <div className="relative">
                          <div className={cn(
                            "absolute top-4 right-4 backdrop-blur-md text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20 border",
                            meeting.status === 'scheduled' 
                              ? "bg-slate-950/80 border-slate-800 text-slate-400" 
                              : "bg-red-950/80 border-red-800 text-red-200"
                          )}>
                            {meeting.status === 'scheduled' ? (
                              <>
                                <Clock size={10} className="text-amber-500 animate-pulse" /> Pending Start
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" /> Live
                              </>
                            )}
                          </div>
                          
                          <div className="h-36 overflow-hidden relative">
                            <div className="absolute inset-0 bg-emerald-950/30 group-hover:bg-emerald-950/15 transition-colors z-10" />
                            <img src={getMeetingThumbnail(meeting)} alt={meeting.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          </div>
                          
                          <div className="p-6 relative text-left">
                            <div className="absolute -top-6 left-6 shadow-md flex items-center z-20 bg-white dark:bg-slate-900 p-1 rounded-xl">
                              <span className={cn(
                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                meeting.status === 'scheduled'
                                  ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                                  : "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                              )}>
                                {meeting.status === 'scheduled' ? 'Scheduled Class' : 'Active Hub'}
                              </span>
                            </div>
 
                            <div className="mt-4 space-y-1">
                              <h4 className="font-black text-lg text-slate-900 dark:text-white leading-snug group-hover:text-emerald-500 transition-colors">
                                {meeting.title}
                              </h4>
                              <p className="text-slate-450 dark:text-slate-400 text-xs font-semibold leading-normal mt-1">
                                Hosted by <strong className="text-slate-700 dark:text-slate-350">{hostName}</strong>
                              </p>
                            </div>
                          </div>
                        </div>
 
                        <div className="px-6 pb-6 pt-0 flex gap-2 w-full">
                          <Button 
                            variant="outline"
                            onClick={() => setShareMeeting(meeting)}
                            className="rounded-xl h-11 px-4 border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-center cursor-pointer hover:bg-slate-100"
                            title="Share live link"
                          >
                            <Share2 size={14} className="text-slate-550" />
                          </Button>
                          
                          {meeting.status === 'scheduled' ? (
                            meeting.tutor_id === user?.id ? (
                              <Button 
                                className="flex-1 rounded-xl font-black uppercase tracking-wider text-[10px] bg-emerald-600 text-white hover:bg-emerald-750 transition-all border-none h-11 cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                                onClick={() => handleStartScheduledMeeting(meeting)}
                              >
                                <Radio size={12} className="animate-pulse" /> Start Session
                              </Button>
                            ) : (
                              <Button 
                                disabled
                                className="flex-1 rounded-xl font-black uppercase tracking-wider text-[10px] bg-slate-105 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-250 dark:border-slate-800 h-11 pointer-events-none"
                              >
                                Waiting for Host
                              </Button>
                            )
                          ) : (
                            <Button 
                              className="flex-1 rounded-xl font-black uppercase tracking-wider text-[10px] bg-emerald-600 text-white hover:bg-emerald-750 transition-all border-none h-11 cursor-pointer shadow-md" 
                              onClick={() => handleJoinMeeting(meeting)}
                            >
                              Request Access
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="animate-in fade-in duration-500 text-left">
              <Feeds hideHeader={true} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-xl rounded-2xl p-6 bg-slate-950 text-white text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
            <h3 className="font-black text-xs uppercase tracking-wider text-emerald-400 mb-4">Network Activity</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Live Classrooms</span>
                <span className="text-sm font-black text-white">{liveMeetings.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Scheduled sessions</span>
                <span className="text-sm font-black text-white">{scheduledMeetings.length}</span>
              </div>

            </div>
          </Card>
        </div>

      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Share Meeting Modal */}
      {shareMeeting && (
        <ShareMeetingModal
          isOpen={!!shareMeeting}
          onClose={() => setShareMeeting(null)}
          meeting={{
            id: shareMeeting.id,
            title: shareMeeting.title,
            scheduled_at: shareMeeting.scheduled_at,
            dyte_meeting_id: shareMeeting.dyte_meeting_id,
            image_url: shareMeeting.image_url,
            recurring: shareMeeting.recurring
          }}
          hostName={getHostName(shareMeeting.tutor_id)}
        />
      )}

      {/* Profile Preview Modal */}
      {previewProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 max-w-sm w-full mx-4 shadow-2xl relative border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <button 
              onClick={() => setPreviewProfile(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-750 transition-colors border-none bg-transparent cursor-pointer"
            >
              <X size={16} />
            </button>
            <div className="flex flex-col items-center gap-2.5">
              <img 
                src={previewProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${previewProfile.full_name}`} 
                className="w-20 h-20 rounded-full object-cover ring-4 ring-emerald-500/10" 
                alt="" 
              />
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">{previewProfile.full_name}</h4>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  {previewProfile.username ? `@${previewProfile.username}` : previewProfile.role}
                </p>
              </div>
            </div>
            {previewProfile.bio && (
              <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl">
                {previewProfile.bio}
              </p>
            )}
            {previewProfile.id !== user?.id && (
              <Button 
                onClick={() => {
                  setPreviewProfile(null);
                  navigate(`/messages?chat=${previewProfile.id}`);
                }}
                className="w-full rounded-2xl py-3 bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-wider text-xs text-white border-none cursor-pointer"
              >
                Send Message
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityPortal;
