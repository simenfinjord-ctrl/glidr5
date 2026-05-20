import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback. If omitted, a built-in "Something went wrong" card is shown. */
  fallback?: React.ReactNode;
  /** Optional label shown in the error card (e.g. "Analytics") */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    // Ship error to server so crashes are visible without user reports
    try {
      fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: error.message,
          stack: error.stack?.slice(0, 2000),
          componentStack: info.componentStack?.slice(0, 2000),
          label: this.props.label ?? null,
          href: window.location.pathname,
          ua: navigator.userAgent,
        }),
      }).catch(() => {});
    } catch {}
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            {this.props.label ? `${this.props.label} crashed` : "Something went wrong"}
          </p>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Try refreshing this section.
          </p>
          {this.state.error && (
            <p className="mt-1 font-mono text-xs text-muted-foreground/60 break-all">
              {this.state.error.message}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={this.reset} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    );
  }
}
