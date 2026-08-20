import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { adminService } from '../../lib/services/admin';
import { ShieldAlert, AlertTriangle, KeyRound, RefreshCw, X } from 'lucide-react';
import { getAdminRedirectPath } from '../../utils/adminRedirect';

const GateVerify2FA: React.FC = () => {
  const { adminUser, verifyAdmin2FA, cancelAdmin2FA } = useAuthStore();
  const navigate = useNavigate();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [useBackup, setUseBackup] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const requestedRole = params.get('role');

  useEffect(() => {
    if (!adminUser) {
      navigate('/signin', { replace: true });
    }
  }, [adminUser, navigate]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const res = await verifyAdmin2FA(otp.trim());
      if (res.error) {
        setError(res.error);
      } else {
        if (res.usedBackup) {
          alert('Backup code accepted. Access granted. Please update your 2FA settings if needed.');
        }
        const redirectPath = getAdminRedirectPath(adminUser, requestedRole);
        navigate(redirectPath);
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!adminUser) return;
    setResendLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const res = await adminService.generate2FACode(adminUser.id, adminUser.twofa_email);
      if (res.error) {
        setError(res.error);
      } else {
        setInfoMessage('A new verification code has been dispatched.');
        setResendCooldown(60); // 1 minute cooldown
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch new verification code.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleCancel = async () => {
    await cancelAdmin2FA();
    navigate('/signin');
  };

  if (!adminUser) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full z-10 space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 mb-6 border border-amber-450/20">
            <KeyRound size={32} className="text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wider">Two-Factor Auth</h1>
          <p className="text-slate-400 text-sm mt-2">
            Verification required for role: <strong className="text-amber-500">{adminUser.role.replace('_', ' ').toUpperCase()}</strong>
          </p>
        </div>

        {/* 2FA Card */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-left">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Verification Denied</p>
                  <p className="text-xs text-red-200 mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {infoMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3 text-left">
                <ShieldAlert size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Dispatch Success</p>
                  <p className="text-xs text-emerald-200 mt-1">{infoMessage}</p>
                </div>
              </div>
            )}

            <div className="text-center space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                {useBackup ? (
                  <span>Enter one of your 8-character backup codes generated during registration setup.</span>
                ) : (
                  <span>
                    A secure 6-digit verification protocol code was dispatched to:
                    <br />
                    <strong className="text-slate-200 font-mono">{adminUser.twofa_email}</strong>
                  </span>
                )}
              </p>

              <div className="space-y-2">
                <input
                  type="text"
                  maxLength={useBackup ? 12 : 6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder={useBackup ? "XXXX-XXXX" : "123456"}
                  className="w-full h-14 bg-slate-950/80 border border-slate-800 rounded-xl text-center text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-amber-500 transition-all placeholder-slate-800"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-450 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-600/20 active:scale-[0.98] disabled:opacity-55 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Validating credentials...</span>
                </>
              ) : (
                <span>Confirm Verification Code</span>
              )}
            </button>
          </form>

          {/* Verification Options */}
          <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendLoading}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <RefreshCw size={12} className={resendLoading ? 'animate-spin' : ''} />
              <span>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUseBackup(!useBackup);
                setOtp('');
                setError(null);
              }}
              className="text-amber-500 hover:text-amber-400 font-bold transition-colors"
            >
              {useBackup ? 'Use Email Code' : 'Use Backup Code'}
            </button>
          </div>
        </div>

        {/* Developer Help Box */}
        <div className="p-4 bg-slate-900/20 border border-slate-800/50 rounded-2xl text-[11px] text-slate-500 leading-relaxed text-center font-mono">
          🚨 DEV PROTOCOL TIP: If the platform mailer is offline or SMTP unconfigured, look in your browser's Developer Console logs to retrieve the 2FA code.
        </div>

        {/* Cancel button */}
        <div className="text-center">
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium"
          >
            <X size={12} />
            <span>Abort Session & Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GateVerify2FA;
