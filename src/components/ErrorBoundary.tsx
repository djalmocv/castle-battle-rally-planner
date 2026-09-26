import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches rendering errors in the component tree and shows a recovery UI
 * instead of an unmountable white screen.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in Castle Battle Rally Planner:', error, info);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-200 p-6">
        <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="text-red-400" size={24} />
            </div>
          </div>
          <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-400 mb-4">
            The planner hit an unexpected error. Your saved roster and layouts are stored
            locally and should still be intact.
          </p>
          {this.state.error && (
            <pre className="text-[11px] text-left text-red-300/80 bg-slate-950/80 border border-slate-800 rounded-lg p-3 mb-4 overflow-auto max-h-32 font-mono">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="w-full bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold text-sm rounded-lg px-4 py-2.5"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
