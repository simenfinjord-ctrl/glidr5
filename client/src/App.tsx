import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/spinner";
import { OfflineProvider } from "@/lib/offline-context";
import { ThemeProvider } from "@/lib/theme";
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
import Profile from "@/pages/profile";
import Grinding from "@/pages/grinding";
import RaceSkis from "@/pages/race-skis";
import AthleteDetail from "@/pages/athlete-detail";
import Suggestions from "@/pages/suggestions";
import LiveRunsheets from "@/pages/live-runsheets";
import WhatIsGlidr from "@/pages/what-is-glidr";
import Legal from "@/pages/legal";

import Login from "@/pages/login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/live-runsheets" component={LiveRunsheets} />
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
      <Route path="/profile" component={Profile} />
      <Route path="/grinding" component={Grinding} />
      <Route path="/raceskis" component={RaceSkis} />
      <Route path="/raceskis/:id" component={AthleteDetail} />


      <Route path="/suggestions" component={Suggestions} />
      <Route path="/admin" component={Admin} />
      <Route path="/what-is-glidr" component={WhatIsGlidr} />
      <Route path="/legal" component={Legal} />
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

  const publicPaths = ["/login", "/what-is-glidr", "/legal"];
  if (!user && !publicPaths.includes(location)) {
    return <Redirect to="/login" />;
  }

  if (user && location === "/login") {
    return <Redirect to="/dashboard" />;
  }

  return <Router />;
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <OfflineProvider>
          <TooltipProvider>
            <Toaster />
            <AuthGuard />
          </TooltipProvider>
        </OfflineProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
