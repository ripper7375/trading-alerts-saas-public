import type { Symbol, Timeframe } from './tier';

/**
 * Alert type
 */
export interface Alert {
  id: string;
  userId: string;
  name: string | null;
  symbol: string;
  timeframe: string;
  condition: string;
  alertType: string;
  isActive: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert status
 */
export type AlertStatus = 'ACTIVE' | 'TRIGGERED' | 'EXPIRED' | 'DISABLED';

/**
 * Alert condition type
 */
export type AlertConditionType =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'PRICE_CROSS_ABOVE'
  | 'PRICE_CROSS_BELOW'
  | 'INDICATOR_SIGNAL';

/**
 * Create alert request
 */
export interface CreateAlertRequest {
  symbol: Symbol;
  timeframe: Timeframe;
  conditionType: AlertConditionType;
  targetValue: number;
  message?: string;
}

/**
 * Update alert request
 */
export interface UpdateAlertRequest {
  isActive?: boolean;
  targetValue?: number;
  message?: string;
}

/**
 * Alert with user data
 */
export interface AlertWithUser extends Alert {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Alert notification
 */
export interface AlertNotification {
  alertId: string;
  symbol: Symbol;
  timeframe: Timeframe;
  condition: string;
  currentPrice: number;
  targetPrice: number;
  triggeredAt: Date;
  message?: string;
}
