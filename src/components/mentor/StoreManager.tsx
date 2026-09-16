import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  TrendingUp, 
  DollarSign, 
  BookOpen, 
  MoreVertical, 
  Edit3, 
  Trash2,
  Eye,
  X,
  UploadCloud,
  Tag,
  Milestone,
  Globe,
  Hash,
  Layers,
  UserPlus,
  Image,
  FileType,
  Type,
  Building,
  BookMarked,
  Shield,
} from 'lucide-react';
import { cn, executeWithAutoRefresh } from '../../utils';
import { Card, Button } from '../ui';
import { nexus, errorMessage } from '../../lib/nexus';
import { uploadBookFile, uploadPublicBookAsset } from '../../lib/bookStorage';
import {
  isValidIsbn13,
  normalizeIsbn,
  languageNameToCode,
  LANGUAGES,
  BISAC_CATEGORIES
} from '../../lib/metadata/bookMetadata';
import { useAuthStore } from '../../store/authStore';
import { Toast } from '../ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';

interface StoreItem {
  id: string;
  title: string;
  description: string;
  category: string;
  retail_price: number;
  rental_price: number;
  thumbnail_url: string;
  file_url: string;
  sales_count: number;
  created_at: string;
  status: 'published' | 'draft';
  language?: string;
  publication_date?: string;
  pages?: number;
  age_rating?: string;
  isbn?: string;
  tags?: string[];
  sample_pages?: string[];
  co_authors?: string;
  edition?: string;
}

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

