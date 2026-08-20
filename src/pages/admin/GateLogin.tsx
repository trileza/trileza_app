import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Lock, Mail, AlertTriangle } from 'lucide-react';
import { getAdminRedirectPath } from '../../utils/adminRedirect';

const GateLogin: React.FC = () => {
  const { signInAdmin } = useAuthStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const requestedRole = params.get('role');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signInAdmin(email.trim(), password);
      if (res.error) {
        setError(res.error);
      } else if (res.requireAdmin2FA) {
        navigate(requestedRole ? `/gate/verify-2fa?role=${requestedRole}` : `/gate/verify-2fa`);
      } else {
        const redirectPath = getAdminRedirectPath(res.adminUser, requestedRole);
        navigate(redirectPath);
      }
    } catch (err: any) {
      setError(err?.message || 'A cryptographic handshake error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full z-10 space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="Trileza Logo" className="w-16 h-16 object-contain mx-auto mb-6 drop-shadow-md animate-pulse" />
          <h1 className="text-3xl font-black text-white uppercase tracking-wider">Secure Admin Gate</h1>
          <p className="text-slate-400 text-sm mt-2">Administrative gate portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-left">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-400 tracking-wider">Access denied</p>
                  <p className="text-xs text-red-200 mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                className="w-full h-12 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white px-4 text-sm font-medium transition-all"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-400">Password</label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-12 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white px-4 text-sm font-medium transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/15 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying portal...</span>
                </>
              ) : (
                <span>Request Authorization</span>
              )}
            </button>
          </form>
        </div>

        {/* Footnotes */}
        <div className="text-center space-y-4">
          <p className="text-xs text-slate-500">
            Need administrative credentials?{' '}
            <Link 
              to={requestedRole ? `/signup?role=${requestedRole}` : '/signup'} 
              className="text-emerald-500 hover:text-emerald-400 font-bold transition-colors"
            >
              Submit Application
            </Link>
          </p>
          <div className="text-[10px] text-slate-655 font-mono">
            Secure connection established // IP logged
          </div>
        </div>
      </div>
    </div>
  );
};

export default GateLogin;
