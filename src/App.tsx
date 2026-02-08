import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import SearchPage from "./pages/SearchPage";
import SavedLeadsPage from "./pages/SavedLeadsPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PlansPage from "./pages/PlansPage";
import UsersPage from "./pages/UsersPage";
import PricingPage from "./pages/PricingPage";
import SerpKeysPage from "./pages/SerpKeysPage";
import ApifyKeysPage from "./pages/ApifyKeysPage";
import FirecrawlKeysPage from "./pages/FirecrawlKeysPage";
import UserSettingsPage from "./pages/UserSettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrandProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Auth pages - sem layout */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* App pages - protegidas e com layout */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/leads" element={<SavedLeadsPage />} />
                  <Route path="/settings" element={<UserSettingsPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/plans" element={<PlansPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/serp-keys" element={<SerpKeysPage />} />
                  <Route path="/admin/apify-keys" element={<ApifyKeysPage />} />
                  <Route path="/admin/firecrawl-keys" element={<FirecrawlKeysPage />} />
                </Route>
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BrandProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
