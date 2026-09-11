import React, { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Twin Peaks Case Board Error Caught]:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem('tp_caseboard_cards_v2');
      localStorage.removeItem('tp_caseboard_stickies_v2');
      localStorage.removeItem('tp_caseboard_strings_v2');
      localStorage.removeItem('tp_caseboard_deleted_ids_v1');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d0705] text-[#e8dfd8] flex flex-col items-center justify-center p-6 select-none font-serif">
          <div className="max-w-md w-full border-2 border-[#8b2616] bg-[#1a0f0b] p-8 shadow-2xl rounded text-center">
            <div className="text-4xl mb-3">🌲☕🌲</div>
            <h1 className="text-xl font-bold uppercase tracking-widest text-[#cfb69b] mb-2 font-mono">
              Twin Peaks Sheriff Dispatch
            </h1>
            <p className="text-xs text-[#cfb69b]/80 mb-6 font-mono leading-relaxed">
              "The owls are not what they seem." A momentary glitch occurred in the dispatch logs.
            </p>
            {this.state.error?.message && (
              <div className="bg-black/50 border border-[#8b2616]/40 p-3 rounded text-left text-xs font-mono text-red-400/90 mb-6 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-[#8b2616] hover:bg-[#a6301d] text-white font-mono text-xs uppercase tracking-wider rounded transition-colors font-semibold"
              >
                Reload Investigation Board
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-2 px-4 bg-transparent hover:bg-white/5 border border-[#cfb69b]/30 text-[#cfb69b] font-mono text-xs uppercase tracking-wider rounded transition-colors"
              >
                Reset Stale Local Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
