import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { initCapacitor } from '@/lib/capacitor';

// Context Providers
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { MobileLayout } from '@/components/layouts/MobileLayout';

// Public Pages
import LandingPage from '@/pages/public/LandingPage';
import PricingPage from '@/pages/public/PricingPage';
import StatusPage from '@/pages/public/StatusPage';
import HelpPage from '@/pages/public/HelpPage';
import TermsPage from '@/pages/public/TermsPage';
import PrivacyPage from '@/pages/public/PrivacyPage';
import DisclaimerPage from '@/pages/public/DisclaimerPage';
import DeletionCancelPage from '@/pages/public/DeletionCancelPage';
import DeletionConfirmPage from '@/pages/public/DeletionConfirmPage';

// Auth Pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage';
import VerifyEmailPendingPage from '@/pages/auth/VerifyEmailPendingPage';
import Verify2FAPage from '@/pages/auth/Verify2FAPage';
import WelcomePage from '@/pages/auth/WelcomePage';

// Trading & Alerts Pages
import TerminalPage from '@/pages/terminal/TerminalPage';
import FreeTerminalPage from '@/pages/terminal/FreeTerminalPage';
import AlertsPage from '@/pages/alerts/AlertsPage';
import NewAlertPage from '@/pages/alerts/NewAlertPage';
import EditAlertPage from '@/pages/alerts/EditAlertPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import NotificationCenterPage from '@/pages/notifications/NotificationCenterPage';

// Checkout & Monetization Pages
import CheckoutPage from '@/pages/checkout/CheckoutPage';
import CheckoutReturnPage from '@/pages/checkout/CheckoutReturnPage';
import UpgradeSuccessPage from '@/pages/checkout/UpgradeSuccessPage';

// Settings Sub-Pages
import SettingsOverviewPage from '@/pages/settings/SettingsOverviewPage';
import ProfileSettingsPage from '@/pages/settings/ProfileSettingsPage';
import SecuritySettingsPage from '@/pages/settings/SecuritySettingsPage';
import SecurityActivityPage from '@/pages/settings/SecurityActivityPage';
import BillingSettingsPage from '@/pages/settings/BillingSettingsPage';
import AppearanceSettingsPage from '@/pages/settings/AppearanceSettingsPage';
import LanguageSettingsPage from '@/pages/settings/LanguageSettingsPage';
import PrivacySettingsPage from '@/pages/settings/PrivacySettingsPage';
import AccountSettingsPage from '@/pages/settings/AccountSettingsPage';
import HelpSettingsPage from '@/pages/settings/HelpSettingsPage';
import TermsSettingsPage from '@/pages/settings/TermsSettingsPage';

// Affiliate Portal Pages
import AffiliateLandingPage from '@/pages/affiliate/AffiliateLandingPage';
import AffiliateJoinPage from '@/pages/affiliate/AffiliateJoinPage';
import AffiliateRegisterPage from '@/pages/affiliate/AffiliateRegisterPage';
import AffiliateDashboardPage from '@/pages/affiliate/AffiliateDashboardPage';
import AffiliateCodesPage from '@/pages/affiliate/AffiliateCodesPage';
import AffiliateCodeInventoryPage from '@/pages/affiliate/AffiliateCodeInventoryPage';
import AffiliateCommissionsPage from '@/pages/affiliate/AffiliateCommissionsPage';
import AffiliatePayoutsPage from '@/pages/affiliate/AffiliatePayoutsPage';
import AffiliateStatementsPage from '@/pages/affiliate/AffiliateStatementsPage';
import AffiliateProfilePage from '@/pages/affiliate/AffiliateProfilePage';
import AffiliatePaymentSetupPage from '@/pages/affiliate/AffiliatePaymentSetupPage';
import AffiliateResourcesPage from '@/pages/affiliate/AffiliateResourcesPage';
import AffiliatePayoutSettingsPage from '@/pages/affiliate/AffiliatePayoutSettingsPage';

