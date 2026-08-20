import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { adminService } from '../../lib/services/admin';
import { Shield, BookOpen, Users, DollarSign, LifeBuoy, Scale, BarChart3, ChevronRight, Check } from 'lucide-react';

const GateOnboarding: React.FC = () => {
  const { adminUser, initialize } = useAuthStore();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!adminUser) {
      navigate('/gate/login', { replace: true });
      return;
    }
    if (adminUser.onboarding_completed) {
      navigate('/gate/dashboard', { replace: true });
    }
  }, [adminUser, navigate]);

  if (!adminUser) return null;

  const role = adminUser.role;

  // Dynamic Content based on role
  const getRoleContent = () => {
    switch (role) {
      case 'super_admin':
        return {
          title: 'Super Admin Operational Command',
          icon: Shield,
          color: 'from-red-650 to-red-500',
          textColor: 'text-red-400',
          welcome: 'You have been granted Central Command credentials. You hold absolute oversight of the platform infrastructure, configurations, audit trails, and administrative access controls.',
          tutorial: [
            'Monitor system status and diagnostics in real time.',
            'Review the audit log trail to inspect every admin action.',
            'Manage Role-Based Access Controls (RBAC) and verify admin applications.',
            'Manage 2FA bypass overrides during troubleshooting events.'
          ],
          permissions: {
            allowed: ['Assign admin roles', 'Toggle 2FA bypass', 'Inspect system logs', 'Full access to all dashboards'],
            denied: ['None (Root Privilege)']
          },
          firstTask: 'Navigate to the Audit Tab on your dashboard to review the platform operational logs.'
        };
      case 'content_manager':
        return {
          title: 'Content Manager Deck',
          icon: BookOpen,
          color: 'from-amber-600 to-amber-500',
          textColor: 'text-amber-400',
          welcome: 'Welcome to the Content Desk. You are responsible for maintaining the quality and compliance of courses and books submitted to the platform library.',
          tutorial: [
            'Review video resolution (must be 720p or higher) and clear audio levels.',
            'Check that curricula have at least 5 lessons.',
            'Verify cover pages and descriptions for books.',
            'Annotate time-stamped corrections directly on course videos.'
          ],
          permissions: {
            allowed: ['Approve / Reject Courses', 'Approve / Reject Books', 'Annotate reviews & send correction checklists'],
            denied: ['Modify user accounts', 'Access wallet logs', 'Process payouts']
          },
          firstTask: 'Access your Content Queue and review the course "Advanced Agentic Coding Patterns".'
        };
      case 'user_manager':
        return {
          title: 'User Registry & Verification',
          icon: Users,
          color: 'from-emerald-600 to-emerald-500',
          textColor: 'text-emerald-400',
          welcome: 'Welcome to User Management. You oversee identity verifications, mentor tier upgrades, and platform suspension workflows.',
          tutorial: [
            'Verify national ID uploads and qualifications for tutor applications.',
            'Suspend or unsuspend accounts violating system safety rules.',
            'Audit student activity and profiles.'
          ],
          permissions: {
            allowed: ['Audit tutor applications', 'Suspend user profiles', 'Manage mentor tier upgrades'],
            denied: ['Approve course content', 'View transaction details', 'GDPR export data']
          },
          firstTask: 'Audit the tutor application for "Liam Okonkwo" and verify their HCI qualification credentials.'
        };
      case 'finance_admin':
        return {
          title: 'Financial Ledger & Payouts',
          icon: DollarSign,
          color: 'from-indigo-600 to-indigo-500',
          textColor: 'text-indigo-400',
          welcome: 'Welcome to Finance Control. You manage payout requests, transaction tracking, commissions, and refunds.',
          tutorial: [
            'Process and sign payout requests over ₦500k (smaller payouts auto-clear).',
            'Verify Paystack vendor subaccount setups.',
            'Inspect transaction histories and issue course refunds.'
          ],
          permissions: {
            allowed: ['Approve payout requests', 'Trigger customer refunds', 'Audit wallet ledgers'],
            denied: ['Alter user accounts', 'Moderate course queues', 'Read support tickets']
          },
          firstTask: 'Process the pending ₦650,000 payout request for mentor Liam Okonkwo.'
        };
      case 'support_agent':
        return {
          title: 'Support Helpdesk Deck',
          icon: LifeBuoy,
          color: 'from-cyan-600 to-cyan-500',
          textColor: 'text-cyan-400',
          welcome: 'Welcome to the Support Desk. You resolve user inquiries, live chats, and system ticket escalations.',
          tutorial: [
            'Triage incoming tickets (Low, Medium, High, Urgent priority).',
            'Respond to students and mentors regarding enrollment or access issues.',
            'Escalate unresolved infrastructure bugs to Super Admin.'
          ],
          permissions: {
            allowed: ['Respond to support tickets', 'Modify ticket status', 'Escalate issues to Compliance/Super Admin'],
            denied: ['Approve payouts', 'Publish course content', 'Erase audit logs']
          },
          firstTask: 'Open your support ticket queue and address the ticket: "Cannot access enrolled course c1".'
        };
      case 'compliance_officer':
        return {
          title: 'Compliance & Legal Deck',
          icon: Scale,
          color: 'from-purple-600 to-purple-500',
          textColor: 'text-purple-400',
          welcome: 'Welcome to Compliance. You manage copyright claims (DMCA), terms violations, and GDPR data export/erasure requests.',
          tutorial: [
            'Triage copyright infringement notices and flag plagiarized courses.',
            'Process GDPR data dumps (retrieve profile, wallet, and message logs).',
            'Enforce platform Terms of Service.'
          ],
          permissions: {
            allowed: ['Access GDPR data exporter', 'Moderate copyright claims', 'Triage Terms of Service violations'],
            denied: ['Modify payout bank details', 'Approve mentor qualification tiers']
          },
          firstTask: 'Compile and export the GDPR data package requested by Pearson Publishing.'
        };
      default:
        return {
          title: 'Analytics Business Intelligence',
          icon: BarChart3,
          color: 'from-slate-600 to-slate-500',
          textColor: 'text-slate-400',
          welcome: 'Welcome to the Business Intelligence Deck. You analyze course enrollment trends, financial summaries, and platform growth metrics.',
          tutorial: [
            'Inspect revenue graphs, average transaction figures, and vendor balances.',
            'Audit course rating distribution and active learner charts.',
            'Export metrics reports for management.'
          ],
          permissions: {
            allowed: ['Read-only access to analytics dashboards', 'Export reports'],
            denied: ['All platform write operations', 'Triage tickets', 'Modify users/content']
          },
          firstTask: 'Open the analytics deck and view the monthly course sales share trends.'
        };
    }
  };

  const content = getRoleContent();
  const Icon = content.icon;

  const handleNext = async () => {
    if (step < 5) {
      setLoading(true);
      // Track onboarding step in db
      const stepNames = ['welcome', 'tutorial', 'permissions', 'first_task', 'completed'];
      await adminService.updateOnboardingStep(adminUser.id, stepNames[step - 1]);
      setStep(step + 1);
      setLoading(false);
    } else {
      setLoading(true);
      try {
        await adminService.completeOnboarding(adminUser.id);
        await initialize(); // Refresh store state
        navigate('/gate/dashboard');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slate-800/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-xl w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 md:p-10 shadow-2xl relative">
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent`} />

        {/* Header Progress */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Onboarding Process</span>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div 
                key={s} 
                className={`w-5 h-1.5 rounded-full transition-all duration-300 ${
                  s === step 
                    ? 'bg-emerald-500 w-8' 
                    : s < step 
                      ? 'bg-emerald-800' 
                      : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="space-y-6 min-h-[250px] text-left">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className={`p-4 bg-slate-800 border border-slate-700 rounded-2xl`}>
                  <Icon className="text-emerald-400" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-wider">{content.title}</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Welcome Protocol</p>
                </div>
              </div>
              <p className="text-sm text-slate-350 leading-relaxed">{content.welcome}</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">Operational Tutorial</h3>
                <p className="text-slate-500 text-xs">Step-by-step walkthrough checklist</p>
              </div>
              <div className="space-y-3.5">
                {content.tutorial.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center text-[10px] font-mono text-emerald-400 shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">Privilege Matrix</h3>
                <p className="text-slate-500 text-xs">Clearance boundaries & permissions</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Allowed */}
                <div className="p-5 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl">
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Authorized Actions
                  </h4>
                  <ul className="space-y-2 text-xs text-emerald-200">
                    {content.permissions.allowed.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check size={12} className="text-emerald-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Denied */}
                <div className="p-5 bg-red-950/15 border border-red-900/20 rounded-2xl">
                  <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Restricted Actions
                  </h4>
                  <ul className="space-y-2 text-xs text-red-200">
                    {content.permissions.denied.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-red-500 shrink-0 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">First Operational Mission</h3>
                <p className="text-slate-500 text-xs">Required action to complete clearance</p>
              </div>
              <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-mono mb-2">Assignment:</p>
                <p className="text-sm text-slate-200 font-bold leading-relaxed">{content.firstTask}</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                By clicking "Acknowledge Mission", you confirm that you have read your training guide and are ready to execute your duties.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 text-center">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-xl">
                <Check size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white uppercase tracking-wide">Clearance Confirmed</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                  Your security tokens have been signed. Your role access credentials are now fully active.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-10 flex justify-end">
          <button
            onClick={handleNext}
            disabled={loading}
            className="w-full sm:w-auto px-6 h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-450 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-600/20 transition-all"
          >
            {loading ? (
              <span>Signing token...</span>
            ) : (
              <>
                <span>{step === 5 ? 'Launch Dashboard' : 'Acknowledge & Continue'}</span>
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GateOnboarding;
