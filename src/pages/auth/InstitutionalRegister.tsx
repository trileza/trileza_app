import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { tenantService } from '../../lib/services/tenants';
import { isValidSubdomain, buildTenantUrl } from '../../utils/tenant';

export const InstitutionalRegister: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [institutionName, setInstitutionName] = useState<string>('');
  const [subdomain, setSubdomain] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [institutionType, setInstitutionType] = useState<string>('university');
  const [primaryColor, setPrimaryColor] = useState<string>('#4f46e5');

  // Admin User State
  const [adminName, setAdminName] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');

  // Plan Selection
  const [plan, setPlan] = useState<'starter' | 'growth' | 'enterprise'>('growth');

  // UI state
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [registeredUrl, setRegisteredUrl] = useState<string | null>(null);

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(val);

    if (val && !isValidSubdomain(val)) {
      setSubdomainError('Subdomain must be 3-30 lowercase alphanumeric characters (e.g. oxford)');
    } else {
      setSubdomainError(null);
    }
  };

  const handleNameBlur = () => {
    if (!subdomain && institutionName) {
      const generated = institutionName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 25);
      if (isValidSubdomain(generated)) {
        setSubdomain(generated);
      }
    }
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName || !subdomain || !email || !adminName) return;

    if (!isValidSubdomain(subdomain)) {
      setSubdomainError('Invalid subdomain format');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await tenantService.createTenant({
        name: institutionName,
        subdomain,
        custom_domain: customDomain || undefined,
        email,
        plan,
        primary_color: primaryColor,
        admin_name: adminName,
        admin_password: adminPassword
      });

      const fullUrl = buildTenantUrl(result.tenant.subdomain);
      setRegisteredUrl(fullUrl);
      setStep(3);
    } catch (err: any) {
      console.error('[InstitutionalRegister] Registration error:', err);
      setSubdomainError(err?.message || 'Failed to create institutional tenant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans">
      {/* Background Glow Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar Header */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-800/80 z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25 text-xl">
            T
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white">Trileza</span>
            <span className="text-xs font-semibold px-2 py-0.5 ml-2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Enterprise Multi-Tenant LMS
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-slate-300">
          Back to Portal
        </Button>
      </header>

      {/* Main Registration Card */}
      <main className="max-w-3xl w-full mx-auto my-12 z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
          {/* Wizard Progress Indicator */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
            <div className={`flex items-center gap-3 ${step >= 1 ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-800'}`}>1</span>
              <span>Institution Info</span>
            </div>
            <div className="h-0.5 flex-1 bg-slate-800 mx-4" />
            <div className={`flex items-center gap-3 ${step >= 2 ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800'}`}>2</span>
              <span>Plan & Admin</span>
            </div>
            <div className="h-0.5 flex-1 bg-slate-800 mx-4" />
            <div className={`flex items-center gap-3 ${step === 3 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-800'}`}>3</span>
              <span>Launch</span>
            </div>
          </div>

          {step === 1 && (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
              <div>
                <h2 className="text-2xl font-bold text-white">Register Your Institution</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Create an isolated, dedicated LMS tenant environment for your university, school, or organization.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Institution / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder="e.g. Oxford Professional Academy"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Dedicated Subdomain Slug *
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      required
                      value={subdomain}
                      onChange={handleSubdomainChange}
                      placeholder="oxford"
                      className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-l-xl text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                    />
                    <span className="px-4 py-3 bg-slate-800/80 border border-l-0 border-slate-800 rounded-r-xl text-slate-400 font-mono text-sm">
                      .trileza.com
                    </span>
                  </div>
                  {subdomainError ? (
                    <p className="text-xs text-rose-400 mt-1">{subdomainError}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      Your institution will be accessible at: <span className="text-indigo-400 font-mono">{subdomain ? `${subdomain}.trileza.com` : '{subdomain}.trileza.com'}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Institution Type
                    </label>
                    <select
                      value={institutionType}
                      onChange={(e) => setInstitutionType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="university">University / Higher Ed</option>
                      <option value="school">K-12 Academy / School</option>
                      <option value="training">Professional Training Provider</option>
                      <option value="corporate">Corporate Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Primary Contact Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@institution.edu"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Custom Domain Mapping (Optional)
                  </label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="lms.yourdomain.com"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={!institutionName || !subdomain || !!subdomainError}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-semibold"
                >
                  Continue to Admin Setup →
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-6" onSubmit={handleSubmitRegistration}>
              <div>
                <h2 className="text-2xl font-bold text-white">Select Plan & Administrator</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Configure primary admin credentials and institutional tier.
                </p>
              </div>

              {/* Plan Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'starter', title: 'Starter Tier', users: 'Up to 2,000 Users', price: '$149/mo' },
                  { id: 'growth', title: 'Growth Tier', users: 'Up to 10,000 Users', price: '$499/mo', popular: true },
                  { id: 'enterprise', title: 'Enterprise Tier', users: 'Unlimited Users & Subdomains', price: '$1,499/mo' }
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setPlan(p.id as any)}
                    className={`cursor-pointer rounded-2xl p-4 border transition relative flex flex-col justify-between ${
                      plan === p.id
                        ? 'border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-500/10'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute -top-2.5 right-3 bg-indigo-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                    <div>
                      <h4 className="font-bold text-white">{p.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{p.users}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <span className="text-lg font-extrabold text-indigo-400">{p.price}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin Credentials */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
                  Tenant Super Admin Credentials
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Admin Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Dr. Sarah Vance"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Admin Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Institution Brand Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer"
                    />
                    <span className="font-mono text-sm text-slate-300">{primaryColor}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !adminName || !adminPassword}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-semibold"
                >
                  {isSubmitting ? 'Provisioning Environment...' : 'Provision Institution Tenant →'}
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-8 space-y-6 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 text-3xl">
                ✓
              </div>

              <div>
                <h2 className="text-3xl font-bold text-white">Institution Provisioned!</h2>
                <p className="text-slate-400 max-w-md mx-auto mt-2">
                  <span className="font-bold text-white">{institutionName}</span> is now active with isolated multi-tenant architecture and RLS data security.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-w-lg mx-auto text-left font-mono text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subdomain:</span>
                  <span className="text-indigo-400">{subdomain}.trileza.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Admin Account:</span>
                  <span className="text-slate-200">{email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenant Plan:</span>
                  <span className="text-emerald-400 capitalize">{plan}</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  variant="primary"
                  onClick={() => navigate(`/tenant-admin/${subdomain}`)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-semibold w-full sm:w-auto"
                >
                  Go to Tenant Admin Dashboard
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (registeredUrl) window.open(registeredUrl, '_blank');
                  }}
                  className="bg-slate-800 text-slate-200 hover:bg-slate-700 px-6 py-3 rounded-xl w-full sm:w-auto"
                >
                  Visit Institutional Subdomain ↗
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center py-6 text-xs text-slate-500 border-t border-slate-800/60 z-10">
        © {new Date().getFullYear()} Trileza LMS Multi-Tenant Infrastructure. All Rights Reserved.
      </footer>
    </div>
  );
};

export default InstitutionalRegister;
