import { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      const isPermissionError = 
        this.state.error?.message?.toLowerCase().includes("permission") ||
        this.state.error?.message?.toLowerCase().includes("denied") ||
        this.state.error?.message?.toLowerCase().includes("notallowederror");

      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card className="border-t-4 border-t-orange-500">
              <CardHeader className="text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-orange-500 mb-2" />
                <CardTitle className="text-orange-600">
                  {this.props.fallbackTitle || (isPermissionError ? "Permission Required" : "Something went wrong")}
                </CardTitle>
                <CardDescription>
                  {this.props.fallbackDescription || (
                    isPermissionError 
                      ? "This page requires camera or location permissions that may not be available in this browser. Try opening on a mobile device or grant permissions in your browser settings."
                      : "An unexpected error occurred. Please try refreshing the page."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={this.handleRetry} className="w-full" data-testid="button-retry">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = "/"} 
                  className="w-full"
                  data-testid="button-go-home"
                >
                  Go to Home
                </Button>
                {this.state.error && (
                  <details className="text-xs text-muted-foreground mt-4">
                    <summary className="cursor-pointer">Technical details</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-wrap break-all">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
