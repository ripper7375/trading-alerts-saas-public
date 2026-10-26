import type { EmailMessages } from './en-US';

export const vi: EmailMessages = {
  'common.greeting': 'Xin chào {name},',
  'common.userFallback': 'bạn',
  'common.questions':
    'Nếu có bất kỳ câu hỏi nào, hãy trả lời email này hoặc truy cập trung tâm trợ giúp của chúng tôi.',
  'common.signature': 'Đội ngũ {app}',
  'common.needHelpContact': 'Cần trợ giúp? Hãy liên hệ chúng tôi tại {email}',
  'common.needHelpReply':
    'Cần trợ giúp? Hãy trả lời email này hoặc liên hệ chúng tôi tại {email}',
  'common.securityAlertsNote':
    'Bạn nhận được email này vì đã bật cảnh báo bảo mật.',
  'common.manageNotifications': 'Quản lý tùy chọn thông báo',

  'label.time': 'Thời gian:',
  'label.location': 'Vị trí:',
  'label.ipAddress': 'Địa chỉ IP:',
  'label.device': 'Thiết bị:',
  'label.browser': 'Trình duyệt:',
  'label.os': 'Hệ điều hành:',

  'value.unknown': 'Không xác định',
  'value.unknownLocation': 'Vị trí không xác định',
  'value.device.desktop': 'Máy tính',
  'value.device.mobile': 'Điện thoại',
  'value.device.tablet': 'Máy tính bảng',

  'billing.perMonth': '{price}/tháng',
  'billing.perYear': '{price}/năm',
  'billing.perThreeDays': '{price}/3 ngày',

  'security.changePassword': 'Đổi mật khẩu của bạn ngay lập tức',
  'security.secureButton': 'Bảo vệ tài khoản của tôi',

  'freeTier.xauusd': 'XAUUSD (vàng) trên M5 và M15',
  'freeTier.marketData': 'Dữ liệu thị trường đầy đủ và lớp phủ chỉ báo',
  'freeTier.noAlerts': 'Không có cảnh báo giá (tính năng PRO)',

  'welcome.title': 'Chào mừng bạn đến với Trading Alerts',
  'welcome.heading': 'Chào mừng bạn đến với Trading Alerts, {name}!',
  'welcome.body':
    'Tài khoản của bạn đã được tạo thành công. Giờ bạn có thể thiết lập cảnh báo giao dịch đầu tiên!',
  'welcome.getStarted': 'Bắt đầu:',
  'welcome.step1': 'Mở biểu đồ XAUUSD trên M5 hoặc M15',
  'welcome.step2': 'Khám phá các lớp phủ kênh giá và cấu trúc',
  'welcome.step3': 'Tùy chỉnh tùy chọn thông báo của bạn',
  'welcome.button': 'Đến bảng điều khiển',
  'welcome.subject': 'Chào mừng bạn đến với Trading Alerts!',

  'affiliateWelcome.title': 'Chào mừng bạn đến với chương trình liên kết',
  'affiliateWelcome.heading': 'Bạn đã là đối tác liên kết, {name}!',
  'affiliateWelcome.body':
    'Tài khoản liên kết của bạn đã được kích hoạt. Chúng tôi đã tạo {count} mã giới thiệu đầu tiên cho bạn — các mã này đã sẵn sàng trong bảng điều khiển.',
  'affiliateWelcome.button': 'Đến bảng điều khiển liên kết',
  'affiliateWelcome.footer':
    'Khoản thanh toán được gửi qua Wise khi số dư của bạn vượt mức tối thiểu hằng tháng. Nếu có bất kỳ câu hỏi nào, hãy trả lời email này hoặc truy cập trung tâm trợ giúp của chúng tôi.',
  'affiliateWelcome.subject': 'Bạn đã là đối tác liên kết - Trading Alerts',

  'verify.heading': 'Xác minh địa chỉ email của bạn',
  'verify.body':
    'Xin chào {name}, hãy nhấp vào nút bên dưới để xác minh địa chỉ email và kích hoạt tài khoản của bạn.',
  'verify.button': 'Xác minh địa chỉ email',
  'verify.ignore':
    'Nếu bạn không tạo tài khoản Trading Alerts, bạn có thể yên tâm bỏ qua email này.',
  'verify.expiry': 'Liên kết này sẽ hết hạn sau 24 giờ.',
  'verify.subject': 'Xác minh email của bạn - Trading Alerts',

  'reset.heading': 'Đặt lại mật khẩu của bạn',
  'reset.body':
    'Xin chào {name}, chúng tôi đã nhận được yêu cầu đặt lại mật khẩu của bạn. Hãy nhấp vào nút bên dưới để tạo mật khẩu mới.',
  'reset.button': 'Đặt lại mật khẩu',
  'reset.ignore':
    'Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.',
  'reset.expiry': 'Liên kết này sẽ hết hạn sau 1 giờ.',
  'reset.subject': 'Đặt lại mật khẩu của bạn - Trading Alerts',

  'newDevice.heading': 'Phát hiện đăng nhập từ thiết bị mới',
  'newDevice.body':
    'Xin chào {name}, chúng tôi phát hiện có đăng nhập vào tài khoản Trading Alerts của bạn từ một thiết bị mới:',
  'newDevice.ifYou':
    '**Nếu là bạn:** không cần làm gì. Bạn có thể yên tâm bỏ qua email này.',
  'newDevice.ifNotYou':
    '**Nếu không phải bạn:** có thể ai đó đã truy cập vào tài khoản của bạn. Chúng tôi khuyên bạn nên:',
  'newDevice.tip2':
    'Xem lại các phiên đang hoạt động và đăng xuất khỏi những thiết bị lạ',
  'newDevice.tip3': 'Bật xác thực hai lớp để tăng cường bảo mật',
  'newDevice.subject': 'Cảnh báo bảo mật: phát hiện đăng nhập từ thiết bị mới',

  'passwordChanged.heading': 'Đã đổi mật khẩu thành công',
  'passwordChanged.body':
    'Xin chào {name}, mật khẩu tài khoản Trading Alerts của bạn đã được thay đổi.',
  'passwordChanged.ifYou':
    '**Nếu là bạn thực hiện thay đổi này:** không cần làm gì. Tài khoản của bạn an toàn.',
  'passwordChanged.ifNotYou':
    '**Nếu bạn không thực hiện thay đổi này:** tài khoản của bạn có thể đã bị xâm nhập. Vui lòng:',
  'passwordChanged.tip1':
    'Đặt lại mật khẩu ngay bằng tính năng "Quên mật khẩu?"',
  'passwordChanged.tip2':
    'Kiểm tra tài khoản xem có thay đổi trái phép nào không',
  'passwordChanged.tip3': 'Liên hệ đội ngũ hỗ trợ nếu bạn cần trợ giúp',
  'passwordChanged.subject': 'Cảnh báo bảo mật: mật khẩu đã được thay đổi',

  'twoFactorEnabled.heading': 'Đã bật xác thực hai lớp',
  'twoFactorEnabled.body':
    'Xin chào {name}, xác thực hai lớp đã được bật thành công cho tài khoản Trading Alerts của bạn.',
  'twoFactorEnabled.remindersHeading': 'Lưu ý quan trọng:',
  'twoFactorEnabled.reminder1': 'Hãy cất giữ mã dự phòng ở nơi an toàn',
  'twoFactorEnabled.reminder2': 'Bạn sẽ cần ứng dụng xác thực để đăng nhập',
  'twoFactorEnabled.reminder3':
    'Nếu mất quyền truy cập vào ứng dụng xác thực, hãy dùng mã dự phòng',
  'twoFactorEnabled.ifNotYou':
    '**Nếu bạn không bật xác thực hai lớp:** tài khoản của bạn có thể đã bị xâm nhập. Vui lòng liên hệ bộ phận hỗ trợ ngay.',
  'twoFactorEnabled.button': 'Quản lý cài đặt bảo mật',
  'twoFactorEnabled.subject': 'Cảnh báo bảo mật: đã bật xác thực hai lớp',

  'twoFactorDisabled.heading': 'Đã tắt xác thực hai lớp',
  'twoFactorDisabled.body':
    'Xin chào {name}, xác thực hai lớp đã được tắt cho tài khoản Trading Alerts của bạn.',
  'twoFactorDisabled.warning':
    'Tài khoản của bạn hiện kém an toàn hơn khi không có xác thực hai lớp.',
  'twoFactorDisabled.ifYou':
    '**Nếu là bạn tắt:** chúng tôi khuyên bạn bật lại để có mức bảo mật cao nhất.',
  'twoFactorDisabled.ifNotYou':
    '**Nếu bạn không tắt:** tài khoản của bạn có thể đã bị xâm nhập. Vui lòng:',
  'twoFactorDisabled.tip2': 'Bật lại xác thực hai lớp',
  'twoFactorDisabled.tip3':
    'Kiểm tra tài khoản xem có thay đổi trái phép nào không',
  'twoFactorDisabled.subject': 'Cảnh báo bảo mật: đã tắt xác thực hai lớp',

  'payoutDetails.heading': 'Thông tin thanh toán đã thay đổi',
  'payoutDetails.body':
    'Xin chào {name}, thông tin thanh toán trên tài khoản đối tác Trading Alerts của bạn đã được thêm hoặc thay đổi.',
  'payoutDetails.holdLabel': 'Khoản thanh toán bị giữ đến:',
  'payoutDetails.hold':
    'Để bảo vệ bạn, các khoản thanh toán đến thông tin này bị giữ trong {hours} giờ. Thu nhập của bạn vẫn an toàn và sẽ được thanh toán khi hết thời gian giữ.',
  'payoutDetails.ifYou':
    '**Nếu bạn thực hiện thay đổi này:** bạn không cần làm gì thêm.',
  'payoutDetails.ifNotYou':
    '**Nếu bạn không thực hiện thay đổi này:** tài khoản của bạn có thể đã bị xâm nhập. Vui lòng:',
  'payoutDetails.tip2':
    'Liên hệ đội ngũ hỗ trợ của chúng tôi trước khi hết thời gian giữ',
  'payoutDetails.tip3':
    'Kiểm tra tài khoản xem có thay đổi trái phép nào không',
  'payoutDetails.subject':
    'Cảnh báo bảo mật: thông tin thanh toán của bạn đã thay đổi',

  'accountDeletion.heading': 'Xác nhận xóa tài khoản của bạn',
  'accountDeletion.body':
    'Xin chào {name}, chúng tôi đã nhận được yêu cầu xóa vĩnh viễn tài khoản Trading Alerts của bạn.',
  'accountDeletion.confirmIntro':
    '**Để tiếp tục,** hãy xác nhận việc xóa bằng nút bên dưới. Thao tác này không thể hoàn tác.',
  'accountDeletion.confirmButton': 'Xác nhận xóa tài khoản',
  'accountDeletion.cancelIntro':
    '**Nếu bạn đã đổi ý, hoặc đây không phải yêu cầu của bạn,** hãy hủy yêu cầu:',
  'accountDeletion.cancelButton': 'Hủy yêu cầu xóa',
  'accountDeletion.expiry':
    'Các liên kết này hết hạn vào {date}. Bất kỳ ai có các liên kết này đều có thể xử lý yêu cầu của bạn, vì vậy vui lòng không chuyển tiếp email này.',
  'accountDeletion.subject': 'Xác nhận xóa tài khoản của bạn - Trading Alerts',

  'subscription.heading': 'Đã xác nhận gói đăng ký!',
  'subscription.body':
    'Xin chào {name}, gói đăng ký **{plan}** của bạn đã được kích hoạt.',
  'subscription.planDetails': 'Chi tiết gói',
  'subscription.tier': 'Cấp độ:',
  'subscription.billing': 'Thanh toán:',
  'subscription.trial':
    'Dùng thử miễn phí 7 ngày: thẻ của bạn sẽ không bị tính phí cho đến khi kết thúc thời gian dùng thử.',
  'subscription.proHeading': 'Bạn nhận được gì với Pro:',
  'subscription.pro1':
    '**100 cảnh báo giá** - Không bỏ lỡ cơ hội giao dịch nào',
  'subscription.pro2':
    '**Cảnh báo đường vẽ của bộ máy vẽ** - Vẽ một đường trên biểu đồ và nhận cảnh báo khi giá chạm vào',
  'subscription.pro3':
    '**Hiển thị đa khung thời gian** - Phủ cấu trúc M5 lên biểu đồ M15',
  'subscription.pro4':
    '**Thông tin độc quyền về XAUUSD** - Dữ liệu chỉ báo M5/M15 đầy đủ (cả 79 cột)',
  'subscription.pro5': '**300 yêu cầu API mỗi giờ**',
  'subscription.pro6': '**Hỗ trợ ưu tiên và xuất dữ liệu**',
  'subscription.freeHeading': 'Gói miễn phí của bạn bao gồm:',
  'subscription.free1': '**XAUUSD (vàng)** - biểu đồ M5 và M15',
  'subscription.free2':
    '**Dữ liệu chỉ báo đầy đủ** - Cùng dữ liệu thị trường như gói Pro',
  'subscription.free3': '**60 yêu cầu API mỗi giờ**',
  'subscription.upgradeLead':
    '{link} để có cảnh báo, cảnh báo đường vẽ và chế độ xem đa khung thời gian!',
  'subscription.upgradeLink': 'Nâng cấp lên Pro',
  'subscription.subject': 'Đã xác nhận gói đăng ký {plan}',

  'cancellation.heading': 'Đã hủy gói đăng ký',
  'cancellation.body': 'Gói đăng ký PRO {app} của bạn đã được hủy.',
  'cancellation.freeAccess': 'Bạn hiện có quyền truy cập cấp độ FREE:',
  'cancellation.changedMind': 'Bạn đã đổi ý?',
  'cancellation.upgradeAgain':
    'Bạn có thể nâng cấp lại bất cứ lúc nào để lấy lại quyền truy cập mọi tính năng PRO.',
  'cancellation.button': 'Xem bảng giá',
  'cancellation.thanks': 'Cảm ơn bạn đã dùng thử PRO!',
  'cancellation.subject': 'Gói đăng ký PRO của bạn đã được hủy',

  'paymentFailed.heading': 'Thanh toán thất bại',
  'paymentFailed.body':
    'Chúng tôi không thể xử lý khoản thanh toán của bạn cho {app} PRO ({amount}).',
  'paymentFailed.reason': '**Lý do:** {reason}',
  'paymentFailed.action':
    '**Vui lòng cập nhật phương thức thanh toán trong vòng 3 ngày** để giữ quyền truy cập PRO.',
  'paymentFailed.button': 'Cập nhật phương thức thanh toán',
  'paymentFailed.downgrade':
    'Nếu không được giải quyết, tài khoản của bạn sẽ bị hạ xuống cấp độ FREE.',
  'paymentFailed.subject': 'Thanh toán thất bại - Cần thực hiện thao tác',

  'receipt.title': 'Biên lai thanh toán',
  'receipt.heading': 'Thanh toán thành công',
  'receipt.body': 'Khoản thanh toán của bạn đã thành công!',
  'receipt.description': 'Mô tả',
  'receipt.descriptionValue': '{app} PRO - Hằng tháng',
  'receipt.amount': 'Số tiền',
  'receipt.date': 'Ngày',
  'receipt.nextBilling': 'Ngày thanh toán tiếp theo',
  'receipt.button': 'Tải hóa đơn',
  'receipt.thanks': 'Cảm ơn bạn đã là thành viên PRO!',
  'receipt.subject': 'Biên lai thanh toán - {app} PRO',

  'canceled.heading': 'Đã hủy gói đăng ký',
  'canceled.body': 'Gói đăng ký **{plan}** của bạn đã được hủy.',
  'canceled.accessUntil': '**Quyền truy cập đến hết:** {date}',
  'canceled.accessNote': 'Bạn vẫn có quyền truy cập {plan} cho đến {date}.',
  'canceled.afterwards':
    'Sau đó, tài khoản của bạn sẽ trở về gói **Free** với:',
  'canceled.reactivate': 'Bạn đã đổi ý? {link}',
  'canceled.reactivateLink': 'Kích hoạt lại gói đăng ký',
  'canceled.subject': 'Đã hủy gói đăng ký - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': 'Đã tiếp tục gói đăng ký',
  'resumed.body': 'Gói đăng ký **{plan}** của bạn sẽ tiếp tục.',
  'resumed.nextBilling': '**Ngày thanh toán tiếp theo:** {date}',
  'resumed.note':
    'Yêu cầu hủy của bạn đã được rút lại. Bạn vẫn giữ toàn bộ quyền truy cập {plan} và gói đăng ký sẽ tự động gia hạn vào {date}.',
  'resumed.manage': 'Bạn có thể xem lại gói đăng ký bất cứ lúc nào. {link}',
  'resumed.manageLink': 'Mở cài đặt thanh toán',
  'resumed.subject': 'Gói đăng ký {plan} của bạn sẽ tiếp tục - Trading Alerts',

  // ── Plan change: upgraded to yearly, switch to monthly scheduled (S3) ──
  'upgraded.heading': 'Đã chuyển sang thanh toán hằng năm',
  'upgraded.body':
    'Gói đăng ký **{plan}** của bạn giờ được thanh toán hằng năm.',
  'upgraded.charged': '**Đã thu hôm nay:** {amount}',
  'upgraded.price': '**Giá theo năm:** {price}',
  'upgraded.nextBilling': '**Ngày thanh toán tiếp theo:** {date}',
  'upgraded.firstCharge': '**Lần thu đầu tiên:** {date}',
  'upgraded.note':
    'Khoản thu hôm nay là giá theo năm trừ đi tín dụng cho phần chưa sử dụng của kỳ hằng tháng hiện tại.',
  'upgraded.trialNote':
    'Thời gian dùng thử miễn phí của bạn vẫn tiếp tục và hôm nay chưa thu khoản nào. Lần thu đầu tiên, theo giá năm, sẽ diễn ra vào {date}.',
  'upgraded.subject': 'Bạn hiện đang thanh toán hằng năm - Trading Alerts',
  'switchScheduled.heading': 'Đã lên lịch chuyển sang thanh toán hằng tháng',
  'switchScheduled.body':
    'Gói đăng ký **{plan}** của bạn sẽ chuyển sang thanh toán hằng tháng vào {date}.',
  'switchScheduled.date': '**Ngày chuyển:** {date}',
  'switchScheduled.price': '**Giá hằng tháng từ lúc đó:** {price}',
  'switchScheduled.note':
    'Bạn vẫn giữ quyền truy cập theo năm cho đến {date}. Hiện không có khoản nào được thu hay hoàn lại, và không có tín dụng cho năm hiện tại.',
  'switchScheduled.keep':
    'Bạn đổi ý? Bạn có thể giữ thanh toán hằng năm trước thời điểm đó. {link}',
  'switchScheduled.subject':
    'Đã lên lịch việc chuyển sang thanh toán hằng tháng của bạn - Trading Alerts',
  'planChange.manage': 'Bạn có thể xem lại gói đăng ký bất cứ lúc nào. {link}',
  'planChange.manageLink': 'Mở cài đặt thanh toán',

  'commission.heading': 'Bạn đã nhận được hoa hồng!',
  'commission.body':
    'Tin vui! Mã liên kết của bạn vừa được sử dụng và bạn đã nhận được hoa hồng.',
  'commission.codeUsed': 'Mã đã dùng',
  'commission.earned': 'Hoa hồng nhận được',
  'commission.total': 'Tổng thu nhập',
  'commission.rate': '**Tỷ lệ hoa hồng:** {percent}% doanh thu gói đăng ký',
  'commission.button': 'Xem bảng điều khiển',
  'commission.subject': 'Bạn đã nhận được hoa hồng! {amount} - {app}',
};
