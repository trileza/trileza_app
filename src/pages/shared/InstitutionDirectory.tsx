import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { tenantService } from '../../lib/services/tenants';
import type { Tenant } from '../../types';
import { Search, Building2, Globe, GraduationCap, ChevronRight } from 'lucide-react';

export const InstitutionDirectory: React.FC = () => {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    loadInstitutions();
  }, []);

  const loadInstitutions = async () => {
    setLoading(true);
    try {
      const data = await tenantService.getInstitutions();
      setInstitutions(data);
    } catch (err) {
      console.error('[InstitutionDirectory] Error loading institutions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredInstitutions = institutions.filter(inst => {
    const matchesSearch = inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inst.custom_domain && inst.custom_domain.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Default type matching based on settings or plan
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Hero Header */}
      <section className="relative py-16 px-6 border-b border-slate-800 bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-4 text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20">
            <Building2 size={14} /> Multi-Tenant Network
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Institutional Partner Directory
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Explore world-class universities, schools, training providers, and corporate academies operating independent learning environments on Trileza.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto mt-8 flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl">
            <Search size={18} className="text-slate-400 ml-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search institutions by name or domain..."
              className="w-full bg-transparent px-3 py-2 text-sm text-white focus:outline-none placeholder-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-500 hover:text-slate-300 mr-3"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Listing Section */}
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Active Institutions ({filteredInstitutions.length})
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/institution-signup')}
            className="text-xs border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10"
          >
            + Register Your Institution
          </Button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading directory...</div>
        ) : filteredInstitutions.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
            <Building2 size={40} className="mx-auto text-slate-600" />
            <h3 className="text-lg font-bold text-white">No Institutions Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              We couldn't find any institution matching your query. Try broadening your search or register your organization.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInstitutions.map((inst) => (
              <div
                key={inst.id}
                onClick={() => navigate(`/institutions/${inst.id}`)}
                className="group cursor-pointer bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between space-y-6 relative overflow-hidden"
              >
                {/* Accent line using institution's primary color */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: inst.primary_color || '#4f46e5' }}
                />

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <img
                      src={inst.logo_url}
                      alt={inst.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-800 group-hover:scale-105 transition"
                    />
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 text-indigo-400 border border-slate-800">
                      {inst.subdomain}.trileza.com
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-white text-lg group-hover:text-indigo-300 transition line-clamp-1">
                      {inst.name}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                      <Globe size={12} className="text-slate-500" />
                      {inst.custom_domain || `${inst.subdomain}.trileza.com`}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <GraduationCap size={14} className="text-indigo-400" /> Verified Partner
                  </span>
                  <span className="font-semibold text-indigo-400 group-hover:translate-x-1 transition flex items-center gap-1">
                    View Profile <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default InstitutionDirectory;
