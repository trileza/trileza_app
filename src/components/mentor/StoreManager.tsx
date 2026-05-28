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
  X
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
    file_url: ''
  });

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

    try {
      const newItem = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        retail_price: parseFloat(formData.retail_price),
        rental_price: parseFloat(formData.rental_price),
        thumbnail_url: formData.thumbnail_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800',
        file_url: formData.file_url,
        author_id: user.id,
        author_name: user.full_name,
        status: 'published',
        sales_count: 0,
        created_at: new Date().toISOString()
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
        file_url: ''
      });
      fetchItems();
    } catch (err) {
      console.error('Error creating item:', err);
      showFeedback('Failed to publish item', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Sales', value: items.reduce((acc, item) => acc + (item.sales_count || 0), 0), icon: Package, color: 'emerald' },
          { label: 'Store Revenue', value: `$${(items.reduce((acc, item) => acc + ((item.sales_count || 0) * item.retail_price), 0)).toLocaleString()}`, icon: DollarSign, color: 'indigo' },
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
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Retail Price</p>
                          <p className="font-black text-slate-900">${item.retail_price}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rental Price</p>
                          <p className="font-black text-indigo-600">${item.rental_price}</p>
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

            <form onSubmit={handleCreateItem} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Title of Material</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Advanced System Design Patterns"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Description</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="Explain what mentees will learn from this material..."
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Category</label>
                  <select 
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option>E-book</option>
                    <option>Resource Pack</option>
                    <option>Case Study</option>
                    <option>Template</option>
                    <option>Framework</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Thumbnail URL</label>
                  <input 
                    type="text" 
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({...formData, thumbnail_url: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Retail Price ($)</label>
                  <input 
                    required
                    type="number" 
                    placeholder="29.99"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.retail_price}
                    onChange={(e) => setFormData({...formData, retail_price: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Rental Price ($)</label>
                  <input 
                    required
                    type="number" 
                    placeholder="4.99"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.rental_price}
                    onChange={(e) => setFormData({...formData, rental_price: e.target.value})}
                  />
                </div>

                <div className="md:col-span-2 p-8 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 flex flex-col items-center justify-center text-center group hover:bg-slate-50 transition-colors">
                  <div className="p-4 rounded-2xl bg-white shadow-sm text-indigo-500 mb-4">
                    <Upload size={32} />
                  </div>
                  <h4 className="font-black text-slate-900">Upload Material File</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px]">PDF, EPUB, or ZIP files. Max size 50MB.</p>
                  <Button type="button" className="mt-4 bg-white text-slate-900 shadow-sm border border-slate-200">Select File</Button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 rounded-2xl py-4 font-bold border-slate-200"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="flex-1 rounded-2xl py-4 font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                >
                  Publish to Library
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