const StoreManager: React.FC = () => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'E-book',
    retail_price: '',
    rental_price: '',
    thumbnail_url: '',
    file_url: '',
    language: 'English',
    publication_date: '',
    pages: '',
    age_rating: 'All Ages / G',
    isbn: '',
    tags: '',
    co_authors: '',
    edition: '',
    // NISO/ONIX metadata. Collected here rather than defaulted silently —
    // these are what a retailer or library needs before it will list a title,
    // and the author is the only one who knows them.
    subtitle: '',
    publisher_name: '',
    bisac_code: '',
    rights_statement: 'World',
    license_type: 'allrightsreserved'
  });

  const [realBookFile, setRealBookFile] = useState<File | null>(null);
  const [realSampleFile, setRealSampleFile] = useState<File | null>(null);
  const [realThumbnailFile, setRealThumbnailFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileType, setFileType] = useState('epub');
  const [materialType, setMaterialType] = useState('book_text');
  const [formatWarning, setFormatWarning] = useState<string | null>(null);
  const [bypassWarning, setBypassWarning] = useState(false);

  // Live ISBN feedback, so a wrong number is caught while the author is still
  // looking at the field rather than on submit. Blank is valid — most
  // self-published authors have no ISBN.
  const isbnInvalid =
    formData.isbn.trim().length > 0 && !isValidIsbn13(normalizeIsbn(formData.isbn));



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

  useEffect(() => {
    fetchItems();
  }, [user]);

  const fetchItems = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await nexus.database.from('api_books').select('*').eq('author_id', user.id);
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching items:', err);
      setToast({ message: 'Failed to load items', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (msg: string, type: 'success' | 'info' | 'error' = 'success') => 
    setToast({ message: msg, type });



  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Proactively ensure the session token is fresh before starting uploads
    await nexus.auth.getCurrentUser();

    if (!formData.title.trim() || !formData.description.trim() || !formData.retail_price) {
      showFeedback('Please fill out all required fields.', 'error');
      return;
    }

    if (!realBookFile) {
      showFeedback('Please select a book file to upload.', 'error');
      return;
    }

    if (formatWarning && !bypassWarning) {
      showFeedback('Please address the file format warning before uploading or click "Continue Anyway".', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      await executeWithAutoRefresh(async () => {
        // 1. Upload book file directly to storage
        let fileUrl = '';
        let bookFileName = '';
        if (realBookFile) {
          // Manuscripts go to the private bucket. What is stored is the object
          // key, not a URL: a private object has no durable public URL, only
          // short-lived signed ones minted per entitled request.
          try {
            const uploaded = await uploadBookFile(user.id, realBookFile);
            fileUrl = uploaded.key;
            bookFileName = uploaded.fileName;
          } catch (uploadErr: any) {
            console.error('[StoreManager] Manuscript upload failed:', uploadErr);
            showFeedback(
              `Failed to upload manuscript: ${errorMessage(uploadErr, 'please try again')}`,
              'error'
            );
            return;
          }
        }

        // 2. Upload sample file if selected
        let sampleUrl = '';
        let samplePagesName = '';
        // Samples and covers stay public: they are the storefront, shown to
        // signed-out visitors browsing the catalogue.
        if (realSampleFile) {
          sampleUrl = await uploadPublicBookAsset('samples', user.id, realSampleFile);
          samplePagesName = realSampleFile.name;
        }

        let finalThumbnailUrl = formData.thumbnail_url.trim();
        if (realThumbnailFile) {
          finalThumbnailUrl = await uploadPublicBookAsset('covers', user.id, realThumbnailFile);
        }

        const priceNum = parseFloat(formData.retail_price) || 5000;
        const rentPriceNum = Number((priceNum * 0.1).toFixed(2));
        // An ISBN is either real or absent. This used to fabricate one from
        // `978-` plus nine random digits when the field was blank, which
        // produces a number that looks plausible, fails checksum validation,
        // and could collide with a real book's registration. A missing ISBN is
        // an honest gap; an invented one is bad data that spreads into every
        // feed it touches. The database now rejects an invalid isbn_13
        // outright, so a fabricated value would be refused anyway.
        const rawIsbn = formData.isbn.trim();
        const normalizedIsbn = rawIsbn ? normalizeIsbn(rawIsbn) : '';
        if (normalizedIsbn && !isValidIsbn13(normalizedIsbn)) {
          showFeedback(
            'That ISBN-13 is not valid. Check the digits, or leave the field empty.',
            'error'
          );
          return;
        }
        const parsedTags = formData.tags.trim()
          ? formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
          : [];

        const newItem = {
          id: `b-${Date.now()}`,
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category,
          retail_price: priceNum,
          rental_price: rentPriceNum,
          cover_url: finalThumbnailUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='300' height='400' fill='%23F1F5F9'/><g transform='translate(110, 140)' stroke='%2394A3B8' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'><rect x='0' y='0' width='80' height='100' rx='8'/><path d='M 20 30 L 60 30'/><path d='M 20 50 L 60 50'/><path d='M 20 70 L 40 70'/></g><text x='150' y='280' fill='%2394A3B8' font-family='system-ui, sans-serif' font-size='14' font-weight='800' text-anchor='middle' letter-spacing='1'>NO COVER</text></svg>",
          author_id: user.id,
          author_name: user.full_name,
          
          // New columns
          language: formData.language.trim() || 'English',
          // ISO 639-1 alongside the display name, which is what retailers and
          // library systems index on.
          language_code: languageNameToCode(formData.language) || 'en',
          publication_date: formData.publication_date.trim() || new Date().toISOString().split('T')[0],
          publication_date_iso:
            formData.publication_date.trim() || new Date().toISOString().split('T')[0],
          pages: parseInt(formData.pages) || null,
          age_rating: formData.age_rating,
          // NULL when the author has none, rather than a fabricated number.
          isbn_13: normalizedIsbn || null,
          // `edition` and `co_authors` were collected on the form and then
          // silently dropped — neither reached the insert at all.
          edition_number: parseInt(formData.edition) || 1,
          subtitle_text: formData.subtitle.trim() || null,
          publisher_name: formData.publisher_name.trim() || user.full_name,
          // An array: a book may carry several subjects, and retailers expect
          // the full set. The form offers one to keep the choice simple.
          bisac_codes: formData.bisac_code ? [formData.bisac_code] : null,
          license_type: formData.license_type,
          file_format: realBookFile
            ? /\.epub$/i.test(realBookFile.name) ? 'EPUB' : 'PDF'
            : null,
          file_size_bytes: realBookFile?.size ?? null,
          copyright_year: new Date().getFullYear(),
          copyright_holder: user.full_name,
          rights_statement: formData.rights_statement,
          // tags and sample_pages are TEXT columns holding JSON, which is what
          // libraryService's parseJsonArraySafe expects on the way back out.
          // Sending a raw JS array here does not round-trip.
          tags: JSON.stringify(parsedTags),
          sample_pages: JSON.stringify(sampleUrl ? [sampleUrl] : []),
          rating: 5.0,
          section: formData.category,
          file_url: fileUrl,
          book_file_name: bookFileName || 'uploaded_material.pdf',
          material_type: materialType,
          suggested_format: formatSuggestions[materialType]?.best || 'PDF',
          uploaded_format: realBookFile ? realBookFile.name.split('.').pop()?.toUpperCase() : 'PDF'
        };

        const { error } = await nexus.database.from('api_books').insert([newItem]);
        if (error) throw error;

        // Co-authors become contributor rows. The primary author is added by a
        // database trigger, so these start at display_order 1.
        //
        // This is the other half of the dropped-fields problem: the form asked
        // for co-authors and then threw the answer away.
        const coAuthors = formData.co_authors
          .split(',')
          .map(name => name.trim())
          .filter(Boolean);

        if (coAuthors.length > 0) {
          const { error: contribErr } = await nexus.database
            .from('book_contributors')
            .insert(
              coAuthors.map((name, index) => ({
                book_id: newItem.id,
                contributor_name: name,
                contributor_role: 'A01',
                display_order: index + 1
              }))
            );

          // A failed co-author write must not lose the book itself, which is
          // already saved — report it and carry on.
          if (contribErr) {
            console.error('[StoreManager] Could not save co-authors:', contribErr);
          }
        }

        // Submit book for Content Manager review automatically to sync with database reviews
        const { error: reviewErr } = await nexus.database.from('book_reviews').insert([{
          book_id: newItem.id,
          submitted_by: user.id,
          status: 'pending',
          checklist_cover: false,
          checklist_description: false,
          checklist_readable: false,
          checklist_price: false,
          checklist_no_copyright: false
        }]);
        if (reviewErr) throw reviewErr;

        // Screen the manuscript for plagiarism and AI-generated text.
        //
        // Fire-and-forget: scanning is asynchronous and takes minutes, and the
        // result reaches the reviewer through a webhook. A scan that fails to
        // start must not lose an upload that has already succeeded — the
        // failure is recorded against the book, so the review queue shows that
        // nothing was checked rather than implying a clean result.
        nexus.functions
          .invoke('book-scan', { body: { bookId: newItem.id } })
          .catch(scanErr => console.error('[StoreManager] Could not start scan:', scanErr));

        showFeedback('Item published and submitted for review successfully!');
        setIsAdding(false);
        setFormData({
          title: '',
          description: '',
          category: 'E-book',
          retail_price: '',
          rental_price: '',
          thumbnail_url: '',
          file_url: '',
          language: 'English',
          publication_date: '',
          pages: '',
          age_rating: 'All Ages / G',
          isbn: '',
          tags: '',
          co_authors: '',
          edition: '',
          subtitle: '',
          publisher_name: '',
          bisac_code: '',
          rights_statement: 'World',
          license_type: 'allrightsreserved'
        });
        setRealBookFile(null);
        setRealSampleFile(null);
        setFileType('epub');
        
        // Dispatch library update event
        window.dispatchEvent(new Event('trileza-book-published'));
        
        fetchItems();
      });
    } catch (err: any) {
      console.error('Error creating item:', err);
      showFeedback('Failed to publish item: ' + (err.message || err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to retract this item? It will be removed from the library.')) return;

    try {
      const { error } = await nexus.database
        .from('api_books')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Hot-reload library catalog
      window.dispatchEvent(new Event('trileza-book-published'));

      fetchItems();
      showFeedback('Book retracted from library catalog.');
    } catch (e: any) {
      console.error(e);
      showFeedback('Failed to retract book: ' + (e.message || e), 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Sales', value: items.reduce((acc, item) => acc + (item.sales_count || 0), 0), icon: Package, color: 'emerald' },
          { label: 'Store Revenue', value: `₦${(items.reduce((acc, item) => acc + ((item.sales_count || 0) * item.retail_price), 0)).toLocaleString()}`, icon: DollarSign, color: 'indigo' },
          { label: 'Active Listings', value: items.length, icon: TrendingUp, color: 'amber' }
        ].map((stat, i) => (
          <Card key={i} className="p-6 border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity`}>
              <stat.icon size={80} />
            </div>
            <div className="relative z-10 flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-600`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <Package className="text-indigo-600" /> Public Listings
        </h3>
        <Button 
          onClick={() => setIsAdding(true)}
          className="bg-slate-900 text-white rounded-2xl px-6 py-3 font-bold flex items-center gap-2 shadow-lg shadow-slate-900/20 hover:scale-105 transition-transform"
        >
          <Plus size={18} /> List New Material
        </Button>
      </div>

      {/* Main Listings Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={item.id}
            >
              <Card className="p-5 border-none shadow-lg shadow-slate-100 rounded-[2rem] bg-white group hover:shadow-2xl transition-all border border-transparent hover:border-slate-100">
                <div className="flex gap-6">
                  <div className="w-32 h-44 rounded-2xl overflow-hidden shadow-md flex-shrink-0 relative">
                    <img src={item.thumbnail_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-md text-[8px] font-black uppercase tracking-widest text-slate-900">
                      {item.category}
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-black text-slate-900 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{item.title}</h4>
                        <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><MoreVertical size={18} /></button>
                      </div>
                      <p className="text-slate-500 text-xs font-medium line-clamp-2 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                      {/* Metadata Badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {item.language && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            {item.language}
                          </span>
                        )}
                        {item.pages && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            {item.pages} Pages
                          </span>
                        )}
                        {item.age_rating && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            {item.age_rating}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Retail Price</p>
                          <p className="font-black text-slate-900">₦{item.retail_price}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rental Price</p>
                          <p className="font-black text-indigo-600">₦{item.rental_price}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Sales</p>
                          <p className="font-black text-emerald-600">{item.sales_count || 0}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                        <button className="flex-1 py-2 rounded-xl bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                          <Edit3 size={14} /> Edit
                        </button>
                        <button className="flex-1 py-2 rounded-xl bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                          <Eye size={14} /> View Live
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && !loading && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 space-y-4 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="p-6 rounded-full bg-slate-100 text-slate-300">
              <Package size={48} />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-600">No public listings yet</p>
              <p className="text-sm">Start monetizing your knowledge materials today.</p>
            </div>
            <Button onClick={() => setIsAdding(true)} className="bg-slate-900 text-white rounded-xl">List Your First Book</Button>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            <div className="p-5 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">List New Material</h2>
                <p className="text-slate-500 text-sm font-medium">Fill in the details to publish to the public library.</p>
              </div>
              <button onClick={() => setIsAdding(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-5 sm:p-8 space-y-6 sm:space-y-8 max-h-[80vh] sm:max-h-[70vh] overflow-y-auto custom-scrollbar text-slate-700">
              {/* SECTION 1: CORE INFO */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  1. Core Learning Material Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Title of Material *</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Advanced System Design Patterns"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-sm"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                  </div>

                  {/* Synopsis */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Description / Synopsis *</label>
                    <textarea 
                      required
                      rows={3}
                      placeholder="Explain what mentees will learn from this material..."
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all resize-none text-sm leading-relaxed"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Category</label>
                    <select 
                      className="w-full h-[3.25rem] px-6 rounded-2xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none cursor-pointer text-sm"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                      <option>Programming & Development</option>
                      <option>Data Science & AI</option>
                      <option>Business & Management</option>
                      <option>Marketing & Sales</option>
                      <option>Design & Creative</option>
                      <option>Personal Development</option>
                      <option>Finance & Accounting</option>
                      <option>Health & Wellness</option>
                      <option>Education & Teaching</option>
                      <option>Language Learning</option>
                      <option>Science & Engineering</option>
                      <option>Mathematics</option>
                      <option>Certification Prep</option>
                      <option>Academic & Textbooks</option>
                      <option>Career & Job Search</option>
                      <option>Legal & Compliance</option>
                      <option>Real Estate & Construction</option>
                      <option>Creative Writing & Journalism</option>
                      <option>Music & Performing Arts</option>
                      <option>Photography & Videography</option>
                      <option>Others</option>
                    </select>
                  </div>

                  {/* Thumbnail URL */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-550 ml-1">Cover Image (Attach or Link)</label>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
                      {/* Visual Square Preview / Placeholder */}
                      <div className="w-28 h-28 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center overflow-hidden relative shadow-inner">
                        {realThumbnailFile || formData.thumbnail_url ? (
                          <img 
                            src={realThumbnailFile ? URL.createObjectURL(realThumbnailFile) : formData.thumbnail_url} 
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
                            id="real-thumbnail-file-input" 
                            accept="image/*"
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setRealThumbnailFile(file);
                                setFormData({...formData, thumbnail_url: ''}); // Clear URL if file selected
                              }
                            }}
                          />
                          <div 
                            onClick={() => document.getElementById('real-thumbnail-file-input')?.click()}
                            className={`border border-dashed rounded-xl px-4 py-2 flex items-center justify-between gap-2 h-11 cursor-pointer transition-all ${
                              realThumbnailFile 
                                ? 'border-emerald-450 bg-emerald-50/10' 
                                : 'border-slate-250 bg-slate-50/50 hover:bg-slate-100/50'
                            }`}
                          >
                            <span className="text-[10px] text-slate-500 font-bold truncate">
                              {realThumbnailFile ? realThumbnailFile.name : 'Upload cover image...'}
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
                          placeholder="Paste image URL here..."
                          className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                          value={formData.thumbnail_url}
                          onChange={(e) => {
                            setFormData({...formData, thumbnail_url: e.target.value});
                            if (e.target.value) setRealThumbnailFile(null); // Clear file if URL typed
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: METADATA */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  2. Learning Asset Specifications & Metadata
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Language */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Globe size={11} /> Language
                    </label>
                    {/* A list, not free text. Typed input silently failed the
                        ISO 639-1 mapping — "english" or "Eng" mapped to
                        nothing, and the book was stored as 'en' regardless,
                        so a French book could be filed as English. */}
                    <select
                      className="w-full h-11 px-5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none cursor-pointer text-xs"
                      value={formData.language}
                      onChange={(e) => setFormData({...formData, language: e.target.value})}
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.code} value={l.name}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Publication Date */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <TrendingUp size={11} /> Publication Date
                    </label>
                    <input 
                      type="date" 
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs cursor-pointer"
                      value={formData.publication_date}
                      onChange={(e) => setFormData({...formData, publication_date: e.target.value})}
                    />
                  </div>

                  {/* Number of Pages */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <BookOpen size={11} /> Number of Pages
                    </label>
                    <input 
                      type="number" 
                      placeholder="e.g. 250"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                      value={formData.pages}
                      onChange={(e) => setFormData({...formData, pages: e.target.value})}
                    />
                  </div>

                  {/* Age Suitability */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Milestone size={11} /> Age Rating
                    </label>
                    <select 
                      className="w-full h-11 px-5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none cursor-pointer text-xs"
                      value={formData.age_rating}
                      onChange={(e) => setFormData({...formData, age_rating: e.target.value})}
                    >
                      <option>All Ages / G</option>
                      <option>Teen / PG-13</option>
                      <option>Mature / R</option>
                    </select>
                  </div>

                  {/* ISBN */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Hash size={11} /> ISBN
                    </label>
                    {/* No longer auto-generated. The old placeholder promised
                        a number this form used to invent from random digits —
                        which failed its checksum and could collide with a real
                        registration. Blank is now a correct answer. */}
                    <input
                      type="text"
                      placeholder="13 digits, or leave blank"
                      className={cn(
                        'w-full px-5 py-3.5 rounded-xl bg-slate-50 border font-bold text-slate-900 focus:ring-2 focus:bg-white focus:outline-none transition-all text-xs',
                        isbnInvalid
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-slate-200/60 focus:ring-indigo-500'
                      )}
                      value={formData.isbn}
                      onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                    />
                    <p className={cn(
                      'text-[9px] font-bold ml-1',
                      isbnInvalid ? 'text-red-600' : 'text-slate-400'
                    )}>
                      {isbnInvalid
                        ? 'Those digits do not form a valid ISBN-13 — check them against your registration.'
                        : 'Optional. Retailers and libraries cannot list a book without one.'}
                    </p>
                  </div>

                  {/* Edition */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Layers size={11} /> Edition
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. 2nd Revision"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                      value={formData.edition}
                      onChange={(e) => setFormData({...formData, edition: e.target.value})}
                    />
                  </div>

                  {/* Subtitle */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Type size={11} /> Subtitle
                    </label>
                    <input
                      type="text"
                      placeholder="Optional"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({...formData, subtitle: e.target.value})}
                    />
                  </div>

                  {/* Publisher */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Building size={11} /> Publisher
                    </label>
                    <input
                      type="text"
                      placeholder="Your name, if self-published"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                      value={formData.publisher_name}
                      onChange={(e) => setFormData({...formData, publisher_name: e.target.value})}
                    />
                  </div>

                  {/* Subject category.
                      BISAC is what retailers and libraries shelve by — without
                      one the book is far harder to find. */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <BookMarked size={11} /> Subject Category
                    </label>
                    <select
                      className="w-full h-11 px-5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none cursor-pointer text-xs"
                      value={formData.bisac_code}
                      onChange={(e) => setFormData({...formData, bisac_code: e.target.value})}
                    >
                      <option value="">Select a subject…</option>
                      {BISAC_CATEGORIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Territory rights */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Globe size={11} /> Territory Rights
                    </label>
                    <select
                      className="w-full h-11 px-5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none cursor-pointer text-xs"
                      value={formData.rights_statement}
                      onChange={(e) => setFormData({...formData, rights_statement: e.target.value})}
                    >
                      <option value="World">World — sell anywhere</option>
                      <option value="Africa">Africa only</option>
                      <option value="Nigeria">Nigeria only</option>
                      <option value="Europe">Europe only</option>
                      <option value="North America">North America only</option>
                    </select>
                  </div>

                  {/* Licence */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Shield size={11} /> Licence
                    </label>
                    <select
                      className="w-full h-11 px-5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none cursor-pointer text-xs"
                      value={formData.license_type}
                      onChange={(e) => setFormData({...formData, license_type: e.target.value})}
                    >
                      <option value="allrightsreserved">All rights reserved</option>
                      <option value="creativecommons">Creative Commons</option>
                      <option value="publicdomain">Public domain</option>
                    </select>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <Tag size={11} /> Tags / Keywords (comma-separated)
                    </label>
                    <input 
                      type="text" 
                      placeholder="systems, architecture, typescript"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                      value={formData.tags}
                      onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    />
                  </div>

                  {/* Co Authors */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
                      <UserPlus size={11} /> Co-Authors / Contributors
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Prof. Alice Smith"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                      value={formData.co_authors}
                      onChange={(e) => setFormData({...formData, co_authors: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: PRICING & BORROWING */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  3. Pricing & Rental Framework
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Retail Price */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Retail Price (₦) *</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      placeholder="5000"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-sm"
                      value={formData.retail_price}
                      onChange={(e) => {
                        const val = e.target.value;
                        const calculatedRental = val ? (parseFloat(val) * 0.1).toFixed(2) : '';
                        setFormData({
                          ...formData, 
                          retail_price: val,
                          rental_price: calculatedRental
                        });
                      }}
                    />
                  </div>

                  {/* Rental Price */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Borrow Fee (₦) (10% of Retail Price)</label>
                    <input 
                      disabled
                      type="number" 
                      placeholder="500"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-100 border border-slate-200/60 font-bold text-slate-400 cursor-not-allowed text-sm"
                      value={formData.rental_price}
                    />
                    <span className="text-[9px] text-slate-450 font-bold block mt-1 ml-1">Auto-calculated borrow rate for 14 days of access.</span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: FILE UPLOADS */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  4. Secure Content Upload
                </h3>

                <div className="grid grid-cols-1 gap-6">
                  {/* Material Type Dropdown */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5">
                      <FileType size={11} /> Material Type *
                    </label>
                    <select 
                      value={materialType}
                      onChange={(e) => handleMaterialTypeChange(e.target.value)}
                      className="w-full h-[3.25rem] px-6 rounded-2xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none cursor-pointer text-sm"
                    >
                      <option value="journal">📄 Journal Paper</option>
                      <option value="conference">📄 Conference Paper</option>
                      <option value="magazine">📰 Magazine</option>
                      <option value="book_text">📖 Book (Text-heavy)</option>
                      <option value="book_picture">🖼️ Book (Picture/Art)</option>
                      <option value="thesis">📑 Thesis/Dissertation</option>
                      <option value="report">📊 Report/Whitepaper</option>
                      <option value="manual">📋 Manual/Guide</option>
                      <option value="newsletter">📬 Newsletter</option>
                      <option value="other">📎 Other</option>
                    </select>
                  </div>

                  {/* Smart Suggestion UI */}
                  {materialType && formatSuggestions[materialType] && (
                    <div className="border-l-4 border-indigo-500 bg-indigo-50/20 p-5 rounded-2xl space-y-3 border border-indigo-100/50 shadow-xs text-left animate-in fade-in slide-in-from-top duration-300">
                      <div className="flex items-start gap-2.5">
                        <span className="text-base text-indigo-500">💡</span>
                        <div className="space-y-1">
                          <h4 className="font-black text-xs text-indigo-900 uppercase tracking-wider">Format Recommendation</h4>
                          <p className="text-[11px] text-slate-650 font-bold leading-relaxed">
                            {formatSuggestions[materialType].reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl font-extrabold text-[9px] uppercase tracking-wider shadow-xs">
                          ⭐ Best: {formatSuggestions[materialType].best}
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block">
                      Upload Book File *
                    </label>
                    <input 
                      type="file" 
                      id="store-book-file-input" 
                      accept=".pdf,.docx,.epub,.tex,.txt,.md"
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        handleFileChange(file || null);
                      }}
                    />
                    <div 
                      onClick={() => document.getElementById('store-book-file-input')?.click()}
                      className={`border-2 border-dashed rounded-[1.5rem] p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        realBookFile 
                          ? 'border-emerald-400 bg-emerald-50/10' 
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className={`p-3 rounded-xl bg-white shadow-sm mb-3 ${realBookFile ? 'text-emerald-500' : 'text-indigo-500'}`}>
                        <UploadCloud size={24} />
                      </div>
                      <h4 className="font-black text-xs text-slate-800 truncate max-w-xs">
                        {realBookFile ? realBookFile.name : `Click to select file`}
                      </h4>
                      <p className="text-[10px] text-slate-450 mt-1">Max 50MB • Accepted: PDF, DOCX, EPUB, TeX, TXT, MD • DRM Protected</p>
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
                        <p className="text-[11px] text-slate-650 font-bold leading-relaxed">
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
                                const fileInput = document.getElementById('store-book-file-input') as HTMLInputElement;
                                if (fileInput) fileInput.value = '';
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-250 rounded-xl font-extrabold text-[9px] uppercase tracking-wider transition-all"
                            >
                              Go Back
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SUBMIT BUTTONS */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-slate-100">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setIsAdding(false)}
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 rounded-2xl py-4 font-bold border-slate-200 text-slate-500 hover:text-slate-700 text-xs tracking-wider"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  // A bad ISBN is refused by the database anyway; stopping it
                  // here means the author sees which field is wrong rather
                  // than a constraint violation after everything uploads.
                  disabled={isSubmitting || isbnInvalid}
                  className="w-full sm:flex-1 rounded-2xl py-4 font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                      <span>Publishing Blueprint...</span>
                    </>
                  ) : (
                    <span>Publish to Library</span>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}


    </div>
  );
};

export default StoreManager;
