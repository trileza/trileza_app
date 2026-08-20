import React, { useState } from 'react';
import { Card, Button } from '../../components/ui';
import { FileText, Upload, Share, Trash2, Database, ShoppingBag, Shield } from 'lucide-react';
import { Toast } from '../../components/ui/Toast';
import StoreManager from '../../components/mentor/StoreManager';
import { cn } from '../../utils';

const Vault = () => {
  const [activeTab, setActiveTab] = useState<'private' | 'store'>('private');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 w-full">
      {/* Global Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-8 md:p-12 rounded-2xl sm:rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #052e16 0%, #14532d 25%, #166534 50%, #15803d 75%, #16a34a 100%)'
      }}>
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-emerald-400/20 rounded-full blur-[100px] translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
               <Database className="text-emerald-400" size={18} />
            </div>
            <span className="text-emerald-400 font-black tracking-[0.2em] uppercase text-[10px] sm:text-xs">Knowledge Base</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">Resource Vault</h1>
          <p className="text-emerald-100/90 font-medium max-w-xl text-xs sm:text-base md:text-lg mt-1 sm:mt-2">Securely upload, manage, and distribute learning materials to your mentoring pods.</p>
        </div>
        
        <div className="relative z-10 hidden md:flex items-center gap-4 bg-white/10 border border-white/20 p-4 rounded-2xl backdrop-blur-md">
           <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl"><Upload size={24}/></div>
           <div>
              <p className="font-bold text-white leading-tight">Unlimited Storage</p>
              <p className="text-xs text-emerald-200/80">Mentor privileges active</p>
           </div>
        </div>
      </div>

      {/* Tabs — Stack on small screens */}
      <div className="flex flex-col sm:flex-row gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl w-full sm:w-fit">
        <button 
          onClick={() => setActiveTab('private')}
          className={cn(
            "flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all w-full sm:w-auto touch-target",
            activeTab === 'private' ? "bg-emerald-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Shield size={14} /> Private Vault
        </button>
        <button 
          onClick={() => setActiveTab('store')}
          className={cn(
            "flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all w-full sm:w-auto touch-target",
            activeTab === 'store' ? "bg-slate-900 dark:bg-slate-950 text-white shadow-md border border-slate-700" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <ShoppingBag size={14} /> Public Store Manager
        </button>
      </div>
      
      <div className="relative z-10">
        {activeTab === 'private' ? (
          <Card className="p-8 border-none shadow-xl shadow-slate-200/50 rounded-[2rem]">
            <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2"><FileText className="text-emerald-500"/> Private Resource Vault</h3>
            
            <label className="border-2 border-dashed border-emerald-200 bg-emerald-50/50 rounded-2xl p-8 flex flex-col items-center justify-center mb-8 cursor-pointer hover:bg-emerald-50 transition-colors relative">
              <Upload className="text-emerald-500 mb-3" size={32} />
              <h4 className="font-bold text-emerald-900">Upload PDF, Zip or File</h4>
              <p className="text-xs text-emerald-600 mt-1">Files are secure and localized exclusively to your mentees.</p>
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                multiple 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    showFeedback(`Selected ${e.target.files.length} file(s) for upload.`);
                  }
                }} 
              />
            </label>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-700">Pod Files</h4>
              {['Advanced Architectures.pdf', 'React Patterns 2026.zip', 'System Design Cheatsheet.pdf'].map((file, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={16}/></div>
                    <span className="font-bold text-slate-800 text-sm">{file}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-slate-900 text-white font-bold h-8 text-xs" onClick={() => showFeedback('Sent notification directly to student feeds!')}>
                      <Share size={14} className="mr-1" /> Push to Feed
                    </Button>
                    <button className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <StoreManager />
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Vault;

