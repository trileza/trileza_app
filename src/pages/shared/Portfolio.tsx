import React from 'react';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { Briefcase, Globe, GitBranch, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared';

const Portfolio = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const projects = user?.metadata?.portfolio_projects || user?.metadata?.projects || [];

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-20">
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

        {projects.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 mt-12">
            <Briefcase size={48} className="mx-auto text-slate-300 mb-4 stroke-[1.5]" />
            <h3 className="text-xl font-bold text-slate-900">No projects added yet</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2 leading-relaxed">
              Showcase your repositories, interactive designs, and custom learning applications. Add project links to your profile settings to build your portfolio.
            </p>
            <Button 
              onClick={() => navigate('/settings')}
              className="mt-6 bg-brand-primary hover:bg-brand-primary-hover text-white border-none rounded-xl h-11 px-6 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/10"
            >
              Go to Settings
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 text-left animate-in fade-in">
            {projects.map((project: any, idx: number) => (
              <Card key={project.id || idx} className="bg-slate-50 border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 rounded-3xl flex flex-col justify-between">
                <div>
                  <div className="h-40 bg-slate-200 rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden">
                    {project.cover_url ? (
                      <img src={project.cover_url} alt={project.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-600">
                        <Briefcase size={36} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                    <p className="absolute bottom-3 left-4 text-white font-bold text-sm">{project.title}</p>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                    {project.description || 'No description provided.'}
                  </p>
                </div>
                <div className="flex gap-2 mt-auto">
                  {project.live_url && (
                    <Button size="sm" variant="outline" className="text-[10px] uppercase font-bold py-1 h-auto text-slate-655" onClick={() => window.open(project.live_url, '_blank')}>
                      <Globe size={12} className="mr-1"/> Live View
                    </Button>
                  )}
                  {project.source_url && (
                    <Button size="sm" variant="outline" className="text-[10px] uppercase font-bold py-1 h-auto text-slate-655" onClick={() => window.open(project.source_url, '_blank')}>
                      <GitBranch size={12} className="mr-1"/> Source
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
  );
};

export default Portfolio;
