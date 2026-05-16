import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/spinner";
import { OfflineProvider } from "@/lib/offline-context";
import { ThemeProvider } from "@/lib/theme";
import { LanguageProvider } from "@/lib/language";
import { I18nProvider } from "@/lib/i18n";
import { useState, useEffect } from "react";
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
import WatchQueue from "@/pages/watch-queue";
import MyAccount from "@/pages/my-account";
import Overview from "@/pages/overview";
import WhatIsGlidr from "@/pages/what-is-glidr";
import Legal from "@/pages/legal";
import Pricing from "@/pages/pricing";
import Contact from "@/pages/contact";
import Inbox from "@/pages/inbox";
import Demo from "@/pages/demo";
import GetStarted from "@/pages/get-started";
import OnboardingWizard from "@/components/onboarding-wizard";

import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
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
      <Route path="/profile" component={() => <Redirect to="/my-account" />} />
      <Route path="/grinding" component={Grinding} />
      <Route path="/raceskis" component={RaceSkis} />
      <Route path="/raceskis/:id" component={AthleteDetail} />


      <Route path="/watch-queue" component={WatchQueue} />
      <Route path="/my-account" component={MyAccount} />
      <Route path="/suggestions" component={Suggestions} />
      <Route path="/admin" component={Admin} />
      <Route path="/overview" component={Overview} />
      <Route path="/what-is-glidr" component={WhatIsGlidr} />
      <Route path="/legal" component={Legal} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/contact" component={Contact} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/demo" component={Demo} />
      <Route path="/get-started" component={GetStarted} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGuard() {
  const { user, isLoading, isSuperAdmin, isStealthActive, userTeams, userTeamsLoading } = useAuth();
  const [location] = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Show onboarding wizard for users who haven't completed it yet
    const u = user as any;
    if (!u.onboardingCompleted && !u.isAdmin && !u.isTeamAdmin) {
      // Small delay so the app renders first
      const t = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  const adminMode = isSuperAdmin && (() => { try { return localStorage.getItem("glidr-sa-admin-mode") === "true"; } catch { return false; } })();

  const { data: maintenanceData } = useQuery<{ enabled: boolean; reopenAt?: string | null }>({
    queryKey: ["/api/admin/maintenance-mode"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Maintenance mode: block all non-SA users (authenticated or not)
  if (maintenanceData?.enabled && !isSuperAdmin) {
    const reopenAt = maintenanceData.reopenAt;
    const reopenStr = reopenAt
      ? `The system will reopen at ${new Date(reopenAt).toLocaleString("no-NO", { dateStyle: "short", timeStyle: "short" })}.`
      : "The system will be back shortly.";
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-5xl mb-2">🔧</div>
        <h1 className="text-2xl font-bold text-foreground">Under vedlikehold</h1>
        <p className="text-muted-foreground max-w-sm leading-relaxed">
          Det foregår for øyeblikket vedlikehold på Glidr. {reopenStr} Ved spørsmål eller akutte behov, ta kontakt med teamadminen din.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-4">If you need immediate access, contact your administrator.</p>
      </div>
    );
  }

  const publicPaths = ["/login", "/forgot-password", "/reset-password", "/what-is-glidr", "/legal", "/pricing", "/contact", "/demo", "/get-started"];
  if (!user && !publicPaths.includes(location)) {
    return <Redirect to="/login" />;
  }

  if (user && location === "/login") {
    return <Redirect to="/dashboard" />;
  }

  if (isSuperAdmin && adminMode && location === "/") {
    return <Redirect to="/overview" />;
  }

  if (isSuperAdmin && !isStealthActive && !userTeamsLoading) {
    const activeTeamId = user?.activeTeamId || user?.teamId;
    // Own team = primary team OR any team the SA is explicitly a member of
    const isViewingOwnTeam = userTeams.some(t => t.id === activeTeamId);
    if (!isViewingOwnTeam) {
      const dataPages = ["/tests", "/testskis", "/products", "/weather", "/analytics", "/grinding", "/raceskis", "/suggestions", "/live-runsheets", "/dashboard"];
      const isDataPage = dataPages.some(p => location === p || location.startsWith(p + "/"));
      if (isDataPage) {
        return <Redirect to="/admin" />;
      }
    }
  }

  return (
    <>
      <Router />
      {showOnboarding && <OnboardingWizard onClose={() => setShowOnboarding(false)} />}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <I18nProvider>
          <QueryClientProvider client={queryClient}>
            <OfflineProvider>
              <TooltipProvider>
                <Toaster />
                <AuthGuard />
              </TooltipProvider>
            </OfflineProvider>
          </QueryClientProvider>
        </I18nProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
