import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  PlusCircle, 
  Coins, 
  Eye, 
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
  Image,
  FileType
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { cn, executeWithAutoRefresh } from '../../utils';
import { Card, Button } from '../../components/ui';
import PageHeader from '../../components/shared/PageHeader';
import { nexus, errorMessage } from '../../lib/nexus';
import { uploadBookFile, uploadPublicBookAsset } from '../../lib/bookStorage';
import { isValidIsbn13, normalizeIsbn, languageNameToCode } from '../../lib/metadata/bookMetadata';
import { libraryService } from '../../lib/services/libraryService';

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
  material_type?: string;
  suggested_format?: string;
  uploaded_format?: string;
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

interface FormatSuggestion {
  best: string;
  alternatives: string[];
  reason: string;
  warning: string;
}

const formatSuggestions: Record<string, FormatSuggestion> = {
  'journal': {
    best: 'PDF',
    alternatives: ['DOCX', 'TeX'],
    reason: 'PDF preserves complex academic formatting, figures, tables, and references exactly as intended. Recommended for citation and print.',
    warning: 'Journal Papers typically require precise formatting. PDF ensures your paper appears exactly as submitted.'
  },
  'conference': {
    best: 'PDF',
    alternatives: ['DOCX', 'TeX'],
    reason: 'PDF ensures your conference paper appears exactly as submitted, with proper template formatting and page limits.',
    warning: 'Conference papers often have strict formatting requirements. PDF guarantees your paper meets the template.'
  },
  'magazine': {
    best: 'PDF',
    alternatives: ['DOCX'],
    reason: 'PDF preserves the visual design, color layout, images, and typography that define your magazine\'s brand.',
    warning: 'Magazines rely heavily on visual design. PDF captures every detail exactly as intended.'
  },
  'book_text': {
    best: 'EPUB',
    alternatives: ['PDF', 'DOCX'],
    reason: 'EPUB provides the best reading experience on all devices with reflowable text, adjustable fonts, and chapter navigation.',
    warning: 'EPUB is the industry standard for text-heavy books. It ensures your readers have the best experience on any device.'
  },
  'book_picture': {
    best: 'PDF',
    alternatives: ['Fixed-EPUB'],
    reason: 'PDF preserves images, artwork, and layouts exactly. Essential for picture books, art books, and illustrated works.',
    warning: 'Picture books require fixed layouts. PDF ensures images appear exactly as designed, page-by-page.'
  },
  'thesis': {
    best: 'PDF',
    alternatives: ['DOCX'],
    reason: 'PDF maintains the strict formatting requirements, complex tables, and academic structure required for thesis submission.',
    warning: 'Theses have strict formatting guidelines. PDF preserves your formatting exactly for submission and archival.'
  },
  'report': {
    best: 'PDF',
    alternatives: ['DOCX'],
    reason: 'PDF preserves professional formatting, charts, tables, and branding for official reports and whitepapers.',
    warning: 'Reports require professional presentation. PDF ensures your charts and tables display correctly.'
  },
  'manual': {
    best: 'PDF',
    alternatives: ['DOCX'],
    reason: 'PDF preserves technical diagrams, step-by-step layouts, and instructions exactly as designed.',
    warning: 'Manuals need precise diagrams and instructions. PDF ensures technical details are preserved.'
  },
  'newsletter': {
    best: 'PDF',
    alternatives: ['DOCX'],
    reason: 'PDF preserves the newsletter\'s visual identity, columns, images, and layout.',
    warning: 'Newsletters are visually designed. PDF captures the design exactly as intended.'
  },
  'other': {
    best: 'PDF',
    alternatives: ['DOCX', 'EPUB', 'TXT'],
    reason: 'PDF ensures universal compatibility and exact reproduction of your content.',
    warning: 'For maximum compatibility and exact reproduction, PDF is recommended.'
  }
};

