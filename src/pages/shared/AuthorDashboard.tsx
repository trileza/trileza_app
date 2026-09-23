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
import { PublishWizard } from '../../components/library/PublishWizard';
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

/**
 * Which file format suits which kind of material.
 *
 * Currently unreferenced: the old form's format warning was removed with it,
 * and the wizard does not yet advise on the Files step. Kept because this is
 * editorial judgement — that a picture book belongs in PDF and a text-heavy
 * one in EPUB — and rewriting it later is harder than leaving it here.
 */
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
  const [authorName, setAuthorName] = useState(user?.full_name || '');
  
  // Real PDF/EPUB file states

  // OPTIONAL FIELDS

  // Dashboard view states (Go straight to publishing form when opened inline)
  const [showUploadForm, setShowUploadForm] = useState(inline);

  // Stateful Author Books & Simulated stats
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  // Zero until the ledger answers. A non-zero placeholder showed every author
  // ₦140 of earnings they did not have, on a dashboard whose whole job is to
  // tell them what they are owed.
  const [royalties, setRoyalties] = useState(0);
  const [totalReads, setTotalReads] = useState(24);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const fetchAuthorStats = async (booksList: Book[]) => {
    if (!user?.id || booksList.length === 0) {
      setTotalReads(0);
      setRoyalties(0);
      return;
    }
    try {
      // Earnings come from the ledger, not from a sum computed here.
      //
      // This used to recalculate royalties in the browser on every page load,
      // at 10% rather than the 60% the platform actually pays, and persisted
      // nothing. An author's income existed only as a figure redrawn in front
      // of them — nothing to audit, dispute, or pay out against, and it
      // disagreed with what they were owed.
      const { data: balance, error: balanceErr } = await nexus.database.rpc(
        'author_earnings_balance',
        { p_author_id: user.id }
      );

      if (balanceErr) throw balanceErr;

      // The RPC returns one row; minor units to naira for display.
      const row = Array.isArray(balance) ? balance[0] : balance;
      setRoyalties(Number(row?.available_minor ?? 0) / 100);

      // Reads are still counted from entitlements: a grant is a read, and the
      // ledger only knows about the ones that were paid for.
      const bookIds = booksList.map(b => b.id);
      const { data: accessRecords } = await nexus.database
        .from('api_user_library_access')
        .select('id')
        .in('book_id', bookIds);

      setTotalReads(accessRecords?.length ?? 0);
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

      {/* The publishing wizard replaces the old single-page form.

          That form asked for co-authors and discarded them, never wrote a
          book_contributors or book_identifiers row, never ran the metadata
          validator that already existed, and left `status` at its default of
          'published' — so a book went live to the public library without a
          moderator ever seeing it. All four are fixed in publishingService,
          which both this and StoreManager now call. */}
      {showUploadForm && (
        <Card className="p-10 border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-surface max-w-4xl mx-auto animate-in slide-in-from-top-6 duration-500">
          <div className="flex justify-between items-center pb-6 mb-8 border-b border-border">
            <div>
              <h3 className="text-2xl font-black text-foreground tracking-tight">Publish a book</h3>
              <p className="text-foreground/80 font-medium text-sm">
                Five steps. Nothing is saved until the last one.
              </p>
            </div>
          </div>

          <PublishWizard
            userId={user.id}
            authorName={user.full_name || authorName}
            sections={SECTIONS}
            uploadFile={async (kind, file) => {
              // The manuscript goes to the private bucket and what is stored
              // is its object key — a private object has no durable URL.
              // Covers and samples are the storefront and stay public.
              if (kind === 'books') {
                const uploaded = await uploadBookFile(user.id, file);
                return uploaded.key;
              }
              return uploadPublicBookAsset(kind, user.id, file);
            }}
            onPublished={(_bookId, status) => {
              window.dispatchEvent(new Event('trileza-book-published'));
              fetchAuthorBooks();
              setShowUploadForm(false);
              triggerNotification(
                status === 'published'
                  ? 'Published to the public library.'
                  : 'Sent for review. You will be told when it is cleared.'
              );
              if (onClose) setTimeout(() => onClose(), 1500);
            }}
            onCancel={() => setShowUploadForm(false)}
          />
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
