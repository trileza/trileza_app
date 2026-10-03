/**
 * Catches a render error inside the admin console.
 *
 * There was no error boundary anywhere in this application. A thrown render
 * error — a null where a row was expected, a field that moved — unmounted the
 * whole tree and left a blank white page with nothing in it: no message, no
 * way back, and for an administrator mid-task, no idea whether their last
 * action had taken effect.
 *
 * Scoped per section rather than wrapped once around the console, so a failure
 * in one dashboard does not take the sidebar and the other sections with it.
 * An admin who cannot load payouts can still work on support tickets.
 */

import React from 'react';
import { AlertTriangle, RotateCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Shown in the message, so the admin knows which part failed. */
  section?: string;
  /** Lets the host offer a way out, e.g. back to the dashboard. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class AdminErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // The console is the only record for now. A reporting service belongs
    // here, but logging to one that does not exist would be worse than this:
    // it would look handled.
    console.error(
      `[Admin] ${this.props.section || 'section'} crashed:`,
      error,
      info.componentStack
    );
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-black text-white">
              {this.props.section ? `${this.props.section} could not load` : 'Something went wrong'}
            </h2>
            <p className="text-xs font-bold text-slate-400 leading-relaxed">
              This section stopped rather than showing you something wrong. The
              rest of the console still works.
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              If you were part-way through an action, check whether it took
              effect before trying it again.
            </p>
          </div>

          {/* The message, not the stack. An admin can quote this to support;
              a stack trace would only be noise to them. */}
          <p className="text-[10px] font-mono text-slate-600 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 break-words">
            {error.message || 'No further detail available.'}
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={this.reset}
              className="w-full h-11 rounded-2xl bg-brand-primary hover:bg-brand-primary-hover text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border-none cursor-pointer"
            >
              <RotateCw size={13} /> Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-2xl text-slate-500 hover:text-slate-300 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border-none bg-transparent cursor-pointer"
            >
              <ArrowLeft size={13} /> Reload the console
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AdminErrorBoundary;
