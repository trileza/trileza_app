import React, { useState } from 'react';
import { BookOpen, PlusCircle, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/shared/PageHeader';
import PublicLibraryWrapper from '../../components/shared/PublicLibraryWrapper';
import AuthorApplication from './AuthorApplication';
import AuthorDashboard from './AuthorDashboard';
import { Button } from '../../components/ui';

const PublicLibrary: React.FC = () => {
  const { user } = useAuthStore();
  const [showPublishingModal, setShowPublishingModal] = useState(false);
  
  // Dynamic header text based on the true role
  const descriptionText = (user?.role === 'mentor' || user?.role === 'tutor')
    ? "Review mentee borrow requests, fund crowdfund campaigns, gift official blueprints, and curate your public bookshelves."
    : "Explore elite blueprinted e-books, case studies, and templates. Rent with mentor backing (Borrow-to-Own) or initiate peer crowdfunding.";

  return (
    <div className="w-full pb-20 animate-in fade-in duration-500 space-y-8 relative">
      <PageHeader 
        title={
          <span>
            The Public <span className="text-emerald-400">Library</span>
          </span>
        }
        description={descriptionText}
        tag="Bookstore & Archive"
        icon={BookOpen}
        rightContent={
          user?.role !== 'management' ? (
            <Button 
              onClick={() => setShowPublishingModal(true)}
              className="w-full sm:w-auto gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest transition-all mt-3 sm:mt-0 cursor-pointer"
            >
              <PlusCircle size={14} /> Publish
            </Button>
          ) : null
        }
      />
      
      <PublicLibraryWrapper />

      {/* Publishing Modal Portal */}
      {showPublishingModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-md p-0 sm:p-4 md:p-10 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-y-auto relative shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35)] border border-white/10 dark:border-slate-800 animate-in zoom-in-95 duration-300 mobile-bottom-sheet">
            {/* Close Button */}
            <button 
              onClick={() => setShowPublishingModal(false)}
              className="absolute top-6 right-6 p-3 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white z-10 shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950"
              title="Close Panel"
            >
              <X size={20} />
            </button>
            
            <div className="p-6 md:p-10">
              <AuthorDashboard inline={true} onClose={() => setShowPublishingModal(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicLibrary;
