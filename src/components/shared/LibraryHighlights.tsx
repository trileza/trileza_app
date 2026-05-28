import React from 'react';
import { BookOpen, Sparkles, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

const LibraryHighlights: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
      <div className="relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/20 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
          <BookOpen size={120} />
        </div>
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Library Highlights</h3>
              <p className="font-black text-slate-900 dark:text-white text-xl">Recommended by your Mentor</p>
            </div>
          </div>
          <Link to="/library" className="p-4 rounded-2xl bg-white border border-slate-100 text-slate-900 hover:bg-slate-50 transition-all shadow-sm">
            <ChevronRight size={20} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { 
              title: "The Architecture of Motivation", 
              author: "Dr. David Adamu",
              cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=400&h=600",
              tag: "Sponsorship Eligible"
            },
            { 
              title: "Sustainable Housing Systems", 
              author: "Dr. David Adamu",
              cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&h=600",
              tag: "Gifted by Author"
            }
          ].map((book, i) => (
            <motion.div 
              key={i}
              whileHover={{ x: 4 }}
              onClick={() => navigate('/library')}
              className="flex items-center gap-4 p-4 rounded-3xl bg-white/50 border border-white/40 hover:bg-white transition-all cursor-pointer"
            >
              <img src={book.cover} className="w-16 h-20 rounded-xl object-cover shadow-md" alt="" />
              <div>
                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50">{book.tag}</span>
                <h4 className="font-bold text-slate-900 text-sm mt-1">{book.title}</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">By {book.author}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LibraryHighlights;
