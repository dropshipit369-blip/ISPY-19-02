import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SupabaseHealthGate } from "@/components/SupabaseHealthGate";

// Lazy load pages for better performance
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Scan = lazy(() => import("./pages/Scan"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Listings = lazy(() => import("./pages/Listings"));
const Membership = lazy(() => import("./pages/Membership"));
const DebugAuth = lazy(() => import("./pages/DebugAuth"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Configure React Query with better defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

// Branded loading component for Suspense fallback
const LoadingSpinner = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
    <div className="relative">
      {/* Outer ring */}
      <div className="w-16 h-16 rounded-full border-2 border-primary/20" />
      {/* Spinning arc */}
      <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      {/* Center glow dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-primary animate-pulse" style={{ boxShadow: "0 0 10px hsl(187 85% 53% / 0.5)" }} />
      </div>
    </div>
    <span className="text-sm text-muted-foreground font-medium tracking-wide animate-pulse">Loading...</span>
  </div>
);

// Error boundary component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive mb-4">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">Please refresh the page or try again later.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Memoized route components for better performance
const ProtectedRoute = React.memo<{ children: React.ReactNode }>(({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
});

ProtectedRoute.displayName = "ProtectedRoute";

const PublicRoute = React.memo<{ children: React.ReactNode }>(({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
});

PublicRoute.displayName = "PublicRoute";

const AppRoutes = React.memo(() => (
  <Routes>
    <Route
      path="/"
      element={
        <Suspense fallback={<LoadingSpinner />}>
          <Landing />
        </Suspense>
      }
    />
    <Route
      path="/login"
      element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <Login />
          </Suspense>
        </PublicRoute>
      }
    />
    <Route
      path="/signup"
      element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <Signup />
          </Suspense>
        </PublicRoute>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <Dashboard />
          </Suspense>
        </ProtectedRoute>
      }
    />
    <Route
      path="/scan"
      element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <Scan />
          </Suspense>
        </ProtectedRoute>
      }
    />
    <Route
      path="/inventory"
      element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <Inventory />
          </Suspense>
        </ProtectedRoute>
      }
    />
    <Route
      path="/listings"
      element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <Listings />
          </Suspense>
        </ProtectedRoute>
      }
    />
    <Route
      path="/membership"
      element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <Membership />
          </Suspense>
        </ProtectedRoute>
      }
    />
    <Route
      path="/debug-auth"
      element={
        <Suspense fallback={<LoadingSpinner />}>
          <DebugAuth />
        </Suspense>
      }
    />
    <Route
      path="*"
      element={
        <Suspense fallback={<LoadingSpinner />}>
          <NotFound />
        </Suspense>
      }
    />
  </Routes>
));

AppRoutes.displayName = "AppRoutes";

const App = React.memo(() => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SupabaseHealthGate>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </SupabaseHealthGate>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
));

App.displayName = "App";

export default App;
