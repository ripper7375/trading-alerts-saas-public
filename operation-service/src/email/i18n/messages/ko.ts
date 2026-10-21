import type { EmailMessages } from './en-US';

export const ko: EmailMessages = {
  'common.greeting': '{name}님, 안녕하세요.',
  'common.userFallback': '회원',
  'common.questions':
    '궁금한 점이 있으시면 이 이메일에 회신하거나 도움말 센터를 방문해 주세요.',
  'common.signature': '{app} 팀',
  'common.needHelpContact': '도움이 필요하신가요? {email}로 문의해 주세요',
  'common.needHelpReply':
    '도움이 필요하신가요? 이 이메일에 회신하거나 {email}로 문의해 주세요',
  'common.securityAlertsNote':
    '보안 알림을 켜 두셨기 때문에 이 이메일을 보내 드립니다.',
  'common.manageNotifications': '알림 설정 관리',

  'label.time': '시간:',
  'label.location': '위치:',
  'label.ipAddress': 'IP 주소:',
  'label.device': '기기:',
  'label.browser': '브라우저:',
  'label.os': '운영 체제:',

  'value.unknown': '알 수 없음',
  'value.unknownLocation': '알 수 없는 위치',
  'value.device.desktop': '데스크톱',
  'value.device.mobile': '모바일',
  'value.device.tablet': '태블릿',

  'billing.perMonth': '월 {price}',
  'billing.perYear': '연 {price}',
  'billing.perThreeDays': '3일 {price}',

  'security.changePassword': '즉시 비밀번호를 변경하세요',
  'security.secureButton': '내 계정 보호하기',

  'freeTier.xauusd': 'XAUUSD(금) M5, M15',
  'freeTier.marketData': '전체 시장 데이터 및 지표 오버레이',
  'freeTier.noAlerts': '가격 알림 없음(PRO 기능)',

  'welcome.title': 'Trading Alerts에 오신 것을 환영합니다',
  'welcome.heading': 'Trading Alerts에 오신 것을 환영합니다, {name}님!',
  'welcome.body':
    '계정이 성공적으로 만들어졌습니다. 이제 첫 번째 트레이딩 알림을 설정해 보세요!',
  'welcome.getStarted': '시작하기:',
  'welcome.step1': 'M5 또는 M15에서 XAUUSD 차트 열기',
  'welcome.step2': '채널 및 구조 오버레이 살펴보기',
  'welcome.step3': '알림 설정 맞춤 구성하기',
  'welcome.button': '대시보드로 이동',
  'welcome.subject': 'Trading Alerts에 오신 것을 환영합니다!',

  'affiliateWelcome.title': '제휴 프로그램에 오신 것을 환영합니다',
  'affiliateWelcome.heading': '{name}님, 이제 제휴 파트너가 되셨습니다!',
  'affiliateWelcome.body':
    '제휴 계정이 활성화되었습니다. 첫 추천 코드 {count}개를 발급해 드렸으며, 지금 대시보드에서 바로 사용하실 수 있습니다.',
  'affiliateWelcome.button': '제휴 대시보드로 이동',
  'affiliateWelcome.footer':
    '잔액이 월 최소 금액을 넘으면 Wise를 통해 지급됩니다. 궁금한 점이 있으시면 이 이메일에 회신하거나 도움말 센터를 방문해 주세요.',
  'affiliateWelcome.subject': '제휴 파트너가 되셨습니다 - Trading Alerts',

  'verify.heading': '이메일 주소를 인증해 주세요',
  'verify.body':
    '{name}님, 아래 버튼을 눌러 이메일 주소를 인증하고 계정을 활성화해 주세요.',
  'verify.button': '이메일 주소 인증',
  'verify.ignore':
    'Trading Alerts 계정을 만든 적이 없다면 이 이메일을 무시하셔도 됩니다.',
  'verify.expiry': '이 링크는 24시간 후에 만료됩니다.',
  'verify.subject': '이메일 주소를 인증해 주세요 - Trading Alerts',

  'reset.heading': '비밀번호 재설정',
  'reset.body':
    '{name}님, 비밀번호 재설정 요청을 받았습니다. 아래 버튼을 눌러 새 비밀번호를 만들어 주세요.',
  'reset.button': '비밀번호 재설정',
  'reset.ignore':
    '비밀번호 재설정을 요청하지 않았다면 이 이메일을 무시하셔도 됩니다. 비밀번호는 변경되지 않습니다.',
  'reset.expiry': '이 링크는 1시간 후에 만료됩니다.',
  'reset.subject': '비밀번호 재설정 - Trading Alerts',

  'newDevice.heading': '새로운 기기에서 로그인이 감지되었습니다',
  'newDevice.body':
    '{name}님, 새로운 기기에서 Trading Alerts 계정에 로그인한 것이 감지되었습니다:',
  'newDevice.ifYou':
    '**본인이 로그인한 경우:** 별도의 조치가 필요하지 않습니다. 이 이메일은 무시하셔도 됩니다.',
  'newDevice.ifNotYou':
    '**본인이 아닌 경우:** 다른 사람이 계정에 접근했을 수 있습니다. 다음을 권장합니다:',
  'newDevice.tip2': '활성 세션을 확인하고 모르는 기기는 로그아웃하세요',
  'newDevice.tip3': '보안 강화를 위해 이중 인증을 켜세요',
  'newDevice.subject': '보안 알림: 새로운 기기에서 로그인이 감지되었습니다',

  'passwordChanged.heading': '비밀번호가 변경되었습니다',
  'passwordChanged.body':
    '{name}님, Trading Alerts 계정의 비밀번호가 변경되었습니다.',
  'passwordChanged.ifYou':
    '**본인이 변경한 경우:** 별도의 조치가 필요하지 않습니다. 계정은 안전합니다.',
  'passwordChanged.ifNotYou':
    '**본인이 변경하지 않은 경우:** 계정이 도용되었을 수 있습니다. 다음을 진행해 주세요:',
  'passwordChanged.tip1':
    '"비밀번호를 잊으셨나요?" 기능으로 즉시 비밀번호를 재설정하세요',
  'passwordChanged.tip2': '계정에 허가되지 않은 변경이 없는지 확인하세요',
  'passwordChanged.tip3': '도움이 필요하면 지원팀에 문의하세요',
  'passwordChanged.subject': '보안 알림: 비밀번호가 변경되었습니다',

  'twoFactorEnabled.heading': '이중 인증이 켜졌습니다',
  'twoFactorEnabled.body':
    '{name}님, Trading Alerts 계정에서 이중 인증이 성공적으로 켜졌습니다.',
  'twoFactorEnabled.remindersHeading': '중요 안내:',
  'twoFactorEnabled.reminder1': '백업 코드는 안전한 곳에 보관하세요',
  'twoFactorEnabled.reminder2': '로그인할 때 인증 앱이 필요합니다',
  'twoFactorEnabled.reminder3':
    '인증 앱을 사용할 수 없게 되면 백업 코드를 사용하세요',
  'twoFactorEnabled.ifNotYou':
    '**이중 인증을 직접 켜지 않았다면:** 계정이 도용되었을 수 있습니다. 즉시 지원팀에 문의해 주세요.',
  'twoFactorEnabled.button': '보안 설정 관리',
  'twoFactorEnabled.subject': '보안 알림: 이중 인증이 켜졌습니다',

  'twoFactorDisabled.heading': '이중 인증이 꺼졌습니다',
  'twoFactorDisabled.body':
    '{name}님, Trading Alerts 계정의 이중 인증이 꺼졌습니다.',
  'twoFactorDisabled.warning': '이중 인증이 없으면 계정이 더 취약해집니다.',
  'twoFactorDisabled.ifYou':
    '**본인이 끈 경우:** 최대한의 보안을 위해 다시 켜시길 권장합니다.',
  'twoFactorDisabled.ifNotYou':
    '**본인이 끄지 않은 경우:** 계정이 도용되었을 수 있습니다. 다음을 진행해 주세요:',
  'twoFactorDisabled.tip2': '이중 인증을 다시 켜세요',
  'twoFactorDisabled.tip3': '계정에 허가되지 않은 변경이 없는지 확인하세요',
  'twoFactorDisabled.subject': '보안 알림: 이중 인증이 꺼졌습니다',

  'accountDeletion.heading': '계정 삭제를 확인해 주세요',
  'accountDeletion.body':
    '{name}님, Trading Alerts 계정을 영구적으로 삭제해 달라는 요청을 받았습니다.',
  'accountDeletion.confirmIntro':
    '**삭제를 진행하려면** 아래 버튼으로 삭제를 확인해 주세요. 이 작업은 되돌릴 수 없습니다.',
  'accountDeletion.confirmButton': '계정 삭제 확인',
  'accountDeletion.cancelIntro':
    '**마음이 바뀌었거나 본인이 요청하지 않았다면** 대신 요청을 취소해 주세요:',
  'accountDeletion.cancelButton': '삭제 요청 취소',
  'accountDeletion.expiry':
    '이 링크는 {date}에 만료됩니다. 이 링크를 가진 사람은 누구나 요청을 처리할 수 있으므로 이 이메일을 전달하지 마세요.',
  'accountDeletion.subject': '계정 삭제를 확인해 주세요 - Trading Alerts',

  'subscription.heading': '구독이 확인되었습니다!',
  'subscription.body': '{name}님, **{plan}** 구독이 활성화되었습니다.',
  'subscription.planDetails': '요금제 정보',
  'subscription.tier': '등급:',
  'subscription.billing': '결제:',
  'subscription.trial':
    '7일 무료 체험: 체험이 끝날 때까지 카드에 요금이 청구되지 않습니다.',
  'subscription.proHeading': 'Pro에서 제공되는 기능:',
  'subscription.pro1': '**가격 알림 100개** - 거래 기회를 놓치지 마세요',
  'subscription.pro2':
    '**드로잉 엔진 라인 알림** - 차트에 선을 그리면 가격이 닿을 때 알려 드립니다',
  'subscription.pro3':
    '**멀티 타임프레임 시각화** - M15 차트에 M5 구조를 겹쳐서 표시',
  'subscription.pro4':
    '**XAUUSD 전용 인사이트** - M5/M15 지표 데이터 전체(79개 열 모두)',
  'subscription.pro5': '**시간당 API 요청 300회**',
  'subscription.pro6': '**우선 지원 및 데이터 내보내기**',
  'subscription.freeHeading': '무료 요금제에 포함된 기능:',
  'subscription.free1': '**XAUUSD(금)** - M5 및 M15 차트',
  'subscription.free2': '**전체 지표 데이터** - Pro와 동일한 시장 데이터',
  'subscription.free3': '**시간당 API 요청 60회**',
  'subscription.upgradeLead':
    '알림, 라인 알림, 멀티 타임프레임 보기를 이용하려면 {link}하세요!',
  'subscription.upgradeLink': 'Pro로 업그레이드',
  'subscription.subject': '{plan} 구독이 확인되었습니다',

  'cancellation.heading': '구독이 취소되었습니다',
  'cancellation.body': '{app} PRO 구독이 취소되었습니다.',
  'cancellation.freeAccess': '이제 FREE 등급을 이용하실 수 있습니다:',
  'cancellation.changedMind': '마음이 바뀌셨나요?',
  'cancellation.upgradeAgain':
    '언제든지 다시 업그레이드하여 모든 PRO 기능을 이용하실 수 있습니다.',
  'cancellation.button': '요금제 보기',
  'cancellation.thanks': 'PRO를 이용해 주셔서 감사합니다!',
  'cancellation.subject': 'PRO 구독이 취소되었습니다',

  'paymentFailed.heading': '결제에 실패했습니다',
  'paymentFailed.body': '{app} PRO({amount}) 결제를 처리하지 못했습니다.',
  'paymentFailed.reason': '**사유:** {reason}',
  'paymentFailed.action':
    'PRO 이용을 유지하려면 **3일 이내에 결제 수단을 업데이트해 주세요.**',
  'paymentFailed.button': '결제 수단 업데이트',
  'paymentFailed.downgrade': '해결되지 않으면 계정이 FREE 등급으로 변경됩니다.',
  'paymentFailed.subject': '결제 실패 - 조치가 필요합니다',

  'receipt.title': '결제 영수증',
  'receipt.heading': '결제가 완료되었습니다',
  'receipt.body': '결제가 완료되었습니다!',
  'receipt.description': '내역',
  'receipt.descriptionValue': '{app} PRO - 월간',
  'receipt.amount': '금액',
  'receipt.date': '날짜',
  'receipt.nextBilling': '다음 결제일',
  'receipt.button': '청구서 다운로드',
  'receipt.thanks': 'PRO 회원이 되어 주셔서 감사합니다!',
  'receipt.subject': '결제 영수증 - {app} PRO',

  'canceled.heading': '구독이 취소되었습니다',
  'canceled.body': '**{plan}** 구독이 취소되었습니다.',
  'canceled.accessUntil': '**이용 가능 기간:** {date}까지',
  'canceled.accessNote': '{date}까지 계속 {plan}을(를) 이용하실 수 있습니다.',
  'canceled.afterwards':
    '이후에는 계정이 다음 기능이 포함된 **Free** 요금제로 전환됩니다:',
  'canceled.reactivate': '마음이 바뀌셨나요? {link}',
  'canceled.reactivateLink': '구독 다시 시작하기',
  'canceled.subject': '구독이 취소되었습니다 - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': '구독이 재개되었습니다',
  'resumed.body': '**{plan}** 구독이 계속 유지됩니다.',
  'resumed.nextBilling': '**다음 결제일:** {date}',
  'resumed.note':
    '취소 요청이 철회되었습니다. {plan}을(를) 계속 모두 이용하실 수 있으며, 구독은 {date}에 자동으로 갱신됩니다.',
  'resumed.manage': '구독 내용은 언제든지 확인하실 수 있습니다. {link}',
  'resumed.manageLink': '결제 설정 열기',
  'resumed.subject': '{plan} 구독이 계속 유지됩니다 - Trading Alerts',

  'commission.heading': '수수료를 받았습니다!',
  'commission.body':
    '좋은 소식입니다! 회원님의 제휴 코드가 방금 사용되어 수수료를 받게 되었습니다.',
  'commission.codeUsed': '사용된 코드',
  'commission.earned': '받은 수수료',
  'commission.total': '총 수익',
  'commission.rate': '**수수료율:** 구독 수익의 {percent}%',
  'commission.button': '대시보드 보기',
  'commission.subject': '수수료를 받았습니다! {amount} - {app}',
};
