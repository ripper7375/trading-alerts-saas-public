import type { EmailMessages } from './en-US';

/** Traditional Chinese. */
export const zhTW: EmailMessages = {
  'common.greeting': '{name}，您好：',
  'common.userFallback': '用戶',
  'common.questions': '如有任何疑問，請直接回覆此郵件，或前往我們的說明中心。',
  'common.signature': '{app} 團隊',
  'common.needHelpContact': '需要協助嗎？請聯絡 {email}',
  'common.needHelpReply': '需要協助嗎？請回覆此郵件，或聯絡 {email}',
  'common.securityAlertsNote': '您已開啟安全提醒，因此收到這封郵件。',
  'common.manageNotifications': '管理通知偏好設定',

  'label.time': '時間：',
  'label.location': '位置：',
  'label.ipAddress': 'IP 位址：',
  'label.device': '裝置：',
  'label.browser': '瀏覽器：',
  'label.os': '作業系統：',

  'value.unknown': '未知',
  'value.unknownLocation': '未知位置',
  'value.device.desktop': '電腦',
  'value.device.mobile': '手機',
  'value.device.tablet': '平板電腦',

  'billing.perMonth': '{price}/月',
  'billing.perYear': '{price}/年',

  'security.changePassword': '立即變更您的密碼',
  'security.secureButton': '保護我的帳戶',

  'freeTier.xauusd': 'XAUUSD（黃金）的 M5 和 M15 圖表',
  'freeTier.marketData': '完整的市場資料和指標疊加',
  'freeTier.noAlerts': '無價格提醒（PRO 功能）',

  'welcome.title': '歡迎使用 Trading Alerts',
  'welcome.heading': '歡迎使用 Trading Alerts，{name}！',
  'welcome.body': '您的帳戶已成功建立。現在可以設定您的第一個交易提醒了！',
  'welcome.getStarted': '開始使用：',
  'welcome.step1': '在 M5 或 M15 週期開啟 XAUUSD 圖表',
  'welcome.step2': '探索通道和結構疊加',
  'welcome.step3': '自訂您的通知偏好設定',
  'welcome.button': '前往儀表板',
  'welcome.subject': '歡迎使用 Trading Alerts！',

  'affiliateWelcome.title': '歡迎加入聯盟計畫',
  'affiliateWelcome.heading': '{name}，您已成為聯盟夥伴！',
  'affiliateWelcome.body':
    '您的聯盟帳戶已啟用。我們已為您產生第一批 {count} 個推薦碼，現在即可在儀表板中使用。',
  'affiliateWelcome.button': '前往聯盟儀表板',
  'affiliateWelcome.footer':
    '當您的餘額達到每月最低金額後，我們將透過 Wise 付款。如有任何疑問，請直接回覆此郵件，或前往我們的說明中心。',
  'affiliateWelcome.subject': '您已成為聯盟夥伴 - Trading Alerts',

  'verify.heading': '驗證您的電子郵件地址',
  'verify.body': '{name}，您好：請點擊下方按鈕驗證您的電子郵件地址並啟用帳戶。',
  'verify.button': '驗證電子郵件地址',
  'verify.ignore': '如果您沒有註冊 Trading Alerts 帳戶，請忽略此郵件。',
  'verify.expiry': '此連結將在 24 小時後失效。',
  'verify.subject': '驗證您的電子郵件 - Trading Alerts',

  'reset.heading': '重設您的密碼',
  'reset.body':
    '{name}，您好：我們收到了重設您密碼的請求。請點擊下方按鈕設定新密碼。',
  'reset.button': '重設密碼',
  'reset.ignore': '如果您沒有要求重設密碼，請忽略此郵件，您的密碼將維持不變。',
  'reset.expiry': '此連結將在 1 小時後失效。',
  'reset.subject': '重設您的密碼 - Trading Alerts',

  'newDevice.heading': '偵測到新裝置登入',
  'newDevice.body':
    '{name}，您好：我們偵測到有新裝置登入了您的 Trading Alerts 帳戶：',
  'newDevice.ifYou': '**如果是您本人操作：** 無需任何處理，可以忽略此郵件。',
  'newDevice.ifNotYou':
    '**如果不是您本人操作：** 可能有他人存取了您的帳戶。我們建議您：',
  'newDevice.tip2': '檢查目前的使用中工作階段，並登出不認識的裝置',
  'newDevice.tip3': '啟用雙重認證，提升帳戶安全',
  'newDevice.subject': '安全提醒：偵測到新裝置登入',

  'passwordChanged.heading': '密碼已成功變更',
  'passwordChanged.body':
    '{name}，您好：您的 Trading Alerts 帳戶密碼已被變更。',
  'passwordChanged.ifYou':
    '**如果是您本人變更：** 無需任何處理，您的帳戶是安全的。',
  'passwordChanged.ifNotYou':
    '**如果不是您本人變更：** 您的帳戶可能已遭盜用。請：',
  'passwordChanged.tip1': '立即透過「忘記密碼」功能重設您的密碼',
  'passwordChanged.tip2': '檢查您的帳戶是否有未經授權的變更',
  'passwordChanged.tip3': '如需協助，請聯絡我們的支援團隊',
  'passwordChanged.subject': '安全提醒：密碼已變更',

  'twoFactorEnabled.heading': '雙重認證已啟用',
  'twoFactorEnabled.body':
    '{name}，您好：您的 Trading Alerts 帳戶已成功啟用雙重認證。',
  'twoFactorEnabled.remindersHeading': '重要提醒：',
  'twoFactorEnabled.reminder1': '請將備用碼保存在安全的地方',
  'twoFactorEnabled.reminder2': '登入時需要使用您的驗證器應用程式',
  'twoFactorEnabled.reminder3': '如果無法使用驗證器，請使用備用碼',
  'twoFactorEnabled.ifNotYou':
    '**如果不是您本人啟用的雙重認證：** 您的帳戶可能已遭盜用。請立即聯絡支援團隊。',
  'twoFactorEnabled.button': '管理安全設定',
  'twoFactorEnabled.subject': '安全提醒：雙重認證已啟用',

  'twoFactorDisabled.heading': '雙重認證已停用',
  'twoFactorDisabled.body':
    '{name}，您好：您的 Trading Alerts 帳戶已停用雙重認證。',
  'twoFactorDisabled.warning': '沒有雙重認證，您的帳戶安全性將會降低。',
  'twoFactorDisabled.ifYou':
    '**如果是您本人停用的：** 為獲得最高安全性，建議您重新啟用。',
  'twoFactorDisabled.ifNotYou':
    '**如果不是您本人停用的：** 您的帳戶可能已遭盜用。請：',
  'twoFactorDisabled.tip2': '重新啟用雙重認證',
  'twoFactorDisabled.tip3': '檢查您的帳戶是否有未經授權的變更',
  'twoFactorDisabled.subject': '安全提醒：雙重認證已停用',

  'accountDeletion.heading': '確認刪除您的帳戶',
  'accountDeletion.body':
    '{name}，您好：我們收到了永久刪除您的 Trading Alerts 帳戶的請求。',
  'accountDeletion.confirmIntro':
    '**如需繼續，** 請點擊下方按鈕確認刪除。此操作無法復原。',
  'accountDeletion.confirmButton': '確認刪除帳戶',
  'accountDeletion.cancelIntro':
    '**如果您改變了主意，或此請求並非由您發出，** 請改為取消該請求：',
  'accountDeletion.cancelButton': '取消刪除請求',
  'accountDeletion.expiry':
    '這些連結將於 {date} 失效。任何持有這些連結的人都可以處理您的請求，請勿轉寄此郵件。',
  'accountDeletion.subject': '確認刪除您的帳戶 - Trading Alerts',

  'subscription.heading': '訂閱已確認！',
  'subscription.body': '{name}，您好：您的 **{plan}** 訂閱現已生效。',
  'subscription.planDetails': '方案詳情',
  'subscription.tier': '等級：',
  'subscription.billing': '計費：',
  'subscription.trial': '7 天免費試用：試用期結束前不會從您的信用卡扣款。',
  'subscription.proHeading': 'Pro 方案包含：',
  'subscription.pro1': '**100 個價格提醒** - 不錯過任何交易機會',
  'subscription.pro2':
    '**繪圖引擎線提醒** - 在圖表上畫一條線，價格觸及時即收到提醒',
  'subscription.pro3': '**多週期視覺化** - 將 M5 結構疊加到 M15 圖表上',
  'subscription.pro4':
    '**XAUUSD 獨家洞察** - 完整的 M5/M15 指標資料（全部 79 欄）',
  'subscription.pro5': '**每小時 300 次 API 請求**',
  'subscription.pro6': '**優先支援與資料匯出**',
  'subscription.freeHeading': '免費方案包含：',
  'subscription.free1': '**XAUUSD（黃金）** - M5 和 M15 圖表',
  'subscription.free2': '**完整指標資料** - 與 Pro 相同的市場資料',
  'subscription.free3': '**每小時 60 次 API 請求**',
  'subscription.upgradeLead': '{link}，即可使用提醒、線提醒和多週期檢視！',
  'subscription.upgradeLink': '升級到 Pro',
  'subscription.subject': '{plan} 訂閱已確認',

  'cancellation.heading': '訂閱已取消',
  'cancellation.body': '您的 {app} PRO 訂閱已取消。',
  'cancellation.freeAccess': '您現在使用的是 FREE 等級：',
  'cancellation.changedMind': '改變主意了嗎？',
  'cancellation.upgradeAgain': '您可以隨時重新升級，恢復使用所有 PRO 功能。',
  'cancellation.button': '檢視定價',
  'cancellation.thanks': '感謝您試用 PRO！',
  'cancellation.subject': '您的 PRO 訂閱已取消',

  'paymentFailed.heading': '付款失敗',
  'paymentFailed.body': '我們無法處理您的 {app} PRO（{amount}）付款。',
  'paymentFailed.reason': '**原因：** {reason}',
  'paymentFailed.action': '**請在 3 天內更新您的付款方式**，以保留 PRO 權限。',
  'paymentFailed.button': '更新付款方式',
  'paymentFailed.downgrade': '如果問題未能解決，您的帳戶將被降級為 FREE 等級。',
  'paymentFailed.subject': '付款失敗 - 需要您採取行動',

  'receipt.title': '付款收據',
  'receipt.heading': '付款成功',
  'receipt.body': '您的付款已成功！',
  'receipt.description': '說明',
  'receipt.descriptionValue': '{app} PRO - 按月',
  'receipt.amount': '金額',
  'receipt.date': '日期',
  'receipt.nextBilling': '下次扣款日期',
  'receipt.button': '下載發票',
  'receipt.thanks': '感謝您成為 PRO 會員！',
  'receipt.subject': '付款收據 - {app} PRO',

  'canceled.heading': '訂閱已取消',
  'canceled.body': '您的 **{plan}** 訂閱已取消。',
  'canceled.accessUntil': '**可使用至：** {date}',
  'canceled.accessNote': '在 {date} 之前，您仍可繼續使用 {plan}。',
  'canceled.afterwards': '此後，您的帳戶將恢復為 **Free** 方案，包含：',
  'canceled.reactivate': '改變主意了嗎？{link}',
  'canceled.reactivateLink': '重新啟用訂閱',
  'canceled.subject': '訂閱已取消 - Trading Alerts',

  'commission.heading': '您獲得了佣金！',
  'commission.body': '好消息！您的聯盟碼剛剛被使用，您獲得了一筆佣金。',
  'commission.codeUsed': '被使用的代碼',
  'commission.earned': '獲得的佣金',
  'commission.total': '累計收益',
  'commission.rate': '**佣金比例：** 訂閱收入的 {percent}%',
  'commission.button': '檢視儀表板',
  'commission.subject': '您獲得了佣金！{amount} - {app}',
};
