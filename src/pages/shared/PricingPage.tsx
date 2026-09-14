import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PricingSection } from '../../components/pricing/PricingSection';
import { Button } from '../../components/ui';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { 
  ArrowLeft, 
  ShieldCheck, 
  HelpCircle, 
} from 'lucide-react';

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeRole } = useAuthStore();
  const { tier: currentTier } = useSubscriptionStore();

  // Derive contextual header label
  const currentRole = activeRole || resolveActiveRole(user) || 'mentee';
  const currentRoleLower = (currentRole as string)?.toLowerCase() || '';
  const isMentee = currentRoleLower === 'mentee';
  const isInstitutional = 
    currentRoleLower === 'management' || 
    currentRoleLower === 'institutional' || 
    currentRoleLower === 'tenant_admin';
  const effectiveTier = isInstitutional ? 'institutional' : currentTier;

  const headerLabel = 'Plans & Pricing';

  const faqs = [
    {
      q: 'How does the Free Mentor tier work?',
      a: 'The Free Mentor tier is designed specifically for new educators to test the Trileza LMS ecosystem with zero upfront cost or credit card requirement. You can publish 1 complete course, enroll up to 50 students, and experience our core teaching tools at ₦0.'
    },
    {
      q: 'How does subscription billing work?',
      a: 'All subscriptions are billed securely in Nigerian Naira (NGN). You can pay with bank cards, bank transfers, USSD, or digital checkout. Subscriptions renew automatically at your chosen interval (monthly or yearly), and you can cancel anytime from your dashboard.'
    },
    {
      q: 'What happens if I upgrade from Free Mentor to Pro Mentor or Institutional mid-cycle?',
      a: 'Trileza calculates prorated billing in real-time. Any unused credit from your current active billing cycle is automatically discounted from your new plan charge immediately upon checkout.'
    },
    {
      q: 'How do custom subdomains work for the Institutional Tier?',
      a: 'When you activate the Institutional tier, your dedicated subdomain (e.g. yourinstitution.trileza.com) is provisioned instantly with your custom logo, theme colors, and multi-tenant user isolation. You can also configure a custom domain like lms.youruniversity.edu.'
    },
    {
      q: 'Can instructors on Pro Mentor earn from course sales?',
      a: 'Yes! Pro Mentor unlocks full commercial capabilities, automated certificate delivery upon course completion, advanced drop-off analytics, and instant payout splits.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="border-slate-300 dark:border-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">Trileza LMS</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {headerLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!user ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="text-xs font-bold border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/login?intent=signup')}
                  className="bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-500 text-white dark:text-black font-bold text-xs rounded-xl shadow-md"
                >
                  Get Started Free
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate('/')}
                className="bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-xl"
              >
                Go to Dashboard →
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Pricing Content ── */}
      <main>
        <PricingSection />

        {/* ── FAQ Section ── */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-slate-200 dark:border-slate-800">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-wider mb-2">
              <HelpCircle className="w-3.5 h-3.5" />
              Frequently Asked Questions
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Everything You Need to Know
            </h3>
          </div>

          <div className="space-y-4">
            {faqs.map((item, idx) => (
              <div 
                key={idx} 
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-2">
                  {item.q}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security & Compliance Footer Band ── */}
        <div className="bg-slate-100 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800 py-10 px-6 text-center text-xs text-slate-500 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              PCI-DSS Level 1 256-Bit SSL Encrypted • 99.9% Uptime SLA • Instant Auto-Sync
            </span>
          </div>
          <p className="text-slate-400 max-w-lg mx-auto text-[11px]">
            All subscriptions, tier upgrades, and feature access are synced instantly across your account without requiring manual page refreshes.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PricingPage;
