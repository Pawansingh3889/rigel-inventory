import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/contexts/CompanyContext";
import Dashboard from "@/components/Dashboard";
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import EnhancedAuth from "@/pages/EnhancedAuth";
import Subscribe from "@/pages/Subscribe";
import BusinessRegistration from "@/pages/BusinessRegistration";
import Checkout from "@/pages/Checkout";
import GatedBusinessRegistration from "@/pages/GatedBusinessRegistration";
import GatedSignin from "@/pages/GatedSignin";
import GatedForgotPassword from "@/pages/GatedForgotPassword";
import GatedResetPassword from "@/pages/GatedResetPassword";
import Signin from "@/pages/Signin";
import UserManagement from "@/pages/UserManagement";
import EmailVerification from "@/pages/EmailVerification";
import PasswordReset from "@/pages/PasswordReset";
import EmailConfirmation from "@/pages/EmailConfirmation";
import NotFound from "./pages/NotFound";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <AuthProvider>
        <CompanyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/auth" element={<EnhancedAuth />} />
                <Route path="/subscribe/:planType" element={<Subscribe />} />
                <Route path="/business-registration" element={<BusinessRegistration />} />
                <Route path="/user-management" element={<UserManagement />} />
                <Route path="/email-verification" element={<EmailVerification />} />
                <Route path="/password-reset" element={<PasswordReset />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/register/business" element={<GatedBusinessRegistration />} />
            <Route path="/confirm-email" element={<EmailConfirmation />} />
            <Route path="/signin" element={<Signin />} />
            <Route path="/gated-signin" element={<GatedSignin />} />
            <Route path="/forgot-password" element={<GatedForgotPassword />} />
            <Route path="/gated-forgot-password" element={<GatedForgotPassword />} />
            <Route path="/reset-password" element={<GatedResetPassword />} />
            <Route path="/gated-reset-password" element={<GatedResetPassword />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CompanyProvider>
      </AuthProvider>
    </ErrorBoundary>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
