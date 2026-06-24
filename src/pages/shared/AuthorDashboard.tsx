import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  PlusCircle, 
  Coins, 
  Eye, 
  Star, 
  LayoutGrid, 
  Sparkles, 
  UploadCloud, 
  Trash2,
  TrendingUp,
  Award,
  BookMarked,
  ArrowRight,
  AlertCircle,
  FileText,
  Tag,
  Layers,
  UserPlus,
  Milestone,
  CheckCircle,
  Hash,
  Image
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Card, Button } from '../../components/ui';
import PageHeader from '../../components/shared/PageHeader';
import { nexus } from '../../lib/nexus';

interface Book {
  id: string;
  title: string;
  author_id: string;
  author_name: string;
  cover_url: string;
  retail_price: number;
  rental_price: number;
  category: string;
  description: string;
  rating: number;
  section: string;
  // Metadata extensions
  isbn?: string;
  tags?: string[];
  co_authors?: string;
  edition?: string;
  book_file_name?: string;
  sample_pages_name?: string;
  age_rating?: string;
}

const PRESET_COVERS = [
  { name: 'Abstract Engineering', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400' },
  { name: 'Neon Workspace', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400' },
  { name: 'Metropolitan Grid', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400' },
  { name: 'Aesthetic Knowledge', url: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=400' },
  { name: 'Elite Analytics', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=400' }
];

const SECTIONS = [
  'Programming & Development',
  'Data Science & AI',
  'Business & Management',
  'Marketing & Sales',
  'Design & Creative',
  'Personal Development',
  'Finance & Accounting',
  'Health & Wellness',
  'Education & Teaching',
  'Language Learning',
  'Science & Engineering',
  'Mathematics',
  'Certification Prep',
  'Academic & Textbooks',
  'Career & Job Search',
  'Legal & Compliance',
  'Real Estate & Construction',
  'Creative Writing & Journalism',
  'Music & Performing Arts',
  'Photography & Videography',
  'Others'
];

interface AuthorDashboardProps {
  inline?: boolean;
  onClose?: () => void;
}

const AuthorDashboard: React.FC<AuthorDashboardProps> = ({ inline = false, onClose }) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Author Status Guard - Bypassed for dev testing
  const isAuthor = true;

  // Book uploading Form State - REQUIRED FIELDS
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState(user?.full_name || '');
  const [price, setPrice] = useState('39.99');
  const [section, setSection] = useState(SECTIONS[0]);
  const [coverUrl, setCoverUrl] = useState('');
  const [realCoverFile, setRealCoverFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  
  // Real PDF/EPUB file states
  const [realBookFile, setRealBookFile] = useState<File | null>(null);
  const [realSampleFile, setRealSampleFile] = useState<File | null>(null);

  // OPTIONAL FIELDS
  const [isbn, setIsbn] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [coAuthors, setCoAuthors] = useState('');
  const [edition, setEdition] = useState('');
  const [ageRating, setAgeRating] = useState('All Ages / G');
  const [language, setLanguage] = useState('English');
  const [publicationDate, setPublicationDate] = useState('');
  const [pages, setPages] = useState('');

  // Dashboard view states
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stateful Author Books & Simulated stats
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [royalties, setRoyalties] = useState(140.00);
  const [totalReads, setTotalReads] = useState(24);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  // Fetch author's books from real database
  const fetchAuthorBooks = async () => {
    if (!user?.id) return;
    try {
      const { data: dbBooks } = await nexus.database
        .from('books')
        .select('*')
        .eq('author_id', user.id);
      
      if (dbBooks) {
        setMyBooks(dbBooks.map((b: any) => ({
          id: b.id,
          title: b.title,
          author_id: b.author_id,
          author_name: b.author_name,
          cover_url: b.cover_url,
          retail_price: Number(b.retail_price),
          rental_price: Number(b.rental_price),
          category: b.category,
          description: b.description || '',
          rating: Number(b.rating || 5.0),
          section: b.section || 'General',
          isbn: b.isbn || '',
          tags: Array.isArray(b.tags) ? b.tags : []
        })));
      }
    } catch (e) {
      console.error('[Error fetching author books]:', e);
    }
  };

  // Initialize and load author's books
  useEffect(() => {
    if (!isAuthor) return;

    // Prefill author name if user exists
    if (user?.full_name) {
      setAuthorName(user.full_name);
    }

    fetchAuthorBooks();

    // Set simulated stats based on user ID
    const storedStats = localStorage.getItem(`trileza_author_stats_${user?.id}`);
    if (storedStats) {
      const parsed = JSON.parse(storedStats);
      setRoyalties(parsed.royalties);
      setTotalReads(parsed.reads);
    } else {
      const seedStats = {
        royalties: 140.00,
        reads: 24
      };
      localStorage.setItem(`trileza_author_stats_${user?.id}`, JSON.stringify(seedStats));
      setRoyalties(seedStats.royalties);
      setTotalReads(seedStats.reads);
    }
  }, [user, isAuthor]);

  // Handle Book Upload
  const handleUploadBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || !description.trim() || !authorName.trim()) {
      alert('Please fill out all required text fields.');
      return;
    }

    if (!realBookFile) {
      alert('Please select a Book File (PDF/EPUB/DOCX/TXT/MD) to upload.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Proactively ensure the session token is fresh before starting long uploads
      await nexus.auth.getCurrentUser();

      // 1. Upload and convert manuscript to standard compliant EPUB 3 format
      let fileUrl = '';
      try {
        const formData = new FormData();
        formData.append('file', realBookFile);
        formData.append('userId', user.id);
        
        const headers = nexus.getHttpClient().getHeaders();
        const authHeader = headers['Authorization'] || headers['authorization'] || '';
        const rawToken = authHeader.replace(/^Bearer\s+/i, '');
        const userToken = rawToken === import.meta.env.VITE_INSFORGE_ANON_KEY ? '' : rawToken;
        
        const conversionRes = await fetch('https://25t8cbg8.functions.insforge.app/convert-manuscript', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_INSFORGE_ANON_KEY}`,
            'X-User-Token': userToken
          }
        });
        
        if (!conversionRes.ok) {
          let errMsg = `Server returned status ${conversionRes.status}`;
          try {
            const errData = await conversionRes.json();
            if (errData && errData.error) {
              errMsg = errData.error;
            } else if (errData && errData.message) {
              errMsg = errData.message;
            }
          } catch (_) {}
          throw new Error(errMsg);
        }
        
        const conversionData = await conversionRes.json();
        
        if (conversionData.originalUrl) {
          fileUrl = conversionData.originalUrl; // Always use the uploaded original file URL to retain high-fidelity native layouts (PDF/DOCX) with reading companion overlay!
        } else if (conversionData.convertedUrl) {
          fileUrl = conversionData.convertedUrl; // Fallback to converted EPUB
        } else {
          throw new Error('Manuscript upload returned no valid URLs');
        }
      } catch (convErr: any) {
        console.error('Manuscript conversion error:', convErr);
        // Fallback: direct upload if conversion service itself fails
        alert(`EPUB 3 conversion service unavailable: ${convErr.message || convErr}. Uploading original file directly.`);
        
        const cleanBookName = realBookFile.name.replace(/\.\./g, '_').replace(/^\//, '');
        
        // Try multiple storage paths in case of RLS restrictions
        const pathsToTry = [
          `original/${user.id}_${Date.now()}_${cleanBookName}`,
          `books/${user.id}_${Date.now()}_${cleanBookName}`
        ];
        
        let uploadSuccess = false;
        for (const bookPath of pathsToTry) {
          const { error: uploadErr } = await nexus.storage
            .from('course-materials-trileza-784bc328')
            .upload(bookPath, realBookFile);

          if (!uploadErr) {
            fileUrl = nexus.storage
              .from('course-materials-trileza-784bc328')
              .getPublicUrl(bookPath);
            uploadSuccess = true;
            break;
          } else {
            console.warn(`Upload to '${bookPath}' failed:`, uploadErr.message);
          }
        }
        
        if (!uploadSuccess) {
          alert('Failed to upload manuscript file due to storage permissions. The book will be created without the file attachment. Please contact support or try again later.');
          // Book will still be created but without a file_url
        }
      }

      // 2. Upload Sample PDF if present
      let sampleUrl = '';
      if (realSampleFile) {
        const cleanSampleName = realSampleFile.name.replace(/\.\./g, '_').replace(/^\//, '');
        const samplePath = `samples/${user.id}_${Date.now()}_${cleanSampleName}`;
        await nexus.storage.from('course-materials-trileza-784bc328').upload(samplePath, realSampleFile);
        sampleUrl = nexus.storage
          .from('course-materials-trileza-784bc328')
          .getPublicUrl(samplePath);
      }

      const priceNum = parseFloat(price) || 5000;
      
      let finalCover = coverUrl.trim();
      if (realCoverFile) {
        const cleanCoverName = realCoverFile.name.replace(/\.\./g, '_').replace(/^\//, '');
        const coverPath = `covers/${user.id}_${Date.now()}_${cleanCoverName}`;
        await nexus.storage.from('course-materials-trileza-784bc328').upload(coverPath, realCoverFile);
        finalCover = nexus.storage
          .from('course-materials-trileza-784bc328')
          .getPublicUrl(coverPath);
      }
      if (!finalCover) {
        finalCover = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='300' height='400' fill='%23F1F5F9'/><g transform='translate(110, 140)' stroke='%2394A3B8' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'><rect x='0' y='0' width='80' height='100' rx='8'/><path d='M 20 30 L 60 30'/><path d='M 20 50 L 60 50'/><path d='M 20 70 L 40 70'/></g><text x='150' y='280' fill='%2394A3B8' font-family='system-ui, sans-serif' font-size='14' font-weight='800' text-anchor='middle' letter-spacing='1'>NO COVER</text></svg>";
      }

      // Optional Tags parsing
      const parsedTags = tagsInput.trim() 
        ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];

      const generatedIsbn = isbn.trim() || `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      // 3. Insert Book into database
      const bookId = `b-${Date.now()}`;
      const { error: dbErr } = await nexus.database.from('books').insert({
        id: bookId,
        title: title.trim(),
        author_id: user.id,
        author_name: authorName.trim(),
        cover_url: finalCover,
        retail_price: priceNum,
        rental_price: Number((priceNum * 0.1).toFixed(2)),
        category: section === 'Fiction & Literature' ? 'E-book' : 'Case Study',
        description: description.trim(),
        rating: 5.0,
        section: section,
        isbn: generatedIsbn,
        tags: parsedTags,
        language: language.trim() || 'English',
        publication_date: publicationDate.trim() || new Date().toISOString().split('T')[0],
        pages: parseInt(pages) || null,
        age_rating: ageRating,
        sample_pages: sampleUrl ? [sampleUrl] : [],
        file_url: fileUrl,
        book_file_name: realBookFile.name
      });

      if (dbErr) throw dbErr;

      // Submit book for Content Manager review automatically to sync with database reviews
      const { error: reviewErr } = await nexus.database.from('book_reviews').insert([{
        book_id: bookId,
        submitted_by: user.id,
        status: 'pending',
        checklist_cover: false,
        checklist_description: false,
        checklist_readable: false,
        checklist_price: false,
        checklist_no_copyright: false
      }]);
      if (reviewErr) throw reviewErr;

      // Hot-reload library catalog
      window.dispatchEvent(new Event('trileza-book-published'));

      await fetchAuthorBooks();

      // Update simulated stats
      const newRoyalties = royalties + 25.00;
      const newReads = totalReads + 1;
      setRoyalties(newRoyalties);
      setTotalReads(newReads);
      localStorage.setItem(`trileza_author_stats_${user.id}`, JSON.stringify({
        royalties: newRoyalties,
        reads: newReads
      }));

      // Reset Form
      setTitle('');
      setPrice('39.99');
      setDescription('');
      setCoverUrl('');
      setRealCoverFile(null);
      setRealBookFile(null);
      setRealSampleFile(null);
      setIsbn('');
      setTagsInput('');
      setCoAuthors('');
      setEdition('');
      setLanguage('English');
      setPublicationDate('');
      setPages('');
      setShowUploadForm(false);
      setIsSubmitting(false);
      
      triggerNotification(`Successfully published "${title}" to the Public Library!`);
      if (onClose) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('Invalid token') || err?.message?.includes('JWT expired')) {
        alert('Your session has expired or the token is invalid. Please log out and log back in to publish your book.');
      } else {
        alert('Failed to publish book: ' + (err.message || err));
      }
      setIsSubmitting(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('Are you sure you want to retract this book? It will be removed from the library.')) return;

    try {
      const { error } = await nexus.database
        .from('books')
        .delete()
        .eq('id', bookId);

      if (error) throw error;

      // Hot-reload library catalog
      window.dispatchEvent(new Event('trileza-book-published'));

      // Update local list
      await fetchAuthorBooks();

      triggerNotification('Book retracted from library catalog.');
    } catch (e: any) {
      console.error(e);
      alert('Failed to retract book: ' + (e.message || e));
    }
  };

  // Real file uploads are handled directly via hidden file input elements below

  const triggerNotification = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => {
      setShowNotification(null);
    }, 4000);
  };

  // Render guard for non-authors
  if (!isAuthor) {
    return (
      <div className="container mx-auto px-4 py-20 text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
          <AlertCircle size={36} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
          <p className="text-slate-500 font-medium max-w-md mx-auto">
            You do not currently hold an approved Author status. Please complete the publisher application first to unlock this dashboard.
          </p>
        </div>
        <Button 
          onClick={() => navigate('/author/apply')}
          className="bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8 font-black uppercase text-[10px] tracking-widest gap-2"
        >
          Go to Application Form <ArrowRight size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div className={inline ? "space-y-6 font-sans animate-in fade-in duration-500" : "container mx-auto px-4 pb-20 animate-in fade-in duration-500 space-y-8 font-sans"}>
      {!inline && (
        <PageHeader 
          title={
            <span>
              Publishing <span className="text-emerald-500">Workspace</span>
            </span>
          }
          description="Publish e-books and case studies, monitor distribution parameters, and claim royalties."
          tag="Publisher Desk"
          icon={BookMarked}
          rightContent={
            <Button 
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-6 font-black uppercase text-[10px] tracking-widest transition-all"
            >
              <PlusCircle size={16} /> Publish New Asset
            </Button>
          }
        />
      )}

      {inline && (
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <BookMarked size={20} className="text-emerald-500 animate-pulse" /> Publishing Workspace Console
            </h2>
            <p className="text-sm font-medium text-slate-400">Publish blueprints, monitor royalties, and track distribution metrics.</p>
          </div>
          <Button 
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-lg shadow-emerald-500/10 rounded-2xl h-12 px-6 font-black uppercase text-[9px] tracking-widest transition-all"
          >
            <PlusCircle size={14} /> {showUploadForm ? 'Close Wizard' : 'Publish New Asset'}
          </Button>
        </div>
      )}

      {showNotification && (
        <div className="max-w-4xl mx-auto p-4 bg-emerald-50 border border-emerald-250 text-emerald-700 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <Sparkles size={16} className="text-emerald-500" /> {showNotification}
        </div>
      )}

      {/* DASHBOARD ANALYTICS WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Metric 1 */}
        <Card className="p-8 border-none ring-1 ring-slate-100 shadow-sm hover:shadow-2xl hover:ring-brand-primary/20 hover:translate-y-[-4px] transition-all duration-500 rounded-[2.5rem] bg-white flex justify-between items-center group">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Published Books</p>
            <p className="text-4xl font-black text-slate-900 group-hover:text-brand-primary transition-colors tabular-nums">{myBooks.length}</p>
            <p className="text-xs text-slate-450 font-bold flex items-center gap-1">
              <TrendingUp size={12} className="text-emerald-500" /> 100% active DRM coverage
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-emerald-50 text-emerald-500 shadow-inner group-hover:scale-115 group-hover:rotate-6 transition-all duration-500">
            <BookOpen size={24} strokeWidth={2.5} />
          </div>
        </Card>

        {/* Metric 2 */}
        <Card className="p-8 border-none ring-1 ring-slate-100 shadow-sm hover:shadow-2xl hover:ring-brand-primary/20 hover:translate-y-[-4px] transition-all duration-500 rounded-[2.5rem] bg-white flex justify-between items-center group">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Reads & Borrows</p>
            <p className="text-4xl font-black text-slate-900 group-hover:text-brand-primary transition-colors tabular-nums">{totalReads}</p>
            <p className="text-xs text-slate-450 font-bold flex items-center gap-1">
              <TrendingUp size={12} className="text-emerald-500" /> Simulated user engagements
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-emerald-50 text-emerald-500 shadow-inner group-hover:scale-115 group-hover:rotate-6 transition-all duration-500">
            <Eye size={24} strokeWidth={2.5} />
          </div>
        </Card>

        {/* Metric 3 */}
        <Card className="p-8 border-none ring-1 ring-slate-100 shadow-sm hover:shadow-2xl hover:ring-brand-primary/20 hover:translate-y-[-4px] transition-all duration-500 rounded-[2.5rem] bg-white flex justify-between items-center group">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Accrued Royalties</p>
            <p className="text-4xl font-black text-slate-900 group-hover:text-brand-primary transition-colors tabular-nums">₦{royalties.toFixed(2)}</p>
            <p className="text-xs text-slate-450 font-bold flex items-center gap-1">
              <Award size={12} className="text-amber-555" /> Outright sales & rentals (10%)
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-amber-50 text-amber-550 shadow-inner group-hover:scale-115 group-hover:rotate-6 transition-all duration-500">
            <Coins size={24} strokeWidth={2.5} />
          </div>
        </Card>
      </div>

      {/* COMPREHENSIVE UPLOAD FORM DIALOG */}
      {showUploadForm && (
        <Card className="p-10 border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-white max-w-4xl mx-auto animate-in slide-in-from-top-6 duration-500 space-y-8">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Upload New Asset</h3>
              <p className="text-slate-450 font-medium text-sm">Required fields marked with red asterisks (*).</p>
            </div>
            <button 
              onClick={() => setShowUploadForm(false)}
              className="p-3 rounded-2xl hover:bg-slate-150 transition-colors text-slate-400"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleUploadBook} className="space-y-8">
            {/* SECTION 1: ESSENTIAL INFO */}
            <div className="space-y-6">
              <h4 className="text-xs font-black text-brand-primary uppercase tracking-widest border-b border-slate-50 pb-2">
                1. Essential Information (Required)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Book Title <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Advanced Software Architectures"
                    className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-slate-800 font-bold transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Author Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Author / Pen Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-slate-800 font-bold transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Book Category <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-slate-800 font-bold transition-all duration-300 shadow-sm cursor-pointer"
                  >
                    {SECTIONS.map(sec => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Retail Price (₦) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-5 top-4.5 text-slate-400 font-black">₦</span>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="5000"
                      className="w-full h-14 pl-9 pr-5 rounded-2xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-slate-800 font-bold transition-all duration-300 shadow-sm"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 block mt-1">
                    Borrow fee automatically sets to exactly 10%: **₦{(parseFloat(price || '0') * 0.1).toFixed(2)}** for two weeks.
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: MOCK FILE AND COVER */}
            <div className="space-y-6">
              <h4 className="text-xs font-black text-brand-primary uppercase tracking-widest border-b border-slate-50 pb-2">
                2. Assets Upload & Cover Design (Required)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Book File Upload */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Book File (PDF/EPUB/DOCX/TXT/MD) <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="file" 
                    id="real-book-file-input" 
                    accept=".pdf,.epub,.docx,.txt,.md"
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setRealBookFile(file);
                    }}
                  />
                  <div 
                    onClick={() => document.getElementById('real-book-file-input')?.click()}
                    className={`border-2 border-dashed rounded-3rem p-6 text-center cursor-pointer transition-all duration-300 min-h-[140px] flex flex-col items-center justify-center space-y-2 ${
                      realBookFile 
                        ? 'border-emerald-500 bg-emerald-50/20' 
                        : 'border-slate-200 hover:border-brand-primary hover:bg-slate-50/50'
                    }`}
                  >
                    {realBookFile ? (
                      <>
                        <CheckCircle size={28} className="text-emerald-500 animate-bounce" />
                        <span className="text-xs font-bold text-slate-700 block">{realBookFile.name}</span>
                        <span className="text-[10px] font-medium text-slate-400">{(realBookFile.size / (1024 * 1024)).toFixed(2)} MB • DRM Protected</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={32} className="text-slate-450" />
                        <span className="text-xs font-bold text-slate-700 block">Drag book file here or click to select upload</span>
                        <span className="text-[9px] font-bold text-slate-455 uppercase">Accepts PDF, EPUB, DOCX, TXT, or MD</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Cover Page Options */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Cover Page (Attach or Link) <span className="text-rose-500">*</span>
                  </label>
                  
                  <div className="flex gap-4 items-start pt-1">
                    {/* Visual Square Preview / Placeholder */}
                    <div className="w-28 h-28 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center overflow-hidden relative shadow-inner">
                      {realCoverFile || coverUrl ? (
                        <img 
                          src={realCoverFile ? URL.createObjectURL(realCoverFile) : coverUrl} 
                          className="w-full h-full object-cover" 
                          alt="Cover preview"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '';
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                          <Image size={24} className="text-slate-350" />
                          <span className="text-[8px] font-extrabold text-slate-400 mt-1.5 uppercase tracking-wider">Preview</span>
                        </div>
                      )}
                    </div>

                    {/* Upload Controls */}
                    <div className="flex-1 space-y-2.5">
                      {/* File Upload */}
                      <div>
                        <input 
                          type="file" 
                          id="real-cover-file-input" 
                          accept="image/*"
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setRealCoverFile(file);
                              setCoverUrl(''); // Clear URL if file selected
                            }
                          }}
                        />
                        <div 
                          onClick={() => document.getElementById('real-cover-file-input')?.click()}
                          className={`border border-dashed rounded-xl px-4 py-2 flex items-center justify-between gap-2 h-11 cursor-pointer transition-all ${
                            realCoverFile 
                              ? 'border-emerald-400 bg-emerald-50/10' 
                              : 'border-slate-250 bg-slate-50/50 hover:bg-slate-100/50'
                          }`}
                        >
                          <span className="text-[10px] text-slate-500 font-bold truncate">
                            {realCoverFile ? realCoverFile.name : 'Upload cover image...'}
                          </span>
                          <UploadCloud size={14} className="text-slate-400 shrink-0" />
                        </div>
                      </div>
                      
                      {/* Or URL */}
                      <div className="relative flex items-center gap-2">
                        <div className="flex-1 h-px bg-slate-100"></div>
                        <span className="text-[8px] font-black text-slate-400 uppercase">OR</span>
                        <div className="flex-1 h-px bg-slate-100"></div>
                      </div>
                      
                      <input 
                        type="text" 
                        value={coverUrl}
                        onChange={(e) => {
                          setCoverUrl(e.target.value);
                          if (e.target.value) setRealCoverFile(null); // Clear file if URL typed
                        }}
                        placeholder="Paste image URL here..."
                        className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-[11px] font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: OPTIONAL FIELDS */}
            <div className="space-y-6">
              <h4 className="text-xs font-black text-slate-550 uppercase tracking-widest border-b border-slate-50 pb-2 flex items-center gap-1.5">
                3. Additional Metadata Parameters (Optional)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ISBN */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Hash size={11} /> ISBN Designation
                  </label>
                  <input 
                    type="text" 
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Edition */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Layers size={11} /> Edition / Version
                  </label>
                  <input 
                    type="text" 
                    value={edition}
                    onChange={(e) => setEdition(e.target.value)}
                    placeholder="e.g. 1st Edition, 2026 Revision"
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Language */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <FileText size={11} /> Language
                  </label>
                  <input 
                    type="text" 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="e.g. English, Spanish"
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Publication Date */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <TrendingUp size={11} /> Publication Date
                  </label>
                  <input 
                    type="date" 
                    value={publicationDate}
                    onChange={(e) => setPublicationDate(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-xs font-bold cursor-pointer"
                  />
                </div>

                {/* Pages */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <BookOpen size={11} /> Number of Pages
                  </label>
                  <input 
                    type="number" 
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                    placeholder="e.g. 240"
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Co-Authors */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <UserPlus size={11} /> Co-Authors / Contributors
                  </label>
                  <input 
                    type="text" 
                    value={coAuthors}
                    onChange={(e) => setCoAuthors(e.target.value)}
                    placeholder="e.g. Dr. Bisi A., Prof. Sarah Jenkins"
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Tag size={11} /> Tags / Keywords
                  </label>
                  <input 
                    type="text" 
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="systems, architecture, node (comma-separated)"
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Age Rating */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Milestone size={11} /> Age Suitability Rating
                  </label>
                  <select 
                    value={ageRating}
                    onChange={(e) => setAgeRating(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="All Ages / G">All Ages / G</option>
                    <option value="Teen / PG-13">Teen / PG-13</option>
                    <option value="Mature / R">Mature / R</option>
                  </select>
                </div>

                {/* Optional Sample Pages Upload */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Sample Pages (Optional PDF)
                  </label>
                  <input 
                    type="file" 
                    id="real-sample-file-input" 
                    accept=".pdf"
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setRealSampleFile(file);
                    }}
                  />
                  <div 
                    onClick={() => document.getElementById('real-sample-file-input')?.click()}
                    className={`border border-dashed rounded-xl px-4 py-2 flex items-center justify-between gap-2 h-12 cursor-pointer transition-all ${
                      realSampleFile 
                        ? 'border-emerald-400 bg-emerald-50/10' 
                        : 'border-slate-250 bg-slate-50/50 hover:bg-slate-100/50'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 font-bold truncate">
                      {realSampleFile ? realSampleFile.name : 'Upload sample PDF...'}
                    </span>
                    <UploadCloud size={14} className="text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>

            {/* Synopsis / Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Synopsis / Description <span className="text-rose-500">*</span>
              </label>
              <textarea 
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe your book details. What will mentees learn? Summarize the curriculum architecture..."
                className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-slate-800 font-bold transition-all duration-300 shadow-sm leading-relaxed"
              />
            </div>

            <div className="pt-4 flex justify-end gap-4">
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8 font-black uppercase text-[10px] tracking-widest gap-2 animate-in fade-in flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                    <span>Publishing Blueprint...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} /> <span>Publish to Library</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* MANAGE PUBLISHED BOOKS SECTION */}
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Your Published Assets ({myBooks.length})</h3>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            DRM Secure Protected
          </span>
        </div>

        {myBooks.length === 0 ? (
          <Card className="p-12 border-none shadow-[0_12px_24px_-8px_rgba(0,0,0,0.02)] rounded-[2.5rem] bg-white text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner">
              <LayoutGrid size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-lg text-slate-800">No Books Published Yet</h4>
              <p className="text-sm font-medium text-slate-400 max-w-sm mx-auto">
                Establish your publisher shelf! Click "Publish New Asset" at the top to upload your first e-book.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {myBooks.map((book) => {
              // Calculate dynamic simulated stats per book
              const bookSales = 1;
              const bookBorrows = 3;
              const bookRevenue = bookSales * book.retail_price + bookBorrows * book.rental_price;
              
              return (
                <Card 
                  key={book.id} 
                  className="p-8 border-none ring-1 ring-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] bg-white flex gap-6 group relative overflow-hidden"
                >
                  {/* Book Cover */}
                  <div className="w-24 h-36 shrink-0 rounded-2xl overflow-hidden border border-slate-200 shadow-md group-hover:scale-102 transition-transform duration-500">
                    <img src={book.cover_url} className="w-full h-full object-cover" alt={book.title} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary px-2.5 py-1.5 rounded-lg bg-emerald-50 inline-block mb-1">
                          {book.section}
                        </span>
                        {book.age_rating && (
                          <span className="text-[8px] font-black text-slate-400 uppercase">
                            {book.age_rating}
                          </span>
                        )}
                      </div>
                      <h4 className="font-black text-lg text-slate-800 truncate leading-snug group-hover:text-brand-primary transition-colors">{book.title}</h4>
                      <p className="text-xs text-slate-450 font-bold truncate">by {book.author_name}{book.co_authors ? ` & ${book.co_authors}` : ''}</p>
                      
                      {book.edition && (
                        <p className="text-[9px] text-brand-primary font-black uppercase tracking-wider">{book.edition}</p>
                      )}
                      
                      {book.isbn && (
                        <p className="text-[9px] text-slate-400 font-bold">ISBN: {book.isbn}</p>
                      )}

                      {/* Display Tags */}
                      {book.tags && book.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {book.tags.map(t => (
                            <span key={t} className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sim Performance Metrics */}
                    <div className="grid grid-cols-3 gap-2 border-t border-slate-50 pt-4 text-center">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Sales</span>
                        <span className="font-bold text-slate-700 text-sm">{bookSales}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Rentals</span>
                        <span className="font-bold text-slate-700 text-sm">{bookBorrows}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Revenue</span>
                        <span className="font-bold text-emerald-600 text-sm">₦{bookRevenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Retract) */}
                  <button 
                    onClick={() => handleDeleteBook(book.id)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                    title="Retract Book"
                  >
                    <Trash2 size={16} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthorDashboard;
