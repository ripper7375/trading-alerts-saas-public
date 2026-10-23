import { enUS, type EmailMessages } from './en-US';

/** British English: the American text, with British spelling where it differs. */
export const enGB: EmailMessages = {
  ...enUS,
  'common.questions':
    'If you have any questions, reply to this email or visit our help centre.',
  'welcome.step3': 'Customise your notification preferences',
  'affiliateWelcome.footer':
    'Payouts are sent via Wise once your balance crosses the monthly minimum. If you have any questions, reply to this email or visit our help centre.',
  'passwordChanged.tip2': 'Review your account for any unauthorised changes',
  'twoFactorDisabled.tip3': 'Review your account for unauthorised changes',
  'payoutDetails.tip3': 'Review your account for unauthorised changes',
};
