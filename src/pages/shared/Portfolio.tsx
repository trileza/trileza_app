import React from 'react';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { Briefcase, Globe, GitBranch, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared';

const Portfolio = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" className="p-2 gap-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back to Profile
        </Button>
      </div>

      <PageHeader 
        title="Interactive Portfolio"
        description={
          <>Welcome to the professional portfolio page for <span className="font-bold text-white">{user?.full_name || 'this educator'}</span>. This modular platform aggregates Git repositories, custom sandboxes, and project cases.</>
        }
        tag="Professional Resume"
        icon={Briefcase}
      />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 text-left">
          {[1, 2, 3, 4].map(idx => (
            <Card key={idx} className="bg-slate-50 border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="h-40 bg-slate-200 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                <img src={`https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=200&fit=crop&q=80&index=${idx}`} alt="project mock" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                <p className="absolute bottom-3 left-4 text-white font-bold text-sm">Project Module {idx}</p>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Deployed complex systems involving dynamic frontends and robust backends tailored for scale.
              </p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" className="text-[10px] uppercase font-bold py-1 h-auto text-slate-600"><Globe size={12} className="mr-1"/> Live View</Button>
                <Button size="sm" variant="outline" className="text-[10px] uppercase font-bold py-1 h-auto text-slate-600"><GitBranch size={12} className="mr-1"/> Source</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
  );
};

export default Portfolio;
