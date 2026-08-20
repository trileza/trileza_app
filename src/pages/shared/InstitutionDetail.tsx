import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { tenantService } from '../../lib/services/tenants';
import type { Tenant, Course } from '../../types';
import { Building2, Globe, GraduationCap, BookOpen, Users, Star, ArrowLeft, ShieldCheck } from 'lucide-react';

export const InstitutionDetail: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();

  const [institution, setInstitution] = useState<Tenant | null>(null);
  const [courses, setCourses] = useState<Partial<Course>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (institutionId) {
      loadInstitutionProfile(institutionId);
    }
  }, [institutionId]);

  const loadInstitutionProfile = async (id: string) => {
    setLoading(true);
    try {
      const inst = await tenantService.getTenantById(id);
      setInstitution(inst);
      if (inst) {
        const cList = await tenantService.getTenantCourses(inst.id);
        setCourses(cList);
      }
    } catch (err) {
      console.error('[InstitutionDetail] Error loading institution:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-pulse text-center space-y-2">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-400">Loading Institution Profile...</p>
        </div>
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Building2 size={48} className="text-slate-600" />
        <h2 className="text-2xl font-bold">Institution Not Found</h2>
        <p className="text-slate-400 text-sm max-w-sm">The institution you are looking for does not exist or is inactive.</p>
        <Button variant="primary" onClick={() => navigate('/institutions')}>
          Return to Directory
        </Button>
      </div>
    );
  }

  const primaryColor = institution.primary_color || '#4f46e5';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Header Banner */}
      <div
        className="h-48 sm:h-64 relative border-b border-slate-800"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}44 0%, #020617 100%)`
        }}
      >
        <div className="max-w-7xl mx-auto p-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/institutions')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-xs text-slate-300 hover:text-white transition"
          >
            <ArrowLeft size={14} /> Directory
          </button>
        </div>
      </div>

      {/* Profile Overview Header Card */}
      <div className="max-w-7xl mx-auto px-6 -mt-20 relative z-10 space-y-8">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6">
            <img
              src={institution.logo_url}
              alt={institution.name}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-800 shadow-xl"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{institution.name}</h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={12} /> Verified Partner
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
                  <Globe size={14} /> {institution.subdomain}.trileza.com
                </span>
                {institution.custom_domain && (
                  <span>Custom: {institution.custom_domain}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => navigate(`/tenant-admin/${institution.subdomain}`)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 py-2.5"
            >
              Institution Admin Login ⚙️
            </Button>
          </div>
        </div>

        {/* Statistics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-xs text-slate-400 font-medium">Published Courses</span>
            <p className="text-2xl font-extrabold text-white mt-1">{courses.length}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-xs text-slate-400 font-medium">Active Learners</span>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">1,420</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-xs text-slate-400 font-medium">Faculty Mentors</span>
            <p className="text-2xl font-extrabold text-indigo-400 mt-1">45</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-xs text-slate-400 font-medium">Plan Tier</span>
            <p className="text-2xl font-extrabold text-purple-400 mt-1 capitalize">{institution.plan}</p>
          </div>
        </div>

        {/* Institution Published Courses Grid */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-indigo-400" />
            Courses Offered by {institution.name} ({courses.length})
          </h2>

          {courses.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm">
              No courses published yet by this institution.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 space-y-4 flex flex-col justify-between transition hover:shadow-xl"
                >
                  <div className="space-y-3">
                    <img
                      src={c.thumbnail_url}
                      alt={c.title}
                      className="w-full h-40 rounded-xl object-cover border border-slate-800"
                    />
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {c.category}
                      </span>
                      <h3 className="font-bold text-white text-base line-clamp-1">{c.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2">{c.description}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{c.enrolled_count} Learners</span>
                    <span className="font-extrabold text-emerald-400">${c.price_tiers?.standard || 0} USD</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstitutionDetail;
