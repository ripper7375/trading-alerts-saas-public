import type { EmailMessages } from './en-US';

/** Simplified Chinese. */
export const zh: EmailMessages = {
  'common.greeting': '{name}，您好：',
  'common.userFallback': '用户',
  'common.questions': '如有任何疑问，请直接回复此邮件，或访问我们的帮助中心。',
  'common.signature': '{app} 团队',
  'common.needHelpContact': '需要帮助？请联系 {email}',
  'common.needHelpReply': '需要帮助？请回复此邮件，或联系 {email}',
  'common.securityAlertsNote': '您已开启安全提醒，因此收到这封邮件。',
  'common.manageNotifications': '管理通知偏好',

  'label.time': '时间：',
  'label.location': '位置：',
  'label.ipAddress': 'IP 地址：',
  'label.device': '设备：',
  'label.browser': '浏览器：',
  'label.os': '操作系统：',

  'value.unknown': '未知',
  'value.unknownLocation': '未知位置',
  'value.device.desktop': '电脑',
  'value.device.mobile': '手机',
  'value.device.tablet': '平板电脑',

  'billing.perMonth': '{price}/月',
  'billing.perYear': '{price}/年',
  'billing.perThreeDays': '{price}/3天',

  'security.changePassword': '立即修改您的密码',
  'security.secureButton': '保护我的账户',

  'freeTier.xauusd': 'XAUUSD（黄金）的 M5 和 M15 图表',
  'freeTier.marketData': '完整的市场数据和指标叠加',
  'freeTier.noAlerts': '无价格提醒（PRO 功能）',

  'welcome.title': '欢迎使用 Trading Alerts',
  'welcome.heading': '欢迎使用 Trading Alerts，{name}！',
  'welcome.body': '您的账户已成功创建。现在可以设置您的第一个交易提醒了！',
  'welcome.getStarted': '开始使用：',
  'welcome.step1': '在 M5 或 M15 周期打开 XAUUSD 图表',
  'welcome.step2': '探索通道和结构叠加',
  'welcome.step3': '自定义您的通知偏好',
  'welcome.button': '前往仪表板',
  'welcome.subject': '欢迎使用 Trading Alerts！',

  'affiliateWelcome.title': '欢迎加入联盟计划',
  'affiliateWelcome.heading': '{name}，您已成为联盟合作伙伴！',
  'affiliateWelcome.body':
    '您的联盟账户已激活。我们已为您生成了首批 {count} 个推荐码，现在即可在仪表板中使用。',
  'affiliateWelcome.button': '前往联盟仪表板',
  'affiliateWelcome.footer':
    '当您的余额达到每月最低金额后，我们将通过 Wise 向您付款。如有任何疑问，请直接回复此邮件，或访问我们的帮助中心。',
  'affiliateWelcome.subject': '您已成为联盟合作伙伴 - Trading Alerts',

  'verify.heading': '验证您的电子邮箱地址',
  'verify.body': '{name}，您好：请点击下方按钮验证您的电子邮箱地址并激活账户。',
  'verify.button': '验证电子邮箱地址',
  'verify.ignore': '如果您没有注册 Trading Alerts 账户，请忽略此邮件。',
  'verify.expiry': '此链接将在 24 小时后失效。',
  'verify.subject': '验证您的电子邮箱 - Trading Alerts',

  'reset.heading': '重置您的密码',
  'reset.body':
    '{name}，您好：我们收到了重置您密码的请求。请点击下方按钮设置新密码。',
  'reset.button': '重置密码',
  'reset.ignore': '如果您没有请求重置密码，请忽略此邮件，您的密码将保持不变。',
  'reset.expiry': '此链接将在 1 小时后失效。',
  'reset.subject': '重置您的密码 - Trading Alerts',

  'newDevice.heading': '检测到新设备登录',
  'newDevice.body':
    '{name}，您好：我们检测到有新设备登录了您的 Trading Alerts 账户：',
  'newDevice.ifYou': '**如果是您本人操作：** 无需任何处理，可以忽略此邮件。',
  'newDevice.ifNotYou':
    '**如果不是您本人操作：** 可能有他人访问了您的账户。我们建议您：',
  'newDevice.tip2': '检查当前的活动会话，并退出不认识的设备',
  'newDevice.tip3': '启用双重认证，提升账户安全',
  'newDevice.subject': '安全提醒：检测到新设备登录',

  'passwordChanged.heading': '密码已成功修改',
  'passwordChanged.body':
    '{name}，您好：您的 Trading Alerts 账户密码已被修改。',
  'passwordChanged.ifYou':
    '**如果是您本人修改：** 无需任何处理，您的账户是安全的。',
  'passwordChanged.ifNotYou':
    '**如果不是您本人修改：** 您的账户可能已被盗用。请：',
  'passwordChanged.tip1': '立即通过“忘记密码”功能重置您的密码',
  'passwordChanged.tip2': '检查您的账户是否存在未经授权的更改',
  'passwordChanged.tip3': '如需帮助，请联系我们的支持团队',
  'passwordChanged.subject': '安全提醒：密码已修改',

  'twoFactorEnabled.heading': '双重认证已启用',
  'twoFactorEnabled.body':
    '{name}，您好：您的 Trading Alerts 账户已成功启用双重认证。',
  'twoFactorEnabled.remindersHeading': '重要提示：',
  'twoFactorEnabled.reminder1': '请将备份码保存在安全的地方',
  'twoFactorEnabled.reminder2': '登录时需要使用您的身份验证器应用',
  'twoFactorEnabled.reminder3': '如果无法使用身份验证器，请使用备份码',
  'twoFactorEnabled.ifNotYou':
    '**如果不是您本人启用的双重认证：** 您的账户可能已被盗用。请立即联系支持团队。',
  'twoFactorEnabled.button': '管理安全设置',
  'twoFactorEnabled.subject': '安全提醒：双重认证已启用',

  'twoFactorDisabled.heading': '双重认证已停用',
  'twoFactorDisabled.body':
    '{name}，您好：您的 Trading Alerts 账户已停用双重认证。',
  'twoFactorDisabled.warning': '没有双重认证，您的账户安全性将会降低。',
  'twoFactorDisabled.ifYou':
    '**如果是您本人停用的：** 为获得最高安全性，建议您重新启用。',
  'twoFactorDisabled.ifNotYou':
    '**如果不是您本人停用的：** 您的账户可能已被盗用。请：',
  'twoFactorDisabled.tip2': '重新启用双重认证',
  'twoFactorDisabled.tip3': '检查您的账户是否存在未经授权的更改',
  'twoFactorDisabled.subject': '安全提醒：双重认证已停用',

  'payoutDetails.heading': '收款信息已更改',
  'payoutDetails.body':
    '{name}，您好：您的 Trading Alerts 联盟账户已添加或更改收款信息。',
  'payoutDetails.holdLabel': '付款暂缓至：',
  'payoutDetails.hold':
    '为了保护您的账户，向这些收款信息付款将暂缓 {hours} 小时。您的收益是安全的，暂缓期结束后将会支付。',
  'payoutDetails.ifYou': '**如果是您本人所做的更改：** 无需任何操作。',
  'payoutDetails.ifNotYou':
    '**如果不是您本人所做的更改：** 您的账户可能已被盗用。请：',
  'payoutDetails.tip2': '在暂缓期结束前联系我们的支持团队',
  'payoutDetails.tip3': '检查您的账户是否存在未经授权的更改',
  'payoutDetails.subject': '安全提醒：您的收款信息已更改',

  'accountDeletion.heading': '确认删除您的账户',
  'accountDeletion.body':
    '{name}，您好：我们收到了永久删除您的 Trading Alerts 账户的请求。',
  'accountDeletion.confirmIntro':
    '**如需继续，** 请点击下方按钮确认删除。此操作无法撤销。',
  'accountDeletion.confirmButton': '确认删除账户',
  'accountDeletion.cancelIntro':
    '**如果您改变了主意，或此请求并非由您发起，** 请改为取消该请求：',
  'accountDeletion.cancelButton': '取消删除请求',
  'accountDeletion.expiry':
    '这些链接将于 {date} 失效。任何持有这些链接的人都可以处理您的请求，请勿转发此邮件。',
  'accountDeletion.subject': '确认删除您的账户 - Trading Alerts',

  'subscription.heading': '订阅已确认！',
  'subscription.body': '{name}，您好：您的 **{plan}** 订阅现已生效。',
  'subscription.planDetails': '套餐详情',
  'subscription.tier': '等级：',
  'subscription.billing': '计费：',
  'subscription.trial': '7 天免费试用：试用期结束前不会从您的银行卡扣款。',
  'subscription.proHeading': 'Pro 套餐包含：',
  'subscription.pro1': '**100 个价格提醒** - 不错过任何交易机会',
  'subscription.pro2':
    '**绘图引擎线提醒** - 在图表上画一条线，价格触及时即收到提醒',
  'subscription.pro3': '**多周期可视化** - 将 M5 结构叠加到 M15 图表上',
  'subscription.pro4':
    '**XAUUSD 独家洞察** - 完整的 M5/M15 指标数据（全部 79 列）',
  'subscription.pro5': '**每小时 300 次 API 请求**',
  'subscription.pro6': '**优先支持和数据导出**',
  'subscription.freeHeading': '免费套餐包含：',
  'subscription.free1': '**XAUUSD（黄金）** - M5 和 M15 图表',
  'subscription.free2': '**完整指标数据** - 与 Pro 相同的市场数据',
  'subscription.free3': '**每小时 60 次 API 请求**',
  'subscription.upgradeLead': '{link}，即可使用提醒、线提醒和多周期视图！',
  'subscription.upgradeLink': '升级到 Pro',
  'subscription.subject': '{plan} 订阅已确认',

  'cancellation.heading': '订阅已取消',
  'cancellation.body': '您的 {app} PRO 订阅已取消。',
  'cancellation.freeAccess': '您现在使用的是 FREE 等级：',
  'cancellation.changedMind': '改变主意了？',
  'cancellation.upgradeAgain': '您可以随时重新升级，恢复使用所有 PRO 功能。',
  'cancellation.button': '查看定价',
  'cancellation.thanks': '感谢您试用 PRO！',
  'cancellation.subject': '您的 PRO 订阅已取消',

  'paymentFailed.heading': '付款失败',
  'paymentFailed.body': '我们无法处理您的 {app} PRO（{amount}）付款。',
  'paymentFailed.reason': '**原因：** {reason}',
  'paymentFailed.action': '**请在 3 天内更新您的付款方式**，以保留 PRO 权限。',
  'paymentFailed.button': '更新付款方式',
  'paymentFailed.downgrade': '如果问题未能解决，您的账户将被降级为 FREE 等级。',
  'paymentFailed.subject': '付款失败 - 需要您的操作',

  'receipt.title': '付款收据',
  'receipt.heading': '付款成功',
  'receipt.body': '您的付款已成功！',
  'receipt.description': '说明',
  'receipt.descriptionValue': '{app} PRO - 按月',
  'receipt.amount': '金额',
  'receipt.date': '日期',
  'receipt.nextBilling': '下次扣款日期',
  'receipt.button': '下载发票',
  'receipt.thanks': '感谢您成为 PRO 会员！',
  'receipt.subject': '付款收据 - {app} PRO',

  'canceled.heading': '订阅已取消',
  'canceled.body': '您的 **{plan}** 订阅已取消。',
  'canceled.accessUntil': '**可使用至：** {date}',
  'canceled.accessNote': '在 {date} 之前，您仍可继续使用 {plan}。',
  'canceled.afterwards': '此后，您的账户将恢复为 **Free** 套餐，包含：',
  'canceled.reactivate': '改变主意了？{link}',
  'canceled.reactivateLink': '重新激活订阅',
  'canceled.subject': '订阅已取消 - Trading Alerts',

  'commission.heading': '您获得了佣金！',
  'commission.body': '好消息！您的联盟码刚刚被使用，您获得了一笔佣金。',
  'commission.codeUsed': '被使用的代码',
  'commission.earned': '获得的佣金',
  'commission.total': '累计收益',
  'commission.rate': '**佣金比例：** 订阅收入的 {percent}%',
  'commission.button': '查看仪表板',
  'commission.subject': '您获得了佣金！{amount} - {app}',
};
