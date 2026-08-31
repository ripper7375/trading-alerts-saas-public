import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { MobileLayout } from '@/components/layouts/MobileLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { useAppearanceSettings } from '@/hooks/useAppearanceSettings';
import { useLocaleSettings } from '@/hooks/useLocaleSettings';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Mobile Pages
import Dashboard from '@/pages/mobile/Dashboard';
import Watchlist from '@/pages/mobile/Watchlist';
import Alerts from '@/pages/mobile/Alerts';
import Charts from '@/pages/mobile/Charts';
import Settings from '@/pages/mobile/Settings';
import Auth from '@/pages/mobile/Auth';
import NotificationCenter from '@/pages/mobile/NotificationCenter';
import PaymentSuccess from '@/pages/mobile/PaymentSuccess';
import NotFound from './pages/NotFound';
import OAuthConsent from '@/pages/OAuthConsent';

// Settings Sub-pages
import Profile from '@/pages/mobile/settings/Profile';
import Security from '@/pages/mobile/settings/Security';
import Notifications from '@/pages/mobile/settings/Notifications';
import Appearance from '@/pages/mobile/settings/Appearance';
import AdminPortal from '@/pages/mobile/settings/AdminPortal';
import HelpSupport from '@/pages/mobile/settings/HelpSupport';
import AboutLegal from '@/pages/mobile/settings/AboutLegal';
import Subscription from '@/pages/mobile/settings/Subscription';
import Language from '@/pages/mobile/settings/Language';
import Affiliate from '@/pages/mobile/settings/Affiliate';
import AffiliateLeaderboard from '@/pages/AffiliateLeaderboard';
import Academy from '@/pages/Academy';
import AcademyDetail from '@/pages/AcademyDetail';

const queryClient = new QueryClient();

// Component to apply global appearance settings
const AppearanceProvider = ({ children }: { children: React.ReactNode }) => {
  useAppearanceSettings();
  // Stamps document dir="rtl" app-wide for Arabic, not just while the
  // Language settings screen is mounted (mirrors locale-context.tsx).
  useLocaleSettings();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppearanceProvider>
        <AuthProvider>
          <NotificationProvider>
            <SubscriptionProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    {/* Auth Routes */}
                    <Route element={<MobileLayout />}>
                      <Route path="/auth" element={<Auth />} />
                    </Route>

                    {/* OAuth consent (MCP clients) */}
                    <Route
                      path="/.lovable/oauth/consent"
                      element={<OAuthConsent />}
                    />

                    {/* Public affiliate leaderboard — reachable without login,
                        mirrors the web marketing page at /affiliate/leaderboard */}
                    <Route
                      path="/affiliate/leaderboard"
                      element={<AffiliateLeaderboard />}
                    />

                    {/* DavinTrade Academy — public tutorial library, reachable
                        without login, mirrors the (marketing)/academy pages */}
                    <Route path="/academy" element={<Academy />} />
                    <Route path="/academy/:id" element={<AcademyDetail />} />

                    {/* Protected Mobile App Routes */}
                    <Route element={<MobileLayout />}>
                      <Route
                        path="/"
                        element={<Navigate to="/dashboard" replace />}
                      />
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/watchlist"
                        element={
                          <ProtectedRoute>
                            <Watchlist />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/alerts"
                        element={
                          <ProtectedRoute>
                            <Alerts />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/charts"
                        element={
                          <ProtectedRoute>
                            <Charts />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/notifications"
                        element={
                          <ProtectedRoute>
                            <NotificationCenter />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute>
                            <Settings />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/profile"
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/security"
                        element={
                          <ProtectedRoute>
                            <Security />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/notifications"
                        element={
                          <ProtectedRoute>
                            <Notifications />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/appearance"
                        element={
                          <ProtectedRoute>
                            <Appearance />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/admin"
                        element={
                          <ProtectedRoute>
                            <AdminPortal />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/help"
                        element={
                          <ProtectedRoute>
                            <HelpSupport />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/about"
                        element={
                          <ProtectedRoute>
                            <AboutLegal />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/subscription"
                        element={
                          <ProtectedRoute>
                            <Subscription />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/language"
                        element={
                          <ProtectedRoute>
                            <Language />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/affiliate"
                        element={
                          <ProtectedRoute>
                            <Affiliate />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/payment-success"
                        element={
                          <ProtectedRoute>
                            <PaymentSuccess />
                          </ProtectedRoute>
                        }
                      />
                    </Route>

                    {/* Catch-all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </SubscriptionProvider>
          </NotificationProvider>
        </AuthProvider>
      </AppearanceProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
