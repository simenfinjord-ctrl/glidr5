import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/spinner";
import { OfflineProvider } from "@/lib/offline-context";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import TestSkis from "@/pages/testskis";
import SeriesDetail from "@/pages/series-detail";
import Weather from "@/pages/weather";
import Tests from "@/pages/tests";
import NewTest from "@/pages/new-test";
import TestDetail from "@/pages/test-detail";
import EditTest from "@/pages/edit-test";
import Admin from "@/pages/admin";
import Analytics from "@/pages/analytics";
import Login from "@/pages/login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/testskis" component={TestSkis} />
      <Route path="/testskis/:id" component={SeriesDetail} />
      <Route path="/products" component={Products} />
      <Route path="/weather" component={Weather} />
      <Route path="/tests" component={Tests} />
      <Route path="/tests/new" component={NewTest} />
      <Route path="/tests/:id/edit" component={EditTest} />
      <Route path="/tests/:id" component={TestDetail} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user && location !== "/login") {
    return <Redirect to="/login" />;
  }

  if (user && location === "/login") {
    return <Redirect to="/dashboard" />;
  }

  return <Router />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineProvider>
        <TooltipProvider>
          <Toaster />
          <AuthGuard />
        </TooltipProvider>
      </OfflineProvider>
    </QueryClientProvider>
  );
}
