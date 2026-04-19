import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-8 text-center border border-border bg-surface"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-rust">Something went wrong</p>
            <p className="font-sans text-sm text-t2 max-w-md">{this.state.message}</p>
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 border border-border bg-elevated hover:bg-border/30"
              onClick={() => this.setState({ hasError: false, message: '' })}
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
