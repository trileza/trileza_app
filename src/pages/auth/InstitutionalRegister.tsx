import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { tenantService } from '../../lib/services/tenants';
import { upgradeService } from '../../lib/services/upgrade';
import { isValidSubdomain } from '../../utils/tenant';
import { FormShell } from '../../components/shared';
import { Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';

/** The three stages of institution signup, shown inside the form header. */
const REGISTRATION_STEPS = [
  { label: 'Institution' },
  { label: 'Plan & admin' },
  { label: 'Review' }
];
import { publishUserEvent } from '../../lib/services/realtimeEvents';

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
    // A silent return here is what made the button appear dead.
    const missing = [
      !institutionName && 'institution name',
      !subdomain && 'portal address',
      !email && 'contact email',
      !adminName && 'administrator name'
    ].filter(Boolean);

    if (missing.length > 0) {
      setSubmitError(`Please go back and fill in the ${missing.join(', ')}.`);
      return;
    }

    setIsSubmitting(true);
    setSubdomainError(null);
    setSubmitError(null);
    try {
      // Format and availability are both checked here. Previously only the
      // format was, so two institutions could race for the same address and the
      // loser only found out when the insert failed.
      const check = await upgradeService.checkSubdomain(subdomain);
      if (!check.available) {
        // Reported on this step, not just step 1, or it is invisible.
        setSubmitError(`${check.reason || 'That portal address is not available.'} Go back to change it.`);
        setSubdomainError(check.reason || null);
        setIsSubmitting(false);
        return;
      }

      // Self-serve registration is an application, not a purchase: it is
      // created 'pending' and waits for a super admin, who approves it from the
      // Multi-Tenant console.
      const result = await tenantService.registerInstitution({
        name: institutionName,
        subdomain,
        custom_domain: customDomain || undefined,
        email,
        plan,
        primary_color: primaryColor
      });

      // Publish realtime event for instant Super Admin / Tenant Admin sync
      publishUserEvent('institution_registered', {
        tenantId: result.id,
        name: institutionName,
        subdomain,
        plan,
        email
      });

      setStep(3);
    } catch (err: any) {
      console.error('[InstitutionalRegister] Registration error:', err);
      setSubmitError(err?.message || 'We could not submit your registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans">
      {/* Background Glow Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar Header */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-200/80 dark:border-slate-800/80 z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 shadow-lg">
            <img src="/icon-192.png" alt="Trileza Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">Trileza</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 ml-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Enterprise Multi-Tenant LMS
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
          Back to Portal
        </Button>
      </header>

      {/* Main Registration Card */}
      <main className="max-w-3xl w-full mx-auto my-12 z-10">
        <>
          {step === 1 && (
            <FormShell
              eyebrow="Institution signup"
              title="Register your institution"
              description="Create a dedicated, isolated portal for your university, school or training organisation. We verify institution details before a portal goes live."
              icon={Building2}
              steps={REGISTRATION_STEPS}
              currentStep={1}
            >
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setStep(2); }}>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Institution / Company Name <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder="e.g. Oxford Professional Academy"
                    className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Dedicated Subdomain Slug <span className="text-emerald-500">*</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      required
                      value={subdomain}
                      onChange={handleSubdomainChange}
                      placeholder="oxford"
                      className="flex-1 h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l-2xl text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition"
                    />
                    <span className="h-12 px-4 bg-slate-100 dark:bg-slate-800/80 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-2xl text-slate-600 dark:text-slate-400 font-mono text-xs sm:text-sm flex items-center">
                      .trileza.com
                    </span>
                  </div>
                  {subdomainError ? (
                    <p className="text-xs text-rose-500 mt-1 font-medium">{subdomainError}</p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Your institution will be accessible at: <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{subdomain ? `${subdomain}.trileza.com` : '{subdomain}.trileza.com'}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Institution Type
                    </label>
                    <select
                      value={institutionType}
                      onChange={(e) => setInstitutionType(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition cursor-pointer"
                    >
                      <option value="university">University / Higher Ed</option>
                      <option value="school">K-12 Academy / School</option>
                      <option value="training">Professional Training Provider</option>
                      <option value="corporate">Corporate Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Primary Contact Email <span className="text-emerald-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@institution.edu"
                      className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Custom Domain Mapping (Optional)
                  </label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="lms.yourdomain.com"
                    className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={!institutionName || !subdomain || !!subdomainError}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 h-12 rounded-2xl font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 border-none cursor-pointer transition-all hover:scale-[1.01]"
                >
                  Continue to Admin Setup →
                </Button>
              </div>
            </form>
            </FormShell>
          )}

          {step === 2 && (
            <FormShell
              eyebrow="Institution signup"
              title="Plan & administrator"
              description="Choose a tier and name the person who will administer this portal. They receive the first admin account."
              icon={ShieldCheck}
              steps={REGISTRATION_STEPS}
              currentStep={2}
            >
            <form className="space-y-6" onSubmit={handleSubmitRegistration}>

              {/* Plan Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'starter', title: 'Free Mentor', users: '1 Course • 50 Students', price: '₦0 / forever' },
                  { id: 'growth', title: 'Pro Mentor', users: 'Unlimited Courses • 500 Students', price: '₦10,000 / mo' },
                  { id: 'enterprise', title: 'Institutional Tier', users: 'Unlimited Students • Custom Subdomain • SLA', price: '₦50,000 / mo', popular: true }
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setPlan(p.id as any)}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all relative flex flex-col justify-between ${
                      plan === p.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute -top-2.5 right-3 bg-emerald-500 text-black text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full shadow-sm">
                        Recommended
                      </span>
                    )}
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-sm">{p.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{p.users}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">{p.price}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin Credentials */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Tenant Super Admin Credentials
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Admin Full Name <span className="text-emerald-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Dr. Sarah Vance"
                      className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Admin Password <span className="text-emerald-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Institution Brand Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer p-0.5"
                    />
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{primaryColor}</span>
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="p-4 rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 flex items-start gap-3">
                  <span className="text-rose-500 text-lg leading-none mt-0.5" aria-hidden="true">!</span>
                  <div>
                    <p className="text-sm font-bold text-rose-800 dark:text-rose-200">Registration not submitted</p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">{submitError}</p>
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => { setSubmitError(null); setStep(1); }} className="text-slate-600 dark:text-slate-400">
                  ← Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !adminName || !adminPassword}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 h-12 rounded-2xl font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 border-none cursor-pointer transition-all hover:scale-[1.01]"
                >
                  {isSubmitting ? 'Provisioning Environment...' : 'Provision Institution Tenant →'}
                </Button>
              </div>
            </form>
            </FormShell>
          )}

          {step === 3 && (
            <FormShell
              eyebrow="Institution signup"
              title="Registration received"
              description="Your submission is with our team. Nothing further is needed from you right now."
              icon={CheckCircle2}
              steps={REGISTRATION_STEPS}
              currentStep={3}
            >
            <div className="text-center py-2 space-y-6 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500/15 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 text-3xl font-black shadow-lg shadow-emerald-500/20">
                ✓
              </div>

              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">Registration received</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 text-xs sm:text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">{institutionName}</span> has been submitted for review.
                  We verify institution details before a portal goes live, and your address is held for you in the meantime.
                </p>
                <p className="text-slate-400 max-w-md mx-auto mt-2 text-xs">
                  You will be emailed at <span className="font-bold text-slate-600 dark:text-slate-300">{email}</span> once it is approved.
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-w-lg mx-auto text-left font-mono text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subdomain:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{subdomain}.trileza.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Admin Account:</span>
                  <span className="text-slate-900 dark:text-slate-200">{email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenant Plan:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold capitalize">{plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">Awaiting approval</span>
                </div>
              </div>

              {/* Verification is the actual next step, and it is the long one.
                  Saying so here — rather than letting them discover it after
                  paying — is the difference between a queue that moves and one
                  full of institutions waiting on documents nobody asked for. */}
              <div className="p-4 sm:p-5 rounded-2xl bg-brand-light/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 max-w-lg mx-auto text-left">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Next: verify your institution</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Before your portal goes live we verify your registration, tax and banking details,
                  and the identity of the person authorised to act for you. It takes about 20 minutes
                  and saves as you go — you do not have to finish in one sitting.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  onClick={() => navigate('/institution/verification')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 h-12 rounded-2xl text-xs sm:text-sm shadow-xl shadow-emerald-500/25 border-none w-full sm:w-auto cursor-pointer"
                >
                  Start verification
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/checkout?plan=institutional&interval=monthly')}
                  className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 h-12 px-6 rounded-2xl w-full sm:w-auto font-bold text-xs sm:text-sm"
                >
                  Set up payment first
                </Button>
              </div>

              <button
                onClick={() => navigate('/')}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                I'll do this later
              </button>
            </div>
            </FormShell>
          )}
        </>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center py-6 text-xs text-slate-500 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-800/60 z-10">
        © {new Date().getFullYear()} Trileza LMS Multi-Tenant Infrastructure. All Rights Reserved.
      </footer>
    </div>
  );
};

export default InstitutionalRegister;
