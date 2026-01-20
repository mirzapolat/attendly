import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ThemeColorProvider } from "@/hooks/useThemeColor";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Workspaces from "./pages/Workspaces";
import Seasons from "./pages/Seasons";
import Members from "./pages/Members";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import NewEvent from "./pages/NewEvent";
import EventDetail from "./pages/EventDetail";
import Attend from "./pages/Attend";
import Excuse from "./pages/Excuse";
import SeasonDetail from "./pages/SeasonDetail";
import Settings from "./pages/Settings";
import ModeratorView from "./pages/ModeratorView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkspaceProvider>
        <ThemeColorProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/workspaces" element={<Workspaces />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/seasons" element={<Seasons />} />
                <Route path="/members" element={<Members />} />
                <Route path="/workspace-settings" element={<WorkspaceSettings />} />
                <Route path="/events/new" element={<NewEvent />} />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route path="/attend/:id" element={<Attend />} />
                <Route path="/excuse/:eventId/:token" element={<Excuse />} />
                <Route path="/seasons/:id" element={<SeasonDetail />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/moderate/:eventId/:token" element={<ModeratorView />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeColorProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
