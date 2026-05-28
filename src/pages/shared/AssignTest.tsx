import React, { useState } from 'react';
import AssignmentCreator from '../../components/assignments/AssignmentCreator';
import { Toast } from '../../components/ui/Toast';
import { FileEdit, CheckCircle } from 'lucide-react';

const AssignTest = () => {
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      {/* Global Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950 p-8 md:p-12 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-900/20 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500 rounded-full blur-[100px] opacity-30 animate-pulse" />
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-brand-primary rounded-full blur-[100px] opacity-20 translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
               <FileEdit className="text-emerald-400" size={20} />
            </div>
            <span className="text-emerald-400 font-black tracking-[0.2em] uppercase text-xs">Standardized Assessments</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">Assignment Creator</h1>
          <p className="text-slate-400 font-medium max-w-xl text-lg mt-2">Design rigorous, multi-format evaluations and deploy them instantly to your learning pods.</p>
        </div>
        
        <div className="relative z-10 hidden md:flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
           <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl"><CheckCircle size={24}/></div>
           <div>
              <p className="font-bold text-white leading-tight">Auto-Grading Ready</p>
              <p className="text-xs text-slate-400">Supported for MCQ tasks</p>
           </div>
        </div>
      </div>
      
      <div className="relative z-10">
         <AssignmentCreator showFeedback={showFeedback} />
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AssignTest;
