import React, { useState } from 'react';
import AssignmentViewer from '../../components/assignments/AssignmentViewer';
import { Toast } from '../../components/ui/Toast';
import { FileText, Target, CheckCircle, Clock, Check, Loader2, X, Download, FileSignature, TrendingUp, AlertCircle, MessageSquare } from 'lucide-react';
import { PageHeader } from '../../components/shared';

const Assignments = () => {
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      <PageHeader 
        title="My Assignments"
        description="Track your learning milestones, complete assigned tasks, and review your graded assessments."
        tag="Knowledge Verification"
        icon={FileText}
        rightContent={
          <div className="hidden md:flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
             <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl"><Target size={24}/></div>
             <div>
                <p className="font-bold text-white leading-tight">Action Required</p>
                <p className="text-xs text-slate-400">2 Pending Tasks</p>
             </div>
          </div>
        }
      />
      
      <div className="relative z-10">
        <AssignmentViewer showFeedback={showFeedback} />
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Assignments;
