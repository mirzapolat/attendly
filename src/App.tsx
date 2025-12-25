import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeColorProvider } from "@/hooks/useThemeColor";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewEvent from "./pages/NewEvent";
import EventDetail from "./pages/EventDetail";
import Attend from "./pages/Attend";
import Seasons from "./pages/Seasons";
import SeasonDetail from "./pages/SeasonDetail";
import Settings from "./pages/Settings";
import ModeratorView from "./pages/ModeratorView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeColorProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/events/new" element={<NewEvent />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/attend/:id" element={<Attend />} />
              <Route path="/seasons" element={<Seasons />} />
              <Route path="/seasons/:id" element={<SeasonDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/moderate/:eventId/:token" element={<ModeratorView />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeColorProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
