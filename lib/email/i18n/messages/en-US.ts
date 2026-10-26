/**
 * The English source of every e-mail text. All 19 locales are typed against
 * this object (`EmailMessages`), so a key missing from any of them fails
 * `tsc`. Text only: no HTML. Markup is limited to `**bold**` and `{placeholder}`;
 * the renderer escapes both the placeholders and the text itself.
 *
 * "Trading Alerts" is the brand and stays as it is in every language.
 */
export const enUS = {
  // ── Shared ────────────────────────────────────────────────────────────────
  'common.greeting': 'Hi {name},',
  'common.userFallback': 'User',
  'common.questions':
    'If you have any questions, reply to this email or visit our help center.',
  'common.signature': 'The {app} Team',
  'common.needHelpContact': 'Need help? Contact us at {email}',
  'common.needHelpReply':
    'Need help? Reply to this email or contact us at {email}',
  'common.securityAlertsNote':
    "You're receiving this email because you have security alerts enabled.",
  'common.manageNotifications': 'Manage notification preferences',

  'label.time': 'Time:',
  'label.location': 'Location:',
  'label.ipAddress': 'IP Address:',
  'label.device': 'Device:',
  'label.browser': 'Browser:',
  'label.os': 'Operating System:',

  'value.unknown': 'Unknown',
  'value.unknownLocation': 'Unknown location',
  'value.device.desktop': 'Desktop',
  'value.device.mobile': 'Mobile',
  'value.device.tablet': 'Tablet',

  'billing.perMonth': '{price}/month',
  'billing.perYear': '{price}/year',
  'billing.perThreeDays': '{price}/3 days',

  'security.changePassword': 'Change your password immediately',
  'security.secureButton': 'Secure My Account',

  'freeTier.xauusd': 'XAUUSD (Gold) on M5 and M15',
  'freeTier.marketData': 'Full market data and indicator overlays',
  'freeTier.noAlerts': 'No price alerts (PRO feature)',

  // ── Welcome (sent once the address is verified) ───────────────────────────
  'welcome.title': 'Welcome to Trading Alerts',
  'welcome.heading': 'Welcome to Trading Alerts, {name}!',
  'welcome.body':
    "Your account has been created successfully. You're now ready to set up your first trading alert!",
  'welcome.getStarted': 'Get Started:',
  'welcome.step1': 'Open the XAUUSD chart on M5 or M15',
  'welcome.step2': 'Explore channel and structure overlays',
  'welcome.step3': 'Customize your notification preferences',
  'welcome.button': 'Go to Dashboard',
  'welcome.subject': 'Welcome to Trading Alerts!',

  // ── Affiliate welcome ─────────────────────────────────────────────────────
  'affiliateWelcome.title': 'Welcome to the Affiliate Program',
  'affiliateWelcome.heading': "You're an Affiliate Partner, {name}!",
  'affiliateWelcome.body':
    "Your affiliate account is active. We've generated your first {count} referral codes — they're ready in your dashboard now.",
  'affiliateWelcome.button': 'Go to Affiliate Dashboard',
  'affiliateWelcome.footer':
    'Payouts are sent via Wise once your balance crosses the monthly minimum. If you have any questions, reply to this email or visit our help center.',
  'affiliateWelcome.subject': "You're an Affiliate Partner - Trading Alerts",

  // ── Verify e-mail address ─────────────────────────────────────────────────
  'verify.heading': 'Verify Your Email Address',
  'verify.body':
    'Hi {name}, please click the button below to verify your email address and activate your account.',
  'verify.button': 'Verify Email Address',
  'verify.ignore':
    "If you didn't create an account with Trading Alerts, you can safely ignore this email.",
  'verify.expiry': 'This link will expire in 24 hours.',
  'verify.subject': 'Verify Your Email - Trading Alerts',

  // ── Reset password ────────────────────────────────────────────────────────
  'reset.heading': 'Reset Your Password',
  'reset.body':
    'Hi {name}, we received a request to reset your password. Click the button below to create a new password.',
  'reset.button': 'Reset Password',
  'reset.ignore':
    "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
  'reset.expiry': 'This link will expire in 1 hour.',
  'reset.subject': 'Reset Your Password - Trading Alerts',

  // ── New device sign-in ────────────────────────────────────────────────────
  'newDevice.heading': 'New Device Login Detected',
  'newDevice.body':
    'Hi {name}, we noticed a login to your Trading Alerts account from a new device:',
  'newDevice.ifYou':
    '**If this was you:** No action is needed. You can safely ignore this email.',
  'newDevice.ifNotYou':
    "**If this wasn't you:** Someone may have access to your account. We recommend:",
  'newDevice.tip2': 'Review your active sessions and sign out unknown devices',
  'newDevice.tip3': 'Enable two-factor authentication for added security',
  'newDevice.subject': 'Security Alert: New Device Login Detected',

  // ── Password changed ──────────────────────────────────────────────────────
  'passwordChanged.heading': 'Password Changed Successfully',
  'passwordChanged.body':
    'Hi {name}, your Trading Alerts account password was changed.',
  'passwordChanged.ifYou':
    '**If you made this change:** No action is needed. Your account is secure.',
  'passwordChanged.ifNotYou':
    "**If you didn't make this change:** Your account may be compromised. Please:",
  'passwordChanged.tip1':
    'Reset your password immediately using the "Forgot Password" feature',
  'passwordChanged.tip2': 'Review your account for any unauthorized changes',
  'passwordChanged.tip3': 'Contact our support team if you need assistance',
  'passwordChanged.subject': 'Security Alert: Password Changed',

  // ── Two-factor authentication enabled ─────────────────────────────────────
  'twoFactorEnabled.heading': 'Two-Factor Authentication Enabled',
  'twoFactorEnabled.body':
    'Hi {name}, two-factor authentication has been successfully enabled on your Trading Alerts account.',
  'twoFactorEnabled.remindersHeading': 'Important Reminders:',
  'twoFactorEnabled.reminder1': 'Keep your backup codes in a safe place',
  'twoFactorEnabled.reminder2': "You'll need your authenticator app to sign in",
  'twoFactorEnabled.reminder3':
    'If you lose access to your authenticator, use a backup code',
  'twoFactorEnabled.ifNotYou':
    "**If you didn't enable 2FA:** Your account may be compromised. Please contact support immediately.",
  'twoFactorEnabled.button': 'Manage Security Settings',
  'twoFactorEnabled.subject':
    'Security Alert: Two-Factor Authentication Enabled',

  // ── Two-factor authentication disabled ────────────────────────────────────
  'twoFactorDisabled.heading': 'Two-Factor Authentication Disabled',
  'twoFactorDisabled.body':
    'Hi {name}, two-factor authentication has been disabled on your Trading Alerts account.',
  'twoFactorDisabled.warning':
    'Your account is now less secure without two-factor authentication.',
  'twoFactorDisabled.ifYou':
    '**If you disabled 2FA:** We recommend re-enabling it for maximum security.',
  'twoFactorDisabled.ifNotYou':
    "**If you didn't disable 2FA:** Your account may be compromised. Please:",
  'twoFactorDisabled.tip2': 'Re-enable two-factor authentication',
  'twoFactorDisabled.tip3': 'Review your account for unauthorized changes',
  'twoFactorDisabled.subject':
    'Security Alert: Two-Factor Authentication Disabled',

  // ── Payout details added or changed (affiliate payouts) ──────────────────
  'payoutDetails.heading': 'Payout Details Changed',
  'payoutDetails.body':
    'Hi {name}, payout details were added or changed on your Trading Alerts affiliate account.',
  'payoutDetails.holdLabel': 'Payouts on hold until:',
  'payoutDetails.hold':
    'For your protection, payouts to these details are on hold for {hours} hours. Your earnings are safe and will be paid once the hold ends.',
  'payoutDetails.ifYou': '**If you made this change:** no action is needed.',
  'payoutDetails.ifNotYou':
    "**If you didn't make this change:** your account may be compromised. Please:",
  'payoutDetails.tip2': 'Contact our support team before the hold ends',
  'payoutDetails.tip3': 'Review your account for unauthorized changes',
  'payoutDetails.subject': 'Security Alert: Your Payout Details Were Changed',

  // ── Account deletion (confirm or cancel) ──────────────────────────────────
  'accountDeletion.heading': 'Confirm Your Account Deletion',
  'accountDeletion.body':
    'Hi {name}, we received a request to permanently delete your Trading Alerts account.',
  'accountDeletion.confirmIntro':
    '**To go ahead,** confirm the deletion with the button below. This cannot be undone.',
  'accountDeletion.confirmButton': 'Confirm Account Deletion',
  'accountDeletion.cancelIntro':
    "**If you changed your mind, or this wasn't you,** cancel the request instead:",
  'accountDeletion.cancelButton': 'Cancel Deletion Request',
  'accountDeletion.expiry':
    'These links expire on {date}. Anyone with these links can act on your request, so please do not forward this email.',
  'accountDeletion.subject': 'Confirm Your Account Deletion - Trading Alerts',

  // ── Subscription confirmed ────────────────────────────────────────────────
  'subscription.heading': 'Subscription Confirmed!',
  'subscription.body': 'Hi {name}, your **{plan}** subscription is now active.',
  'subscription.planDetails': 'Plan Details',
  'subscription.tier': 'Tier:',
  'subscription.billing': 'Billing:',
  'subscription.trial':
    '7-Day Free Trial: Your card will not be charged until your trial ends.',
  'subscription.proHeading': 'What You Get with Pro:',
  'subscription.pro1':
    '**100 Price Alerts** - Never miss a trading opportunity',
  'subscription.pro2':
    '**Drawing Engine Line Alerts** - Draw a line on the chart, get alerted when price touches it',
  'subscription.pro3':
    '**Multi-Timeframe Visualization** - Overlay M5 structure on M15 charts',
  'subscription.pro4':
    '**Exclusive XAUUSD Insights** - Full M5/M15 indicator data (all 79 columns)',
  'subscription.pro5': '**300 API Requests/Hour**',
  'subscription.pro6': '**Priority Support & Data Export**',
  'subscription.freeHeading': 'Your Free Plan Includes:',
  'subscription.free1': '**XAUUSD (Gold)** - M5 and M15 charts',
  'subscription.free2': '**Full Indicator Data** - Same market data as Pro',
  'subscription.free3': '**60 API Requests/Hour**',
  'subscription.upgradeLead':
    '{link} for alerts, line alerts, and multi-timeframe view!',
  'subscription.upgradeLink': 'Upgrade to Pro',
  'subscription.subject': '{plan} Subscription Confirmed',

  // ── Subscription cancelled (user-initiated, effective now) ────────────────
  'cancellation.heading': 'Subscription Cancelled',
  'cancellation.body': 'Your {app} PRO subscription has been cancelled.',
  'cancellation.freeAccess': 'You now have FREE tier access:',
  'cancellation.changedMind': 'Changed your mind?',
  'cancellation.upgradeAgain':
    'You can upgrade again anytime to regain access to all PRO features.',
  'cancellation.button': 'View Pricing',
  'cancellation.thanks': 'Thank you for trying PRO!',
  'cancellation.subject': 'Your PRO subscription has been cancelled',

  // ── Payment failed ────────────────────────────────────────────────────────
  'paymentFailed.heading': 'Payment Failed',
  'paymentFailed.body':
    "We couldn't process your payment for {app} PRO ({amount}).",
  'paymentFailed.reason': '**Reason:** {reason}',
  'paymentFailed.action':
    '**Please update your payment method within 3 days** to keep your PRO access.',
  'paymentFailed.button': 'Update Payment Method',
  'paymentFailed.downgrade':
    'If not resolved, your account will be downgraded to the FREE tier.',
  'paymentFailed.subject': 'Payment Failed - Action Required',

  // ── Payment receipt ───────────────────────────────────────────────────────
  'receipt.title': 'Payment Receipt',
  'receipt.heading': 'Payment Successful',
  'receipt.body': 'Your payment was successful!',
  'receipt.description': 'Description',
  'receipt.descriptionValue': '{app} PRO - Monthly',
  'receipt.amount': 'Amount',
  'receipt.date': 'Date',
  'receipt.nextBilling': 'Next billing date',
  'receipt.button': 'Download Invoice',
  'receipt.thanks': 'Thank you for being a PRO member!',
  'receipt.subject': 'Payment Receipt - {app} PRO',

  // ── Subscription cancelled (access continues until the period ends) ───────
  'canceled.heading': 'Subscription Canceled',
  'canceled.body': 'Your **{plan}** subscription has been canceled.',
  'canceled.accessUntil': '**Access Until:** {date}',
  'canceled.accessNote': "You'll continue to have {plan} access until {date}.",
  'canceled.afterwards':
    'After that, your account will revert to the **Free** plan with:',
  'canceled.reactivate': 'Changed your mind? {link}',
  'canceled.reactivateLink': 'Reactivate your subscription',
  'canceled.subject': 'Subscription Canceled - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': 'Subscription Resumed',
  'resumed.body': 'Your **{plan}** subscription will continue.',
  'resumed.nextBilling': '**Next Billing Date:** {date}',
  'resumed.note':
    'Your cancellation has been withdrawn. You keep full {plan} access and your subscription renews automatically on {date}.',
  'resumed.manage': 'You can review your subscription at any time. {link}',
  'resumed.manageLink': 'Open billing settings',
  'resumed.subject': 'Your {plan} subscription will continue - Trading Alerts',

  // ── Plan change: upgraded to yearly, switch to monthly scheduled (S3) ──
  'upgraded.heading': 'Switched to Yearly Billing',
  'upgraded.body': 'Your **{plan}** subscription now bills yearly.',
  'upgraded.charged': '**Charged today:** {amount}',
  'upgraded.price': '**Yearly price:** {price}',
  'upgraded.nextBilling': '**Next billing date:** {date}',
  'upgraded.firstCharge': '**First charge:** {date}',
  'upgraded.note':
    "Today's charge is the yearly price minus the credit for the unused part of your current monthly period.",
  'upgraded.trialNote':
    'Your free trial continues and nothing was charged today. Your first charge, at the yearly price, is on {date}.',
  'upgraded.subject': 'You are now on yearly billing - Trading Alerts',
  'switchScheduled.heading': 'Switch to Monthly Billing Scheduled',
  'switchScheduled.body':
    'Your **{plan}** subscription will switch to monthly billing on {date}.',
  'switchScheduled.date': '**Switch date:** {date}',
  'switchScheduled.price': '**Monthly price from then:** {price}',
  'switchScheduled.note':
    'You keep your yearly access until {date}. Nothing is charged or refunded now, and there is no credit for the current year.',
  'switchScheduled.keep':
    'Changed your mind? You can keep yearly billing before then. {link}',
  'switchScheduled.subject':
    'Your switch to monthly billing is scheduled - Trading Alerts',
  'planChange.manage': 'You can review your subscription at any time. {link}',
  'planChange.manageLink': 'Open billing settings',

  // ── Affiliate commission ──────────────────────────────────────────────────
  'commission.heading': 'Commission Earned!',
  'commission.body':
    "Great news! Your affiliate code was just used and you've earned a commission.",
  'commission.codeUsed': 'Code Used',
  'commission.earned': 'Commission Earned',
  'commission.total': 'Total Earnings',
  'commission.rate': '**Commission Rate:** {percent}% of subscription revenue',
  'commission.button': 'View Dashboard',
  'commission.subject': 'Commission Earned! {amount} - {app}',
} as const;

export type EmailMessageKey = keyof typeof enUS;

/** The shape every locale file must fill completely. */
export type EmailMessages = Record<EmailMessageKey, string>;
