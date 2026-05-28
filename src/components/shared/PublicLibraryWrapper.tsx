import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Unlock, Search, BookMarked, ShieldAlert, X, Star, Info,
  ShoppingBag, Clock, CheckCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils';
import { Card, Button } from '../ui';
import { nexus } from '../../lib/nexus';
import { useCartStore } from '../../store/cartStore';

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
}

interface UserLibraryAccess {
  id: string;
  book_id: string;
  access_type: 'rent' | 'own';
  lifetime_rent_total: number;
  created_at: string;
  expires_at?: string;
}

const PublicLibraryWrapper: React.FC = () => {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'general' | 'borrowed' | 'bought'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSection, setActiveSection] = useState('All');

  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [libraryAccess, setLibraryAccess] = useState<UserLibraryAccess[]>([]);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [showNotification, setShowNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Fetch from Real Database
  const fetchData = async () => {
    // 1. Fetch Books
    const { data: booksData } = await nexus.database.from('books').select('*');
    if (booksData) {
      setAllBooks(booksData as any);
    }
    // 2. Fetch User Access
    if (user?.id) {
      const { data: accessData } = await nexus.database.from('user_library_access').select('*').eq('user_id', user.id);
      if (accessData) {
        setLibraryAccess(accessData as any);
      }
    }
  };

  const { addItem } = useCartStore();

  useEffect(() => {
    fetchData();
    window.addEventListener('trileza-book-published', fetchData);
    window.addEventListener('trileza-payment-success', fetchData);
    return () => {
      window.removeEventListener('trileza-book-published', fetchData);
      window.removeEventListener('trileza-payment-success', fetchData);
    };
  }, [user?.id]);

  const triggerNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setShowNotification({ message, type });
    setTimeout(() => setShowNotification(null), 4000);
  };

  const handleBuyBook = (book: Book) => {
    addItem({
      id: book.id,
      type: 'book_buy',
      title: book.title,
      thumbnail: book.cover_url,
      price: Number(book.retail_price || 0)
    }, user?.id || '');
  };

  const handleRequestBorrow = (book: Book) => {
    addItem({
      id: book.id,
      type: 'book_rent',
      title: book.title,
      thumbnail: book.cover_url,
      price: Number(book.rental_price || 0)
    }, user?.id || '');
  };

  const filteredBooks = allBooks.filter(book => {
    const matchesCategory = activeCategory === 'All' || book.category === activeCategory;
    const matchesSection = activeSection === 'All' || book.section === activeSection;
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          book.author_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSection && matchesSearch;
  });

  const rentals = libraryAccess.filter(a => a.access_type === 'rent' && (!a.expires_at || new Date(a.expires_at) > new Date()));
  const purchases = libraryAccess.filter(a => a.access_type === 'own');

  const getRemainingDays = (expiresAt?: string) => {
    if (!expiresAt) return 'Active Rental';
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    return `${days} day${days > 1 ? 's' : ''} left`;
  };

  // Secure Study Session / Reader
  if (isReading && selectedBook) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col select-none" onContextMenu={e => e.preventDefault()}>
        <header className="p-6 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsReading(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all text-slate-400 hover:text-white">
              <X size={20} />
            </button>
            <div>
              <h2 className="text-white font-extrabold text-sm uppercase tracking-widest">{selectedBook.title}</h2>
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 mt-1.5">
                <BookMarked size={12} /> SECURE STUDY MODE ACTIVE
              </p>
            </div>
          </div>
        </header>
        <div className="flex-1 p-6 md:p-12 overflow-y-auto relative z-10 flex justify-center bg-slate-900/40">
          <div className="max-w-3xl w-full bg-white dark:bg-slate-900 p-8 md:p-16 shadow-2xl rounded-3xl text-slate-800 dark:text-slate-200 font-serif leading-relaxed text-lg">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-8">{selectedBook.title}</h1>
            <p>Welcome to the secure reading interface. This represents the content of {selectedBook.title} fetched dynamically.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={cn("fixed top-6 right-6 z-[60] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 font-bold text-xs uppercase text-white", showNotification.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-indigo-600 border-indigo-500')}
          >
            {showNotification.type === 'success' ? <CheckCircle size={18} /> : <Info size={18} />}
            <span>{showNotification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/80">
        {[
          { id: 'general', label: 'General Display (Catalog)', icon: ShoppingBag, color: 'text-indigo-400' },
          { id: 'borrowed', label: 'Borrowed Books (Active)', icon: Clock, color: 'text-amber-400' },
          { id: 'bought', label: 'Bought Books (Owned)', icon: Unlock, color: 'text-emerald-400' }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex-1 flex items-center justify-center gap-2.5 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all", isActive ? "bg-slate-950 text-white shadow-xl dark:bg-slate-900" : "text-slate-400 hover:text-slate-800")}>
              <TabIcon size={14} className={cn(isActive ? tab.color : 'text-slate-400')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in">
          {filteredBooks.map((book) => {
            const isOwned = purchases.some(p => p.book_id === book.id);
            const isBorrowed = rentals.some(r => r.book_id === book.id);
            return (
              <Card key={book.id} className="p-4 rounded-3xl border border-slate-100 dark:border-slate-850 hover:shadow-2xl transition-all flex flex-col">
                <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-4 relative shadow-md">
                  <img src={book.cover_url} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" alt={book.title} />
                  <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                    {isOwned && <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-lg"><Unlock size={14} /></div>}
                    {isBorrowed && !isOwned && <div className="p-2 rounded-xl bg-amber-500 text-slate-950 shadow-lg"><Clock size={14} /></div>}
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      <span>{book.author_name}</span>
                      <span className="flex items-center gap-0.5 text-amber-500"><Star size={8} /> {book.rating}</span>
                    </div>
                    <h3 className="font-extrabold text-sm line-clamp-1">{book.title}</h3>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-black uppercase">
                    <button onClick={() => isOwned || isBorrowed ? setIsReading(true) : handleRequestBorrow(book)} className="text-amber-600 hover:text-amber-500">
                      {isOwned || isBorrowed ? 'Read Now' : `Rent ($${book.rental_price})`}
                    </button>
                    <button onClick={() => isOwned ? setIsReading(true) : handleBuyBook(book)} className="text-indigo-600 hover:text-indigo-500">
                      {isOwned ? 'Owned' : `Buy ($${book.retail_price})`}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'borrowed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
          {rentals.length === 0 ? (
            <div className="col-span-full py-20 text-center">No active rentals.</div>
          ) : (
            rentals.map((rec) => {
              const book = allBooks.find(b => b.id === rec.book_id);
              if (!book) return null;
              return (
                <Card key={book.id} className="p-5 border border-slate-100 rounded-3xl space-y-4">
                  <div className="flex gap-4">
                    <img src={book.cover_url} className="w-16 h-22 rounded-xl object-cover shadow" alt="" />
                    <div>
                      <h4 className="font-extrabold text-sm">{book.title}</h4>
                      <p className="text-[9px] font-bold text-slate-400">By {book.author_name}</p>
                      <p className="text-[9px] font-black text-amber-500 mt-1.5 uppercase tracking-wider flex items-center gap-1">
                        ⏳ {getRemainingDays(rec.expires_at)}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => { setSelectedBook(book); setIsReading(true); }} className="w-full text-[9px] font-black uppercase">
                    Read Blueprint
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'bought' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
          {purchases.length === 0 ? (
            <div className="col-span-full py-20 text-center">No purchased books yet.</div>
          ) : (
            purchases.map((rec) => {
              const book = allBooks.find(b => b.id === rec.book_id);
              if (!book) return null;
              return (
                <Card key={book.id} className="p-5 border border-slate-100 rounded-3xl space-y-4">
                  <div className="flex gap-4">
                    <img src={book.cover_url} className="w-16 h-22 rounded-xl object-cover shadow" alt="" />
                    <div>
                      <h4 className="font-extrabold text-sm">{book.title}</h4>
                      <p className="text-[9px] font-bold text-slate-400">By {book.author_name}</p>
                    </div>
                  </div>
                  <Button onClick={() => { setSelectedBook(book); setIsReading(true); }} className="w-full text-[9px] font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700">
                    Read Owned Blueprint
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default PublicLibraryWrapper;
