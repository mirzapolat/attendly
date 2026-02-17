import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ThemeColorProvider } from "@/hooks/useThemeColor";
import { ConfirmDialogProvider } from "@/hooks/useConfirm";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Lazy-loaded page components for route-level code splitting
const Index = lazy(() => import("./pages/Index"));
const Features = lazy(() => import("./pages/Features"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Seasons = lazy(() => import("./pages/Seasons"));
const Members = lazy(() => import("./pages/Members"));
const WorkspaceSettings = lazy(() => import("./pages/WorkspaceSettings"));
const NewEvent = lazy(() => import("./pages/NewEvent"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const Attend = lazy(() => import("./pages/Attend"));
const Excuse = lazy(() => import("./pages/Excuse"));
const SeasonDetail = lazy(() => import("./pages/SeasonDetail"));
const SeasonSanitize = lazy(() => import("./pages/SeasonSanitize"));
const Settings = lazy(() => import("./pages/Settings"));
const ModeratorView = lazy(() => import("./pages/ModeratorView"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Impressum = lazy(() => import("./pages/Impressum"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkspaceProvider>
        <ThemeColorProvider>
          <ConfirmDialogProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Analytics />
              <SpeedInsights />
              <BrowserRouter future={{ v7_startTransition: true }}>
                <Suspense fallback={<div className="min-h-screen" />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/features" element={<Features />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/workspaces" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/series" element={<Seasons />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/workspace-settings" element={<WorkspaceSettings />} />
                    <Route path="/events/new" element={<NewEvent />} />
                    <Route path="/events/:id" element={<EventDetail />} />
                    <Route path="/attend/:id" element={<Attend />} />
                    <Route path="/excuse/:eventId/:token" element={<Excuse />} />
                    <Route path="/series/:id" element={<SeasonDetail />}>
                      <Route path="sanitize" element={<SeasonSanitize />} />
                    </Route>
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/moderate/:eventId/:token" element={<ModeratorView />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/impressum" element={<Impressum />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </ConfirmDialogProvider>
        </ThemeColorProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
