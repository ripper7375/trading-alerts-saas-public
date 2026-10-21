import type { EmailMessages } from './en-US';

export const ja: EmailMessages = {
  'common.greeting': '{name}様',
  'common.userFallback': 'お客様',
  'common.questions':
    'ご不明な点がございましたら、このメールにご返信いただくか、ヘルプセンターをご覧ください。',
  'common.signature': '{app}チーム',
  'common.needHelpContact': 'お困りですか？ {email} までお問い合わせください',
  'common.needHelpReply':
    'お困りですか？ このメールにご返信いただくか、{email} までお問い合わせください',
  'common.securityAlertsNote':
    'セキュリティアラートが有効になっているため、このメールをお送りしています。',
  'common.manageNotifications': '通知設定を管理',

  'label.time': '日時：',
  'label.location': '場所：',
  'label.ipAddress': 'IPアドレス：',
  'label.device': 'デバイス：',
  'label.browser': 'ブラウザ：',
  'label.os': 'オペレーティングシステム：',

  'value.unknown': '不明',
  'value.unknownLocation': '場所不明',
  'value.device.desktop': 'パソコン',
  'value.device.mobile': 'スマートフォン',
  'value.device.tablet': 'タブレット',

  'billing.perMonth': '{price}／月',
  'billing.perYear': '{price}／年',
  'billing.perThreeDays': '{price}／3日',

  'security.changePassword': 'ただちにパスワードを変更する',
  'security.secureButton': 'アカウントを保護する',

  'freeTier.xauusd': 'XAUUSD（ゴールド）のM5・M15',
  'freeTier.marketData': 'すべての市場データとインジケーターのオーバーレイ',
  'freeTier.noAlerts': '価格アラートなし（PRO機能）',

  'welcome.title': 'Trading Alertsへようこそ',
  'welcome.heading': 'Trading Alertsへようこそ、{name}様！',
  'welcome.body':
    'アカウントが正常に作成されました。最初のトレーディングアラートを設定しましょう。',
  'welcome.getStarted': 'はじめに：',
  'welcome.step1': 'M5またはM15でXAUUSDチャートを開く',
  'welcome.step2': 'チャネルと構造のオーバーレイを確認する',
  'welcome.step3': '通知設定をカスタマイズする',
  'welcome.button': 'ダッシュボードへ',
  'welcome.subject': 'Trading Alertsへようこそ！',

  'affiliateWelcome.title': 'アフィリエイトプログラムへようこそ',
  'affiliateWelcome.heading':
    '{name}様、アフィリエイトパートナーになりました！',
  'affiliateWelcome.body':
    'アフィリエイトアカウントが有効になりました。最初の紹介コードを{count}件発行しました。ダッシュボードですぐにご利用いただけます。',
  'affiliateWelcome.button': 'アフィリエイトダッシュボードへ',
  'affiliateWelcome.footer':
    '残高が月次の最低額に達すると、Wise経由でお支払いします。ご不明な点がございましたら、このメールにご返信いただくか、ヘルプセンターをご覧ください。',
  'affiliateWelcome.subject':
    'アフィリエイトパートナーになりました - Trading Alerts',

  'verify.heading': 'メールアドレスの確認',
  'verify.body':
    '{name}様、下のボタンをクリックしてメールアドレスを確認し、アカウントを有効にしてください。',
  'verify.button': 'メールアドレスを確認する',
  'verify.ignore':
    'Trading Alertsのアカウントを作成した覚えがない場合は、このメールを無視していただいて問題ありません。',
  'verify.expiry': 'このリンクの有効期限は24時間です。',
  'verify.subject': 'メールアドレスの確認 - Trading Alerts',

  'reset.heading': 'パスワードの再設定',
  'reset.body':
    '{name}様、パスワードの再設定リクエストを受け付けました。下のボタンをクリックして新しいパスワードを設定してください。',
  'reset.button': 'パスワードを再設定',
  'reset.ignore':
    'パスワードの再設定をリクエストしていない場合は、このメールを無視してください。パスワードは変更されません。',
  'reset.expiry': 'このリンクの有効期限は1時間です。',
  'reset.subject': 'パスワードの再設定 - Trading Alerts',

  'newDevice.heading': '新しいデバイスからのログインを検出しました',
  'newDevice.body':
    '{name}様、新しいデバイスからTrading Alertsアカウントへのログインを検出しました。',
  'newDevice.ifYou':
    '**ご本人の場合：** 対応は不要です。このメールは無視していただいて問題ありません。',
  'newDevice.ifNotYou':
    '**ご本人でない場合：** 第三者がアカウントにアクセスした可能性があります。次の対応をお勧めします。',
  'newDevice.tip2':
    'アクティブなセッションを確認し、見覚えのないデバイスをログアウトする',
  'newDevice.tip3': 'セキュリティ強化のため二段階認証を有効にする',
  'newDevice.subject':
    'セキュリティアラート：新しいデバイスからのログインを検出',

  'passwordChanged.heading': 'パスワードを変更しました',
  'passwordChanged.body':
    '{name}様、Trading Alertsアカウントのパスワードが変更されました。',
  'passwordChanged.ifYou':
    '**ご本人が変更した場合：** 対応は不要です。アカウントは安全です。',
  'passwordChanged.ifNotYou':
    '**ご本人が変更していない場合：** アカウントが不正利用されている可能性があります。次の対応をお願いします。',
  'passwordChanged.tip1':
    '「パスワードをお忘れですか？」からただちにパスワードを再設定する',
  'passwordChanged.tip2': 'アカウントに不正な変更がないか確認する',
  'passwordChanged.tip3': 'ご不明な点はサポートチームまでお問い合わせください',
  'passwordChanged.subject': 'セキュリティアラート：パスワードが変更されました',

  'twoFactorEnabled.heading': '二段階認証を有効にしました',
  'twoFactorEnabled.body':
    '{name}様、Trading Alertsアカウントで二段階認証が有効になりました。',
  'twoFactorEnabled.remindersHeading': '重要なお知らせ：',
  'twoFactorEnabled.reminder1':
    'バックアップコードは安全な場所に保管してください',
  'twoFactorEnabled.reminder2': 'ログインには認証アプリが必要になります',
  'twoFactorEnabled.reminder3':
    '認証アプリを利用できなくなった場合は、バックアップコードを使用してください',
  'twoFactorEnabled.ifNotYou':
    '**二段階認証を有効にした覚えがない場合：** アカウントが不正利用されている可能性があります。ただちにサポートまでご連絡ください。',
  'twoFactorEnabled.button': 'セキュリティ設定を管理',
  'twoFactorEnabled.subject':
    'セキュリティアラート：二段階認証が有効になりました',

  'twoFactorDisabled.heading': '二段階認証を無効にしました',
  'twoFactorDisabled.body':
    '{name}様、Trading Alertsアカウントの二段階認証が無効になりました。',
  'twoFactorDisabled.warning':
    '二段階認証がないため、アカウントの安全性が低下しています。',
  'twoFactorDisabled.ifYou':
    '**ご本人が無効にした場合：** 最大限の安全性のため、再度有効にすることをお勧めします。',
  'twoFactorDisabled.ifNotYou':
    '**ご本人が無効にしていない場合：** アカウントが不正利用されている可能性があります。次の対応をお願いします。',
  'twoFactorDisabled.tip2': '二段階認証を再度有効にする',
  'twoFactorDisabled.tip3': 'アカウントに不正な変更がないか確認する',
  'twoFactorDisabled.subject':
    'セキュリティアラート：二段階認証が無効になりました',

  'accountDeletion.heading': 'アカウント削除の確認',
  'accountDeletion.body':
    '{name}様、Trading Alertsアカウントを完全に削除するリクエストを受け付けました。',
  'accountDeletion.confirmIntro':
    '**削除を進める場合は、** 下のボタンで削除を確定してください。この操作は取り消せません。',
  'accountDeletion.confirmButton': 'アカウントの削除を確定',
  'accountDeletion.cancelIntro':
    '**気が変わった場合、またはご本人のリクエストでない場合は、** 代わりにリクエストをキャンセルしてください。',
  'accountDeletion.cancelButton': '削除リクエストをキャンセル',
  'accountDeletion.expiry':
    'これらのリンクは{date}に失効します。リンクを知っている人は誰でもリクエストを操作できるため、このメールを転送しないでください。',
  'accountDeletion.subject': 'アカウント削除の確認 - Trading Alerts',

  'subscription.heading': 'サブスクリプションを確認しました！',
  'subscription.body':
    '{name}様、**{plan}**サブスクリプションが有効になりました。',
  'subscription.planDetails': 'プランの詳細',
  'subscription.tier': 'プラン：',
  'subscription.billing': 'お支払い：',
  'subscription.trial':
    '7日間の無料トライアル：トライアル終了までカードに請求されることはありません。',
  'subscription.proHeading': 'Proで利用できる機能：',
  'subscription.pro1': '**価格アラート100件** - 取引のチャンスを逃しません',
  'subscription.pro2':
    '**描画エンジンのラインアラート** - チャートにラインを引くと、価格が触れたときに通知します',
  'subscription.pro3':
    '**マルチタイムフレーム表示** - M15チャートにM5の構造を重ねて表示',
  'subscription.pro4':
    '**XAUUSD限定インサイト** - M5/M15のインジケーターデータをすべて提供（全79列）',
  'subscription.pro5': '**1時間あたり300回のAPIリクエスト**',
  'subscription.pro6': '**優先サポートとデータエクスポート**',
  'subscription.freeHeading': '無料プランに含まれる内容：',
  'subscription.free1': '**XAUUSD（ゴールド）** - M5・M15チャート',
  'subscription.free2': '**インジケーターの全データ** - Proと同じ市場データ',
  'subscription.free3': '**1時間あたり60回のAPIリクエスト**',
  'subscription.upgradeLead':
    '{link}すると、アラート、ラインアラート、マルチタイムフレーム表示をご利用いただけます。',
  'subscription.upgradeLink': 'Proにアップグレード',
  'subscription.subject': '{plan}サブスクリプションを確認しました',

  'cancellation.heading': 'サブスクリプションを解約しました',
  'cancellation.body': '{app} PROサブスクリプションを解約しました。',
  'cancellation.freeAccess': 'FREEプランをご利用いただけます：',
  'cancellation.changedMind': 'お気持ちが変わりましたか？',
  'cancellation.upgradeAgain':
    'いつでも再びアップグレードして、すべてのPRO機能をご利用いただけます。',
  'cancellation.button': '料金を見る',
  'cancellation.thanks': 'PROをお試しいただきありがとうございました。',
  'cancellation.subject': 'PROサブスクリプションを解約しました',

  'paymentFailed.heading': 'お支払いに失敗しました',
  'paymentFailed.body':
    '{app} PRO（{amount}）のお支払いを処理できませんでした。',
  'paymentFailed.reason': '**理由：** {reason}',
  'paymentFailed.action':
    'PROのご利用を続けるには、**3日以内にお支払い方法を更新してください。**',
  'paymentFailed.button': 'お支払い方法を更新',
  'paymentFailed.downgrade':
    '解決されない場合、アカウントはFREEプランに変更されます。',
  'paymentFailed.subject': 'お支払いに失敗しました - 対応が必要です',

  'receipt.title': 'お支払いの領収書',
  'receipt.heading': 'お支払いが完了しました',
  'receipt.body': 'お支払いが完了しました。',
  'receipt.description': '内容',
  'receipt.descriptionValue': '{app} PRO - 月額',
  'receipt.amount': '金額',
  'receipt.date': '日付',
  'receipt.nextBilling': '次回のお支払い日',
  'receipt.button': '請求書をダウンロード',
  'receipt.thanks': 'PROメンバーになっていただきありがとうございます。',
  'receipt.subject': 'お支払いの領収書 - {app} PRO',

  'canceled.heading': 'サブスクリプションを解約しました',
  'canceled.body': '**{plan}**サブスクリプションを解約しました。',
  'canceled.accessUntil': '**ご利用可能期間：** {date}まで',
  'canceled.accessNote': '{date}まで引き続き{plan}をご利用いただけます。',
  'canceled.afterwards':
    'その後、アカウントは次の内容の**Free**プランに戻ります。',
  'canceled.reactivate': 'お気持ちが変わりましたか？ {link}',
  'canceled.reactivateLink': 'サブスクリプションを再開する',
  'canceled.subject': 'サブスクリプションを解約しました - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': 'サブスクリプションを再開しました',
  'resumed.body': '**{plan}**サブスクリプションは継続されます。',
  'resumed.nextBilling': '**次回のお支払い日：** {date}',
  'resumed.note':
    '解約のお手続きは取り消されました。引き続き{plan}をすべてご利用いただけ、サブスクリプションは{date}に自動更新されます。',
  'resumed.manage':
    'サブスクリプションの内容はいつでもご確認いただけます。{link}',
  'resumed.manageLink': 'お支払い設定を開く',
  'resumed.subject': '{plan}サブスクリプションは継続されます - Trading Alerts',

  'commission.heading': 'コミッションを獲得しました！',
  'commission.body':
    'あなたのアフィリエイトコードが使用され、コミッションを獲得しました。',
  'commission.codeUsed': '使用されたコード',
  'commission.earned': '獲得したコミッション',
  'commission.total': '累計収益',
  'commission.rate': '**コミッション率：** サブスクリプション収益の{percent}%',
  'commission.button': 'ダッシュボードを見る',
  'commission.subject': 'コミッションを獲得しました！{amount} - {app}',
};
