import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  TrendingUp, 
  DollarSign, 
  BookOpen, 
  MoreVertical,
  Edit3,
  Trash2,
  Eye,
  ExternalLink,
  ChevronRight,
  Upload,
  X,
  UploadCloud,
  Tag,
  Milestone,
  Globe,
  Hash,
  Layers,
  UserPlus,
  Image
} from 'lucide-react';
import { Card, Button } from '../ui';
import { nexus } from '../../lib/nexus';
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
    edition: ''
  });

  const [realBookFile, setRealBookFile] = useState<File | null>(null);
  const [realSampleFile, setRealSampleFile] = useState<File | null>(null);
  const [realThumbnailFile, setRealThumbnailFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [user]);

  const fetchItems = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await nexus.database.from('books').select('*').eq('author_id', user.id);
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

    if (!formData.title.trim() || !formData.description.trim() || !formData.retail_price) {
      showFeedback('Please fill out all required fields.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload and convert manuscript to standard compliant EPUB 3 format
      let fileUrl = formData.file_url;
      let bookFileName = '';
      if (realBookFile) {
        try {
          const conversionFormData = new FormData();
          conversionFormData.append('file', realBookFile);
          conversionFormData.append('userId', user.id);
          
          const userToken = (nexus as any).tokenManager?.getAccessToken() || '';
          
          const conversionRes = await fetch('https://25t8cbg8.functions.insforge.app/convert-manuscript', {
            method: 'POST',
            body: conversionFormData,
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
            fileUrl = conversionData.originalUrl; // Use the uploaded original file URL to preserve high-fidelity native layouts (PDF/DOCX)
            bookFileName = realBookFile.name;
          } else if (conversionData.convertedUrl) {
            fileUrl = conversionData.convertedUrl; // Fallback to converted EPUB 3 file
            bookFileName = realBookFile.name.replace(/\.[a-zA-Z0-9]+$/, '.epub');
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
            alert('Failed to upload manuscript file due to storage permissions. The book will be created without the file attachment.');
          }
          bookFileName = realBookFile.name;
        }
      }

      // 2. Upload sample file if selected
      let sampleUrl = '';
      let samplePagesName = '';
      if (realSampleFile) {
        const cleanSampleName = realSampleFile.name.replace(/\.\./g, '_').replace(/^\//, '');
        const samplePath = `samples/${user.id}_${Date.now()}_${cleanSampleName}`;
        const { error: sampleErr } = await nexus.storage
          .from('course-materials-trileza-784bc328')
          .upload(samplePath, realSampleFile);
        if (sampleErr) throw sampleErr;

        sampleUrl = nexus.storage
          .from('course-materials-trileza-784bc328')
          .getPublicUrl(samplePath);
        samplePagesName = realSampleFile.name;
      }

      let finalThumbnailUrl = formData.thumbnail_url.trim();
      if (realThumbnailFile) {
        const cleanThumbName = realThumbnailFile.name.replace(/\.\./g, '_').replace(/^\//, '');
        const thumbPath = `covers/${user.id}_${Date.now()}_${cleanThumbName}`;
        const { error: thumbErr } = await nexus.storage
          .from('course-materials-trileza-784bc328')
          .upload(thumbPath, realThumbnailFile);
        if (thumbErr) throw thumbErr;
        finalThumbnailUrl = nexus.storage
          .from('course-materials-trileza-784bc328')
          .getPublicUrl(thumbPath);
      }

      const priceNum = parseFloat(formData.retail_price) || 5000;
      const rentPriceNum = Number((priceNum * 0.1).toFixed(2));
      const generatedIsbn = formData.isbn.trim() || `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
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
        publication_date: formData.publication_date.trim() || new Date().toISOString().split('T')[0],
        pages: parseInt(formData.pages) || null,
        age_rating: formData.age_rating,
        isbn: generatedIsbn,
        tags: parsedTags,
        sample_pages: sampleUrl ? [sampleUrl] : [],
        rating: 5.0,
        section: formData.category,
        file_url: fileUrl,
        book_file_name: bookFileName || 'uploaded_material.pdf'
      };

      const { error } = await nexus.database.from('books').insert([newItem]);
      if (error) throw error;

      showFeedback('Item published successfully!');
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
        edition: ''
      });
      setRealBookFile(null);
      setRealSampleFile(null);
      
      // Dispatch library update event
      window.dispatchEvent(new Event('trileza-book-published'));
      
      fetchItems();
    } catch (err: any) {
      console.error('Error creating item:', err);
      showFeedback('Failed to publish item: ' + (err.message || err), 'error');
    } finally {
      setIsSubmitting(false);
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
                        <button className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
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
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">List New Material</h2>
                <p className="text-slate-500 text-sm font-medium">Fill in the details to publish to the public library.</p>
              </div>
              <button onClick={() => setIsAdding(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar text-slate-700">
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
                    
                    <div className="flex gap-4 items-start pt-1">
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
                    <input 
                      type="text" 
                      placeholder="e.g. English, French"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                      value={formData.language}
                      onChange={(e) => setFormData({...formData, language: e.target.value})}
                    />
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
                    <input 
                      type="text" 
                      placeholder="Auto-generated if blank"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200/60 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-xs"
                      value={formData.isbn}
                      onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                    />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Primary PDF */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block font-sans">
                      Primary Learning Material (PDF/EPUB/DOCX/TXT/MD) *
                    </label>
                    <input 
                      type="file" 
                      id="store-book-file-input" 
                      accept=".pdf,.epub,.docx,.txt,.md"
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setRealBookFile(file);
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
                        {realBookFile ? realBookFile.name : 'Select Primary Book File'}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1">PDF, EPUB, DOCX, TXT, or MD. Max 50MB. DRM Protected.</p>
                    </div>
                  </div>

                  {/* Sample PDF */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block font-sans">
                      Free Preview / Sample Pages (Optional PDF)
                    </label>
                    <input 
                      type="file" 
                      id="store-sample-file-input" 
                      accept=".pdf"
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setRealSampleFile(file);
                      }}
                    />
                    <div 
                      onClick={() => document.getElementById('store-sample-file-input')?.click()}
                      className={`border-2 border-dashed rounded-[1.5rem] p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        realSampleFile 
                          ? 'border-emerald-400 bg-emerald-50/10' 
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className={`p-3 rounded-xl bg-white shadow-sm mb-3 ${realSampleFile ? 'text-emerald-500' : 'text-slate-400'}`}>
                        <UploadCloud size={24} />
                      </div>
                      <h4 className="font-black text-xs text-slate-800 truncate max-w-xs">
                        {realSampleFile ? realSampleFile.name : 'Select Sample Preview File'}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1">PDF file. Allow mentees to read first few pages.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SUBMIT BUTTONS */}
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setIsAdding(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-2xl py-4 font-bold border-slate-200 text-slate-500 hover:text-slate-700 text-xs tracking-wider"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-2xl py-4 font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