// 404
import NotFoundPage from '@/pages/NotFoundPage';

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    initCapacitor();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AuthProvider>
          <NotificationProvider>
            <SubscriptionProvider>
              <TooltipProvider>
                <BrowserRouter>
                  <Routes>
                    <Route element={<MobileLayout />}>
                      {/* Public & Marketing */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/pricing" element={<PricingPage />} />
                      <Route path="/status" element={<StatusPage />} />
                      <Route path="/help" element={<HelpPage />} />
                      <Route path="/terms" element={<TermsPage />} />
                      <Route path="/privacy" element={<PrivacyPage />} />
                      <Route path="/disclaimer" element={<DisclaimerPage />} />
                      <Route
                        path="/account/deletion-cancel"
                        element={<DeletionCancelPage />}
                      />
                      <Route
                        path="/account/deletion-confirm"
                        element={<DeletionConfirmPage />}
                      />

                      {/* Auth & Onboarding */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route
                        path="/forgot-password"
                        element={<ForgotPasswordPage />}
                      />
                      <Route
                        path="/reset-password"
                        element={<ResetPasswordPage />}
                      />
                      <Route
                        path="/verify-email"
                        element={<VerifyEmailPage />}
                      />
                      <Route
                        path="/verify-email/pending"
                        element={<VerifyEmailPendingPage />}
                      />
                      <Route path="/verify-2fa" element={<Verify2FAPage />} />
                      <Route path="/welcome" element={<WelcomePage />} />

                      {/* Trading & Alerts */}
                      <Route path="/terminal" element={<TerminalPage />} />
                      <Route path="/free" element={<FreeTerminalPage />} />
                      <Route path="/alerts" element={<AlertsPage />} />
                      <Route path="/alerts/new" element={<NewAlertPage />} />
                      <Route
                        path="/alerts/:id/edit"
                        element={<EditAlertPage />}
                      />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route
                        path="/notifications"
                        element={<NotificationCenterPage />}
                      />

                      {/* Checkout & Monetization */}
                      <Route path="/checkout" element={<CheckoutPage />} />
                      <Route
                        path="/checkout/return"
                        element={<CheckoutReturnPage />}
                      />
                      <Route
                        path="/upgrade/success"
                        element={<UpgradeSuccessPage />}
                      />

                      {/* Settings */}
                      <Route
                        path="/settings"
                        element={<SettingsOverviewPage />}
                      />
                      <Route
                        path="/settings/profile"
                        element={<ProfileSettingsPage />}
                      />
                      <Route
                        path="/settings/security"
                        element={<SecuritySettingsPage />}
                      />
                      <Route
                        path="/settings/security/activity"
                        element={<SecurityActivityPage />}
                      />
                      <Route
                        path="/settings/billing"
                        element={<BillingSettingsPage />}
                      />
                      <Route
                        path="/settings/appearance"
                        element={<AppearanceSettingsPage />}
                      />
                      <Route
                        path="/settings/language"
                        element={<LanguageSettingsPage />}
                      />
                      <Route
                        path="/settings/privacy"
                        element={<PrivacySettingsPage />}
                      />
                      <Route
                        path="/settings/account"
                        element={<AccountSettingsPage />}
                      />
                      <Route
                        path="/settings/help"
                        element={<HelpSettingsPage />}
                      />
                      <Route
                        path="/settings/terms"
                        element={<TermsSettingsPage />}
                      />

                      {/* Affiliate Portal */}
                      <Route
                        path="/affiliate"
                        element={<AffiliateLandingPage />}
                      />
                      <Route
                        path="/affiliate/join"
                        element={<AffiliateJoinPage />}
                      />
                      <Route
                        path="/affiliate/register"
                        element={<AffiliateRegisterPage />}
                      />
                      <Route
                        path="/affiliate/dashboard"
                        element={<AffiliateDashboardPage />}
                      />
                      <Route
                        path="/affiliate/dashboard/codes"
                        element={<AffiliateCodesPage />}
                      />
                      <Route
                        path="/affiliate/dashboard/code-inventory"
                        element={<AffiliateCodeInventoryPage />}
                      />
                      <Route
                        path="/affiliate/dashboard/commissions"
                        element={<AffiliateCommissionsPage />}
                      />
                      <Route
                        path="/affiliate/dashboard/payouts"
                        element={<AffiliatePayoutsPage />}
                      />
                      <Route
                        path="/affiliate/dashboard/statements"
                        element={<AffiliateStatementsPage />}
                      />
                      <Route
                        path="/affiliate/dashboard/profile"
                        element={<AffiliateProfilePage />}
                      />
                      <Route
                        path="/affiliate/dashboard/profile/payment"
                        element={<AffiliatePaymentSetupPage />}
                      />
                      <Route
                        path="/affiliate/resources"
                        element={<AffiliateResourcesPage />}
                      />
                      <Route
                        path="/affiliate/settings/payout"
                        element={<AffiliatePayoutSettingsPage />}
                      />

                      {/* 404 Fallback */}
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
                <SonnerToaster />
                <Toaster />
              </TooltipProvider>
            </SubscriptionProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
