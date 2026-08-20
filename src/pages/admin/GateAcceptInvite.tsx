import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function GateAcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const { user, signIn, signUp, initialized, initialize } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{ email: string; roles: string[] } | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialized && token) {
      validateToken();
    } else if (!initialized) {
      initialize();
    }
  }, [token, initialized]);

  const validateToken = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_INSFORGE_URL}/functions/v1/admin-invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', token })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Invalid or expired token.');
      } else {
        setInviteData(data);
        // If user is already logged in with the same email, auto-accept
        if (user && user.email === data.email) {
          processAcceptance(user.id);
        } else if (user) {
          // Logged in with different email, need to logout first
          useAuthStore.getState().logout();
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while validating the invitation.');
    } finally {
      setLoading(false);
    }
  };

  const processAcceptance = async (userId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_INSFORGE_URL}/functions/v1/admin-invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', token, userId })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation.');
        setSubmitting(false);
      } else {
        // Success! Reload auth state to get new admin roles
        await initialize();
        navigate('/gate/login', { replace: true, state: { message: 'Invitation accepted! Please login.' } });
      }
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;
    setSubmitting(true);
    setError(null);

    try {
      if (authMode === 'login') {
        const res = await signIn(inviteData.email, password);
        if (res.error) throw new Error(res.error);
        
        // signIn sets the user if successful, we can get the user ID
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          await processAcceptance(currentUser.id);
        } else {
           throw new Error('Authentication failed.');
        }
      } else {
        const res = await signUp(inviteData.email, password, fullName, 'management');
        if (res.error) throw new Error(res.error);
        if (res.requireVerification) {
          // If requires verification, user might need to verify email first. 
          // For admin invites, we might assume they own the email if they clicked the link, 
          // but InsForge might enforce OTP.
          navigate('/auth/verify', { state: { email: inviteData.email, returnToAcceptToken: token } });
          return;
        }
        
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          await processAcceptance(currentUser.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium">Validating invitation...</p>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Invalid Invitation</h1>
          <p className="text-gray-500">{error || 'This invitation link is invalid or has expired.'}</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  // If we are here and not auto-accepting, show auth form
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Invitation</h1>
          <p className="text-gray-500 mt-2">
            You've been invited to join Trileza as an admin with roles:{' '}
            <span className="font-semibold text-gray-900">
              {inviteData.roles.map(r => r.replace('_', ' ')).join(', ')}
            </span>
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="email"
                disabled
                value={inviteData.email}
                className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          {authMode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {submitting ? 'Processing...' : (authMode === 'login' ? 'Sign in & Accept' : 'Create Account & Accept')}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {authMode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button onClick={() => setAuthMode('register')} className="text-indigo-600 hover:underline font-medium">
                Create one
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button onClick={() => setAuthMode('login')} className="text-indigo-600 hover:underline font-medium">
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
