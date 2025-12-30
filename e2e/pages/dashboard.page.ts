/**
 * Dashboard Page Object
 *
 * Encapsulates all interactions with the main dashboard for E2E tests.
 *
 * @module e2e/pages/dashboard.page
 */

import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  // Header elements
  readonly userMenu: Locator;
  readonly notificationBell: Locator;
  readonly unreadBadge: Locator;
  readonly upgradeButton: Locator;
  readonly tierBadge: Locator;

  // Navigation
  readonly alertsTab: Locator;
  readonly chartsTab: Locator;
  readonly watchlistTab: Locator;
  readonly settingsTab: Locator;

  // Quick stats
  readonly alertCount: Locator;
  readonly watchlistCount: Locator;

  // User menu items
  readonly logoutButton: Locator;
  readonly profileLink: Locator;
  readonly settingsLink: Locator;

  // Notification dropdown
  readonly notificationDropdown: Locator;
  readonly notificationList: Locator;
  readonly markAllReadButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header elements
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.notificationBell = page.locator('[data-testid="notification-bell"]');
    this.unreadBadge = page.locator('[data-testid="unread-badge"]');
    this.upgradeButton = page.locator('[data-testid="upgrade-button"]');
    this.tierBadge = page.locator('[data-testid="tier-badge"]');

    // Navigation
    this.alertsTab = page.locator('[data-testid="nav-alerts"]');
    this.chartsTab = page.locator('[data-testid="nav-charts"]');
    this.watchlistTab = page.locator('[data-testid="nav-watchlist"]');
    this.settingsTab = page.locator('[data-testid="nav-settings"]');

    // Quick stats
    this.alertCount = page.locator('[data-testid="alert-count"]');
    this.watchlistCount = page.locator('[data-testid="watchlist-count"]');

    // User menu items
    this.logoutButton = page.locator('[data-testid="logout-button"]');
    this.profileLink = page.locator('[data-testid="profile-link"]');
    this.settingsLink = page.locator('[data-testid="settings-link"]');

    // Notification dropdown
    this.notificationDropdown = page.locator(
      '[data-testid="notification-dropdown"]'
    );
    this.notificationList = page.locator('[data-testid="notification-list"]');
    this.markAllReadButton = page.locator(
      '[data-testid="mark-all-read-button"]'
    );
  }

  /**
   * Navigate to dashboard
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    // Wait for user-specific content to load
    await this.userMenu.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get current user tier
   */
  async getTier(): Promise<string> {
    return (await this.tierBadge.textContent()) || 'FREE';
  }

  /**
   * Check if user is PRO
   */
  async isPro(): Promise<boolean> {
    const tier = await this.getTier();
    return tier.includes('PRO');
  }

  /**
   * Click upgrade button
   */
  async clickUpgrade(): Promise<void> {
    await this.upgradeButton.click();
    await this.page.waitForURL('**/pricing');
  }

  /**
   * Navigate to alerts page
   */
  async goToAlerts(): Promise<void> {
    await this.alertsTab.click();
    await this.page.waitForURL('**/alerts');
  }

  /**
   * Navigate to charts page
   */
  async goToCharts(): Promise<void> {
    await this.chartsTab.click();
    await this.page.waitForURL('**/charts');
  }

  /**
   * Navigate to watchlist page
   */
  async goToWatchlist(): Promise<void> {
    await this.watchlistTab.click();
    await this.page.waitForURL('**/watchlist');
  }

  /**
   * Navigate to settings page
   */
  async goToSettings(): Promise<void> {
    await this.settingsTab.click();
    await this.page.waitForURL('**/settings');
  }

  /**
   * Open user menu
   */
  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
    await this.logoutButton.waitFor({ state: 'visible' });
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.logoutButton.click();
    await this.page.waitForURL('**/login');
  }

  /**
   * Open notifications dropdown
   */
  async openNotifications(): Promise<void> {
    await this.notificationBell.click();
    await this.notificationDropdown.waitFor({ state: 'visible' });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    if (await this.unreadBadge.isVisible()) {
      const text = await this.unreadBadge.textContent();
      return parseInt(text || '0', 10);
    }
    return 0;
  }

  /**
   * Get all notification items
   */
  async getNotifications(): Promise<Locator[]> {
    await this.openNotifications();
    return await this.notificationList.locator('> *').all();
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(): Promise<void> {
    await this.openNotifications();
    await this.markAllReadButton.click();
  }

  /**
   * Get alert count
   */
  async getAlertCount(): Promise<number> {
    const text = await this.alertCount.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Get watchlist item count
   */
  async getWatchlistCount(): Promise<number> {
    const text = await this.watchlistCount.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Check if upgrade button is visible
   */
  async isUpgradeButtonVisible(): Promise<boolean> {
    return await this.upgradeButton.isVisible();
  }
}
