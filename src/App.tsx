import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Cellar from "./pages/Cellar";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import WineForm from "./pages/WineForm";
import WineDetail from "./pages/WineDetail";
import Recommend from "./pages/Recommend";
import Sommelier from "./pages/Sommelier";
import Share from "./pages/Share";
import PublicCellar from "./pages/PublicCellar";
import PublicWineDetail from "./pages/PublicWineDetail";
import Menus from "./pages/Menus";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Cellar />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/wine/new" element={<WineForm />} />
            <Route path="/wine/:id" element={<WineDetail />} />
            <Route path="/wine/:id/edit" element={<WineForm />} />
            <Route path="/recommend" element={<Recommend />} />
            <Route path="/sommelier" element={<Sommelier />} />
            <Route path="/menus" element={<Menus />} />
            <Route path="/share" element={<Share />} />
            <Route path="/keller/:token" element={<PublicCellar />} />
            <Route path="/keller/:token/wein/:id" element={<PublicWineDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
