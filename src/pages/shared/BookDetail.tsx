import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { nexus } from '../../lib/nexus';
import { Card, Button } from '../../components/ui';
import { ArrowLeft, BookOpen, Clock, Tag, ShoppingBag, ShieldCheck, CheckCircle, BookMarked, Star } from 'lucide-react';
import { formatCurrency, cn } from '../../utils';
import { motion } from 'framer-motion';
import { LoadingOverlay } from '../../components/shared';
import { libraryService } from '../../lib/services/libraryService';


interface BookDetailData {
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
  language: string;
  publication_date: string;
  pages: number;
  age_rating: string;
  isbn: string;
  tags: string[];
  sample_pages: string[];
}

const BookDetail: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem, setIsOpen: setCartOpen } = useCartStore();

  const [book, setBook] = useState<BookDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    const fetchBook = async () => {
      if (!bookId) return;
      try {
        const data = await libraryService.getBook(bookId);
        setBook(data as any);
      } catch (err) {
        console.error('Failed to load book', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
  }, [bookId]);

  if (loading) {
    return <LoadingOverlay />;
  }

  if (!book) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-4">Book not found</h2>
        <Button onClick={() => navigate('/library')}>Return to Library</Button>
      </div>
    );
  }

  const calculatedBorrowFee = book.retail_price * 0.10;

  const handleBorrow = () => {
    if (!user?.id) return;
    addItem({
      id: book.id,
      type: 'book_rent',
      title: `${book.title} (2-Week Rental)`,
      thumbnail: book.cover_url,
      price: calculatedBorrowFee
    }, user.id);
    setCartOpen(true);
  };

  const handleBuy = () => {
    if (!user?.id) return;
    addItem({
      id: book.id,
      type: 'book_buy',
      title: book.title,
      thumbnail: book.cover_url,
      price: Number(book.retail_price)
    }, user.id);
    setCartOpen(true);
  };

  const handleReserve = async () => {
    if (!user?.id) return;
    try {
      await libraryService.reserveBook(user.id, book.id);
      alert('Book reserved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to reserve book.');
    }
  };

  return (
    <div className="w-full pb-20 animate-in fade-in duration-500 space-y-8 relative">
      {/* Top Bar */}
      <button 
        onClick={() => navigate('/library')}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-4 pt-6"
      >
        <ArrowLeft size={16} /> Back to Library
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Column: Cover & Action Buttons */}
        <div className="lg:col-span-4 space-y-6">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 relative bg-white max-sm:max-w-[200px] max-sm:mx-auto"
          >
            <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
          </motion.div>

          <Card className="p-6 rounded-3xl border-slate-100 dark:border-slate-800 space-y-4 shadow-xl max-sm:hidden">
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 text-center mb-4">Acquisition Options</h3>
            
            <button 
              onClick={handleBorrow}
              className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-widest text-xs flex items-center justify-between px-6 transition-transform active:scale-95 shadow-lg shadow-amber-500/20 cursor-pointer border-none"
            >
              <span className="flex items-center gap-2"><Clock size={16} /> Borrow (2 Weeks)</span>
              <span>{formatCurrency(calculatedBorrowFee)}</span>
            </button>
            <p className="text-center text-[10px] text-slate-500 font-bold mb-2">
              Borrow fee is precisely 10% of retail price. No downloads allowed.
            </p>

            <button 
              onClick={handleBuy}
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs flex items-center justify-between px-6 transition-transform active:scale-95 shadow-lg shadow-emerald-500/20 cursor-pointer border-none mb-2"
            >
              <span className="flex items-center gap-2"><ShoppingBag size={16} /> Buy Outright</span>
              <span>{formatCurrency(book.retail_price)}</span>
            </button>

            <button 
              onClick={handleReserve}
              className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 px-6 transition-transform active:scale-95 shadow-lg shadow-indigo-500/20 cursor-pointer border-none"
            >
              <BookMarked size={16} /> Reserve Blueprint
            </button>
          </Card>
        </div>

        {/* Right Column: Book Details */}
        <div className="lg:col-span-8 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                {book.category}
              </span>
              <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Star size={12} className="text-amber-500 fill-amber-500" /> {book.rating} Rating
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 leading-tight">
              {book.title}
            </h1>
            <div className="flex items-center gap-3">
              <p className="text-xl font-bold text-slate-400">By {book.author_name}</p>
              {book.author_id && book.author_id !== user?.id && (
                <button
                  onClick={() => navigate(`/messages?chat=${book.author_id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-650 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  Message
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <div className={cn(
              "prose prose-slate dark:prose-invert prose-lg max-w-none text-slate-650 dark:text-slate-300 font-serif leading-relaxed transition-all duration-300",
              !descExpanded && "max-sm:line-clamp-3"
            )}>
              {book.description || "No description provided."}
            </div>
            {book.description && book.description.length > 150 && (
              <button
                type="button"
                onClick={() => setDescExpanded(!descExpanded)}
                className="sm:hidden text-xs font-black text-emerald-600 dark:text-emerald-450 mt-1 hover:underline"
              >
                {descExpanded ? "Show Less" : "Read More"}
              </button>
            )}
          </div>

          {/* Quick Facts Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Language</p>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{book.language || 'English'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Pages</p>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{book.pages ? `${book.pages} pages` : 'N/A'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Age Rating</p>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" /> {book.age_rating || 'Everyone'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Published</p>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{book.publication_date || 'N/A'}</p>
            </div>
          </div>

          {/* Additional Meta */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Metadata & Tags</h3>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {book.tags && book.tags.length > 0 ? (
                book.tags.map((tag, idx) => (
                  <span key={idx} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <Tag size={12} /> {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">No tags available.</span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm font-bold text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-4">
              <span>ISBN: <span className="text-slate-800 dark:text-slate-200">{book.isbn || 'N/A'}</span></span>
            </div>
          </div>

          {/* Sample Pages Gallery */}
          {book.sample_pages && book.sample_pages.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <BookOpen size={16} /> Sample Pages
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {book.sample_pages.map((sampleUrl, idx) => (
                  <div key={idx} className="aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                    <img src={sampleUrl} alt={`Sample ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sticky Mobile Actions Footer */}
      <div className="sm:hidden fixed bottom-16 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 p-3 flex gap-3 shadow-[0_-8px_30px_rgb(0,0,0,0.15)] backdrop-blur-md animate-in slide-in-from-bottom duration-300">
        <button 
          onClick={handleBorrow}
          className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5 shadow-md"
        >
          <Clock size={14} /> Borrow ({formatCurrency(calculatedBorrowFee)})
        </button>
        <button 
          onClick={handleBuy}
          className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5 shadow-md"
        >
          <ShoppingBag size={14} /> Buy ({formatCurrency(book.retail_price)})
        </button>
      </div>
    </div>
  );
};

export default BookDetail;
