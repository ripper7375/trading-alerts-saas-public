import { expectType, expectError, expectAssignable } from 'tsd';
import type {
  Alert,
  AlertStatus,
  AlertConditionType,
  CreateAlertRequest,
  UpdateAlertRequest,
  AlertWithUser,
  AlertNotification,
} from '../../types/alert';
import type { Symbol, Timeframe } from '../../types/tier';

// Test AlertStatus union
const activeStatus: AlertStatus = 'ACTIVE';
const triggeredStatus: AlertStatus = 'TRIGGERED';
const expiredStatus: AlertStatus = 'EXPIRED';
const disabledStatus: AlertStatus = 'DISABLED';
expectType<AlertStatus>(activeStatus);
expectType<AlertStatus>(triggeredStatus);

// Test invalid AlertStatus
expectError<AlertStatus>('INVALID_STATUS');

// Test AlertConditionType union
const priceAbove: AlertConditionType = 'PRICE_ABOVE';
const priceBelow: AlertConditionType = 'PRICE_BELOW';
const crossAbove: AlertConditionType = 'PRICE_CROSS_ABOVE';
const crossBelow: AlertConditionType = 'PRICE_CROSS_BELOW';
const indicator: AlertConditionType = 'INDICATOR_SIGNAL';
expectType<AlertConditionType>(priceAbove);

// Test invalid AlertConditionType
expectError<AlertConditionType>('INVALID_CONDITION');

// Test Alert interface
const alert: Alert = {
  id: 'alert_123',
  userId: 'user_456',
  name: 'My Alert',
  symbol: 'EURUSD',
  timeframe: 'H1',
  condition: 'PRICE_ABOVE',
  alertType: 'email',
  isActive: true,
  lastTriggered: new Date(),
  triggerCount: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};
expectType<string>(alert.id);
expectType<string | null>(alert.name);
expectType<Date | null>(alert.lastTriggered);
expectType<boolean>(alert.isActive);

// Test CreateAlertRequest
const createRequest: CreateAlertRequest = {
  symbol: 'EURUSD' as Symbol,
  timeframe: 'H4' as Timeframe,
  conditionType: 'PRICE_CROSS_ABOVE',
  targetValue: 1.1,
  message: 'Price crossed above 1.1',
};
expectType<Symbol>(createRequest.symbol);
expectType<number>(createRequest.targetValue);
expectType<string | undefined>(createRequest.message);

// Test that CreateAlertRequest requires mandatory fields
expectError<CreateAlertRequest>({
  symbol: 'EURUSD' as Symbol,
  // Missing timeframe, conditionType, targetValue
});

// Test UpdateAlertRequest (all optional)
const updateRequest: UpdateAlertRequest = {
  isActive: false,
};
expectAssignable<UpdateAlertRequest>({});
expectAssignable<UpdateAlertRequest>({ isActive: true });
expectAssignable<UpdateAlertRequest>({ targetValue: 1.2 });
expectAssignable<UpdateAlertRequest>({ message: 'Updated' });

// Test AlertWithUser
const alertWithUser: AlertWithUser = {
  ...alert,
  user: {
    id: 'user_456',
    name: 'John Doe',
    email: 'john@example.com',
  },
};
expectType<{ id: string; name: string | null; email: string }>(
  alertWithUser.user
);

// Test AlertNotification
const notification: AlertNotification = {
  alertId: 'alert_123',
  symbol: 'GBPUSD' as Symbol,
  timeframe: 'M15' as Timeframe,
  condition: 'PRICE_ABOVE',
  currentPrice: 1.265,
  targetPrice: 1.26,
  triggeredAt: new Date(),
  message: 'Target reached',
};
expectType<string>(notification.alertId);
expectType<number>(notification.currentPrice);
expectType<Date>(notification.triggeredAt);
expectType<string | undefined>(notification.message);
