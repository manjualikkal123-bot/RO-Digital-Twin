import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-slate-900 text-slate-200 rounded-xl border border-slate-700 p-8 shadow-2xl">
          <AlertTriangle className="text-rose-500 w-16 h-16 mb-6 animate-pulse" />
          <h1 className="text-2xl font-bold mb-2">Component Crashed</h1>
          <p className="text-slate-400 mb-8 max-w-md text-center">
            A fatal error occurred within this section of the dashboard. The rest of the application remains online.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <RefreshCw size={18} />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
