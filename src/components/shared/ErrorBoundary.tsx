import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onSwitchToDemo?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected application error.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let parsedPath: string | null = null;
    let parsedError = this.state.message;
    try {
      const parsed = JSON.parse(this.state.message) as { error?: string; path?: string };
      if (parsed && typeof parsed.error === 'string') {
        parsedError = parsed.error;
        parsedPath = parsed.path ?? null;
      }
    } catch {
      // Plain error message
    }

    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-6">
        <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-md w-full space-y-4">
          <h1 className="text-lg font-bold text-[#141413]">Something went wrong</h1>
          <p className="text-xs text-stone-600 leading-relaxed">
            {parsedError}
            {parsedPath ? ` (Path: ${parsedPath})` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[#141413] text-white text-xs font-semibold cursor-pointer"
            >
              Reload App
            </button>
            {this.props.onSwitchToDemo && (
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  this.props.onSwitchToDemo?.();
                }}
                className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-[#141413] hover:bg-stone-50 cursor-pointer"
              >
                Switch to Developer Demo Mode
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