const getMaterialTypeLabel = (type: string) => {
  switch (type) {
    case 'journal': return 'Journal Paper';
    case 'conference': return 'Conference Paper';
    case 'magazine': return 'Magazine';
    case 'book_text': return 'Book (Text-heavy)';
    case 'book_picture': return 'Book (Picture/Art)';
    case 'thesis': return 'Thesis/Dissertation';
    case 'report': return 'Report/Whitepaper';
    case 'manual': return 'Manual/Guide';
    case 'newsletter': return 'Newsletter';
    default: return 'Other';
  }
};

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
  const [fileType, setFileType] = useState('epub');
  const [materialType, setMaterialType] = useState('book_text');
  const [formatWarning, setFormatWarning] = useState<string | null>(null);
  const [bypassWarning, setBypassWarning] = useState(false);

  // OPTIONAL FIELDS
  const [isbn, setIsbn] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [coAuthors, setCoAuthors] = useState('');
  const [edition, setEdition] = useState('');
  const [ageRating, setAgeRating] = useState('All Ages / G');
  const [language, setLanguage] = useState('English');
  const [publicationDate, setPublicationDate] = useState('');
  const [pages, setPages] = useState('');

  // Dashboard view states (Go straight to publishing form when opened inline)
  const [showUploadForm, setShowUploadForm] = useState(inline);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stateful Author Books & Simulated stats
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [royalties, setRoyalties] = useState(140.00);
  const [totalReads, setTotalReads] = useState(24);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const handleFileChange = (file: File | null) => {
    setRealBookFile(file);
    setBypassWarning(false);

    if (!file) {
      setFormatWarning(null);
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const suggestion = formatSuggestions[materialType];
    if (suggestion) {
      const bestFormat = suggestion.best.toLowerCase();
      if (extension !== bestFormat) {
        setFormatWarning(
          `You uploaded a ${extension.toUpperCase()} file. For ${getMaterialTypeLabel(materialType)}, ${suggestion.best} is recommended. ${suggestion.warning}`
        );
      } else {
        setFormatWarning(null);
      }
    }
  };

  const handleMaterialTypeChange = (newType: string) => {
    setMaterialType(newType);
    setBypassWarning(false);

    const suggestion = formatSuggestions[newType];
    if (suggestion) {
      setFileType(suggestion.best.toLowerCase());
    }

    if (realBookFile) {
      const extension = realBookFile.name.split('.').pop()?.toLowerCase();
      if (suggestion) {
        const bestFormat = suggestion.best.toLowerCase();
        if (extension !== bestFormat) {
          setFormatWarning(
            `You uploaded a ${extension.toUpperCase()} file. For ${getMaterialTypeLabel(newType)}, ${suggestion.best} is recommended. ${suggestion.warning}`
          );
        } else {
          setFormatWarning(null);
        }
      }
    } else {
      setFormatWarning(null);
    }
  };

  const fetchAuthorStats = async (booksList: Book[]) => {
    if (!user?.id || booksList.length === 0) {
      setTotalReads(0);
      setRoyalties(0);
      return;
    }
    try {
      const bookIds = booksList.map(b => b.id);
      const { data: accessRecords, error } = await nexus.database
        .from('api_user_library_access')
        .select('*')
        .in('book_id', bookIds);
      
      if (!error && accessRecords) {
        const readsCount = accessRecords.length;
        let totalRoyalties = 0;
        accessRecords.forEach(rec => {
          const book = booksList.find(b => b.id === rec.book_id);
          if (book) {
            if (rec.access_type === 'own') {
              totalRoyalties += Number(book.retail_price) * 0.10;
            } else {
              totalRoyalties += Number(rec.lifetime_rent_total || book.rental_price) * 0.10;
            }
          }
        });
        setTotalReads(readsCount);
        setRoyalties(totalRoyalties);
      } else {
        setTotalReads(0);
        setRoyalties(0);
      }
    } catch (err) {
      console.error('[Error fetching author stats]:', err);
      setTotalReads(0);
      setRoyalties(0);
    }
  };

  const fetchAuthorBooks = async () => {
    if (!user?.id) return;
    try {
      const allBooks = await libraryService.listBooks();
      const dbBooks = allBooks.filter(b => b.author_id === user.id);
      setMyBooks(dbBooks as any);
      await fetchAuthorStats(dbBooks);
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
      alert('Please select a Book File to upload.');
      return;
    }

    if (formatWarning && !bypassWarning) {
      alert('Please address the file format warning before uploading or click "Continue Anyway".');
      return;
    }

    setIsSubmitting(true);
    try {
      await executeWithAutoRefresh(async () => {
        // 1. Upload book file directly to storage
        // The manuscript goes to the private bucket; what is stored is the
        // object key, since a private object has no durable public URL.
        let fileUrl = '';
        try {
          const uploaded = await uploadBookFile(user.id, realBookFile);
          fileUrl = uploaded.key;
        } catch (uploadErr) {
          console.error('[AuthorDashboard] Manuscript upload failed:', uploadErr);
          alert(`Failed to upload manuscript: ${errorMessage(uploadErr, 'please try again')}`);
          return;
        }

        // Samples and covers stay public — they are the storefront.
        let sampleUrl = '';
        if (realSampleFile) {
          sampleUrl = await uploadPublicBookAsset('samples', user.id, realSampleFile);
        }

        const priceNum = parseFloat(price) || 5000;

        let finalCover = coverUrl.trim();
        if (realCoverFile) {
          finalCover = await uploadPublicBookAsset('covers', user.id, realCoverFile);
        }
        if (!finalCover) {
          finalCover = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='300' height='400' fill='%23F1F5F9'/><g transform='translate(110, 140)' stroke='%2394A3B8' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'><rect x='0' y='0' width='80' height='100' rx='8'/><path d='M 20 30 L 60 30'/><path d='M 20 50 L 60 50'/><path d='M 20 70 L 40 70'/></g><text x='150' y='280' fill='%2394A3B8' font-family='system-ui, sans-serif' font-size='14' font-weight='800' text-anchor='middle' letter-spacing='1'>NO COVER</text></svg>";
        }

        // Optional Tags parsing
        const parsedTags = tagsInput.trim() 
          ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
          : [];

        // An ISBN is either real or absent — never invented. See the note in
        // StoreManager: a fabricated number looks plausible, fails its
        // checksum, and can collide with a real registration.
        const normalizedIsbn = isbn.trim() ? normalizeIsbn(isbn) : '';
        if (normalizedIsbn && !isValidIsbn13(normalizedIsbn)) {
          alert('That ISBN-13 is not valid. Check the digits, or leave the field empty.');
          return;
        }

        // 3. Insert Book into database
        const bookId = `b-${Date.now()}`;
        await libraryService.createBook({
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
          isbn_13: normalizedIsbn || null,
          tags: parsedTags,
          language: language.trim() || 'English',
          language_code: languageNameToCode(language) || 'en',
          publication_date: publicationDate.trim() || new Date().toISOString().split('T')[0],
          publication_date_iso: publicationDate.trim() || new Date().toISOString().split('T')[0],
          file_format: /\.epub$/i.test(realBookFile.name) ? 'EPUB' : 'PDF',
          file_size_bytes: realBookFile.size,
          copyright_year: new Date().getFullYear(),
          copyright_holder: authorName.trim(),
          rights_statement: 'World',
          pages: parseInt(pages) || undefined,
          age_rating: ageRating,
          sample_pages: sampleUrl ? [sampleUrl] : [],
          file_url: fileUrl,
          book_file_name: realBookFile.name,
          material_type: materialType,
          suggested_format: formatSuggestions[materialType]?.best || 'PDF',
          uploaded_format: realBookFile ? realBookFile.name.split('.').pop()?.toUpperCase() : 'PDF'
        });

        // Hot-reload library catalog
        window.dispatchEvent(new Event('trileza-book-published'));

        await fetchAuthorBooks();

        // Reset Form
        setTitle('');
        setPrice('39.99');
        setDescription('');
        setCoverUrl('');
        setRealCoverFile(null);
        setRealBookFile(null);
        setRealSampleFile(null);
        setFileType('epub');
        setIsbn('');
        setTagsInput('');
        setCoAuthors('');
        setEdition('');
        setLanguage('English');
        setPublicationDate('');
        setPages('');
        setShowUploadForm(false);
        
        triggerNotification(`Successfully published "${title}" to the Public Library!`);
        if (onClose) {
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      });
    } catch (err: any) {
      console.error(err);
      alert('Failed to publish book: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('Are you sure you want to retract this book? It will be removed from the library.')) return;

    try {
      await libraryService.deleteBook(bookId);

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
          <h2 className="text-3xl font-black text-foreground tracking-tight">Access Restricted</h2>
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

      {showNotification && (
        <div className="max-w-4xl mx-auto p-4 bg-emerald-50 border border-emerald-250 text-emerald-700 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <Sparkles size={16} className="text-emerald-500" /> {showNotification}
        </div>
      )}

      {/* DASHBOARD ANALYTICS WIDGETS - HIDDEN IN INLINE MODE */}
      {!inline && !showUploadForm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Metric 1 */}
          <Card className="p-8 border-none ring-1 ring-slate-100 shadow-sm hover:shadow-2xl hover:ring-brand-primary/20 hover:translate-y-[-4px] transition-all duration-500 rounded-[2.5rem] bg-surface flex justify-between items-center group">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Published Books</p>
              <p className="text-4xl font-black text-foreground group-hover:text-brand-primary transition-colors tabular-nums">{myBooks.length}</p>
              <p className="text-xs text-slate-450 font-bold flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-500" /> 100% active DRM coverage
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-emerald-50 text-emerald-500 shadow-inner group-hover:scale-115 group-hover:rotate-6 transition-all duration-500">
              <BookOpen size={24} />
            </div>
          </Card>

          {/* Metric 2 */}
          <Card className="p-8 border-none ring-1 ring-slate-100 shadow-sm hover:shadow-2xl hover:ring-brand-primary/20 hover:translate-y-[-4px] transition-all duration-500 rounded-[2.5rem] bg-surface flex justify-between items-center group">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Reads & Borrows</p>
              <p className="text-4xl font-black text-foreground group-hover:text-brand-primary transition-colors tabular-nums">{totalReads}</p>
              <p className="text-xs text-slate-450 font-bold flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-500" /> Simulated user engagements
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-emerald-50 text-emerald-500 shadow-inner group-hover:scale-115 group-hover:rotate-6 transition-all duration-500">
              <Eye size={24} />
            </div>
          </Card>

          {/* Metric 3 */}
          <Card className="p-8 border-none ring-1 ring-slate-100 shadow-sm hover:shadow-2xl hover:ring-brand-primary/20 hover:translate-y-[-4px] transition-all duration-500 rounded-[2.5rem] bg-surface flex justify-between items-center group">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Accrued Royalties</p>
              <p className="text-4xl font-black text-foreground group-hover:text-brand-primary transition-colors tabular-nums">₦{royalties.toFixed(2)}</p>
              <p className="text-xs text-slate-450 font-bold flex items-center gap-1">
                <Award size={12} className="text-amber-555" /> Outright sales & rentals (10%)
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-amber-50 text-amber-550 shadow-inner group-hover:scale-115 group-hover:rotate-6 transition-all duration-500">
              <Coins size={24} />
            </div>
          </Card>
        </div>
      )}

      {/* COMPREHENSIVE UPLOAD FORM DIALOG */}
      {showUploadForm && (
        <Card className="p-10 border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-surface max-w-4xl mx-auto animate-in slide-in-from-top-6 duration-500 space-y-8">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="text-2xl font-black text-foreground tracking-tight">Upload New Asset</h3>
              <p className="text-foreground/80 font-medium text-sm">Required fields marked with red asterisks (*).</p>
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
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 block">
                    Book Title <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Advanced Software Architectures"
                    className="w-full h-14 px-5 rounded-2xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-foreground font-bold transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Author Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 block">
                    Author / Pen Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full h-14 px-5 rounded-2xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-foreground font-bold transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 block">
                    Book Category <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full h-14 px-5 rounded-2xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-foreground font-bold transition-all duration-300 shadow-sm cursor-pointer"
                  >
                    {SECTIONS.map(sec => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 block">
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
                      className="w-full h-14 pl-9 pr-5 rounded-2xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-foreground font-bold transition-all duration-300 shadow-sm"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-foreground/70 block mt-1">
                    Borrow fee automatically sets to exactly 10%: **₦{(parseFloat(price || '0') * 0.1).toFixed(2)}** for two weeks.
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: FILE UPLOAD & COVER */}
            <div className="space-y-6">
              <h4 className="text-xs font-black text-brand-primary uppercase tracking-widest border-b border-slate-50 pb-2">
                2. Assets Upload & Cover Design (Required)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* File Type Dropdown + Book File Upload */}
                <div className="space-y-4">
                  {/* Material Type Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
                      <FileType size={12} /> Material Category Type <span className="text-rose-500">*</span>
                    </label>
                    <select 
                      value={materialType}
                      onChange={(e) => handleMaterialTypeChange(e.target.value)}
                      className="w-full h-14 px-5 rounded-2xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-foreground font-bold transition-all duration-300 shadow-sm cursor-pointer"
                    >
                      <option value="journal">📄 Journal Paper (PDF Standard)</option>
                      <option value="conference">📄 Conference Paper (PDF Standard)</option>
                      <option value="magazine">📰 Magazine (PDF High-Res Layout)</option>
                      <option value="book_text">📖 Book (Text-heavy PDF / EPUB)</option>
                      <option value="book_picture">🖼️ Book (Picture/Art PDF Layout)</option>
                      <option value="thesis">📑 Thesis/Dissertation (PDF Academic)</option>
                      <option value="report">📊 Report/Whitepaper (PDF Corporate)</option>
                      <option value="manual">📋 Manual/Guide (PDF Technical)</option>
                      <option value="newsletter">📬 Newsletter (PDF Document)</option>
                      <option value="other">📎 Other Document Format</option>
                    </select>
                  </div>

                  {/* Explicit PDF & Digital Format Publishing Selection (Requirement 3 & 4) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
                      <FileType size={12} /> Target Catalog Publishing Format <span className="text-rose-500">*</span>
                    </label>
                    <select 
                      value="pdf"
                      disabled
                      className="w-full h-14 px-5 rounded-2xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-foreground font-bold transition-all duration-300 shadow-sm cursor-not-allowed appearance-none opacity-80"
                    >
                      <option value="pdf">📄 PDF Document (.pdf) — Strict Standard</option>
                    </select>
                  </div>

                  {materialType && formatSuggestions[materialType] && (
                    <div className="border-l-4 border-emerald-500 bg-emerald-50/20 p-5 rounded-2xl space-y-3 border border-emerald-100 shadow-xs text-left animate-in fade-in slide-in-from-top duration-300">
                      <div className="flex items-start gap-2.5">
                        <Sparkles size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="font-black text-xs text-foreground uppercase tracking-wider">Format Recommendation</h4>
                          <p className="text-[11px] text-foreground/90 font-bold leading-relaxed">
                            {formatSuggestions[materialType].reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl font-extrabold text-[9px] uppercase tracking-wider shadow-xs">
                          Best: {formatSuggestions[materialType].best}
                        </span>
                        {formatSuggestions[materialType].alternatives.length > 0 && (
                          <span className="inline-flex items-center bg-slate-50 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-xl font-extrabold text-[9px] uppercase tracking-wider">
                            ✓ Acceptable: {formatSuggestions[materialType].alternatives.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Book File Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 block">
                      Upload Book File <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="file" 
                      id="real-book-file-input" 
                      accept=".pdf"
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        handleFileChange(file || null);
                      }}
                    />
                    <div 
                      onClick={() => document.getElementById('real-book-file-input')?.click()}
                      className={`border-2 border-dashed rounded-[1.5rem] p-6 text-center cursor-pointer transition-all duration-300 min-h-[120px] flex flex-col items-center justify-center space-y-2 ${
                        realBookFile 
                          ? 'border-emerald-500 bg-emerald-50/20' 
                          : 'border-slate-200 hover:border-brand-primary hover:bg-slate-50/50'
                      }`}
                    >
                      {realBookFile ? (
                        <>
                          <CheckCircle size={28} className="text-emerald-500" />
                          <span className="text-xs font-bold text-slate-700 block">{realBookFile.name}</span>
                          <span className="text-[10px] font-medium text-slate-400">{(realBookFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={28} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-600 block">Click to select file</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Max 50MB • Accepted: PDF ONLY • DRM Protected</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Format Warning Box */}
                  {formatWarning && (
                    <div className={cn(
                      "border-l-4 p-4 rounded-2xl flex items-start gap-3 border transition-all text-left",
                      bypassWarning 
                        ? "border-emerald-500 bg-emerald-50/10 border-l-emerald-500" 
                        : "border-amber-500 bg-amber-50/15 border-l-amber-500 shadow-sm"
                    )}>
                      <span className="text-base mt-0.5">{bypassWarning ? "✅" : "⚠️"}</span>
                      <div className="space-y-2 flex-1">
                        <h4 className={cn("font-black text-xs uppercase tracking-wider", bypassWarning ? "text-emerald-700" : "text-amber-850")}>
                          {bypassWarning ? "Warning Bypassed" : "Format Discrepancy"}
                        </h4>
                        <p className="text-[11px] text-foreground/90 font-bold leading-relaxed">
                          {formatWarning}
                        </p>
                        {!bypassWarning && (
                          <div className="flex gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => setBypassWarning(true)}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold text-[9px] uppercase tracking-wider transition-colors shadow-xs"
                            >
                              Continue Anyway
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRealBookFile(null);
                                setFormatWarning(null);
                                const fileInput = document.getElementById('real-book-file-input') as HTMLInputElement;
                                if (fileInput) fileInput.value = '';
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-650 border border-slate-250 rounded-xl font-extrabold text-[9px] uppercase tracking-wider transition-all"
                            >
                              Go Back
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cover Page Options */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 block">
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
                        className="w-full h-11 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-[11px] font-bold"
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
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1">
                    <Hash size={11} /> ISBN Designation
                  </label>
                  <input 
                    type="text" 
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Edition */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1">
                    <Layers size={11} /> Edition / Version
                  </label>
                  <input 
                    type="text" 
                    value={edition}
                    onChange={(e) => setEdition(e.target.value)}
                    placeholder="e.g. 1st Edition, 2026 Revision"
                    className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Language */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1">
                    <FileText size={11} /> Language
                  </label>
                  <input 
                    type="text" 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="e.g. English, Spanish"
                    className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Publication Date */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1">
                    <TrendingUp size={11} /> Publication Date
                  </label>
                  <input 
                    type="date" 
                    value={publicationDate}
                    onChange={(e) => setPublicationDate(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-xs font-bold cursor-pointer"
                  />
                </div>

                {/* Pages */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1">
                    <BookOpen size={11} /> Number of Pages
                  </label>
                  <input 
                    type="number" 
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                    placeholder="e.g. 240"
                    className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Co-Authors */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1">
                    <UserPlus size={11} /> Co-Authors / Contributors
                  </label>
                  <input 
                    type="text" 
                    value={coAuthors}
                    onChange={(e) => setCoAuthors(e.target.value)}
                    placeholder="e.g. Dr. Bisi A., Prof. Sarah Jenkins"
                    className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1">
                    <Tag size={11} /> Tags / Keywords
                  </label>
                  <input 
                    type="text" 
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="systems, architecture, node (comma-separated)"
                    className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-xs font-bold"
                  />
                </div>

                {/* Age Rating */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1">
                    <Milestone size={11} /> Age Suitability Rating
                  </label>
                  <select 
                    value={ageRating}
                    onChange={(e) => setAgeRating(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="All Ages / G">All Ages / G</option>
                    <option value="Teen / PG-13">Teen / PG-13</option>
                    <option value="Mature / R">Mature / R</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Synopsis / Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-foreground/70 block">
                Synopsis / Description <span className="text-rose-500">*</span>
              </label>
              <textarea 
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe your book details. What will mentees learn? Summarize the curriculum structure..."
                className="w-full p-5 rounded-2xl bg-surface-2 border border-slate-200/60 focus:border-brand-primary focus:bg-surface focus:outline-none text-foreground font-bold transition-all duration-300 shadow-sm leading-relaxed"
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

      {/* MANAGE PUBLISHED BOOKS SECTION - HIDDEN IN INLINE MODE */}
      {!inline && !showUploadForm && (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-2xl font-black text-foreground tracking-tight">Your Published Assets ({myBooks.length})</h3>
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
      )}


    </div>
  );
};

export default AuthorDashboard;
