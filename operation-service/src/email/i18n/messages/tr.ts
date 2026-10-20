import type { EmailMessages } from './en-US';

export const tr: EmailMessages = {
  'common.greeting': 'Merhaba {name},',
  'common.userFallback': 'Kullanıcı',
  'common.questions':
    'Herhangi bir sorunuz varsa bu e-postayı yanıtlayın veya yardım merkezimizi ziyaret edin.',
  'common.signature': '{app} Ekibi',
  'common.needHelpContact':
    'Yardıma mı ihtiyacınız var? Bize {email} adresinden ulaşın',
  'common.needHelpReply':
    'Yardıma mı ihtiyacınız var? Bu e-postayı yanıtlayın veya bize {email} adresinden ulaşın',
  'common.securityAlertsNote':
    'Güvenlik uyarıları açık olduğu için bu e-postayı alıyorsunuz.',
  'common.manageNotifications': 'Bildirim tercihlerini yönet',

  'label.time': 'Zaman:',
  'label.location': 'Konum:',
  'label.ipAddress': 'IP Adresi:',
  'label.device': 'Cihaz:',
  'label.browser': 'Tarayıcı:',
  'label.os': 'İşletim Sistemi:',

  'value.unknown': 'Bilinmiyor',
  'value.unknownLocation': 'Bilinmeyen konum',
  'value.device.desktop': 'Masaüstü',
  'value.device.mobile': 'Mobil',
  'value.device.tablet': 'Tablet',

  'billing.perMonth': '{price}/ay',
  'billing.perYear': '{price}/yıl',
  'billing.perThreeDays': '{price}/3 gün',

  'security.changePassword': 'Parolanızı hemen değiştirin',
  'security.secureButton': 'Hesabımı Güvene Al',

  'freeTier.xauusd': 'M5 ve M15 üzerinde XAUUSD (altın)',
  'freeTier.marketData': 'Tam piyasa verileri ve gösterge katmanları',
  'freeTier.noAlerts': 'Fiyat uyarısı yok (PRO özelliği)',

  'welcome.title': "Trading Alerts'e Hoş Geldiniz",
  'welcome.heading': "Trading Alerts'e hoş geldiniz, {name}!",
  'welcome.body':
    'Hesabınız başarıyla oluşturuldu. Artık ilk işlem uyarınızı oluşturmaya hazırsınız!',
  'welcome.getStarted': 'Başlarken:',
  'welcome.step1': 'M5 veya M15 üzerinde XAUUSD grafiğini açın',
  'welcome.step2': 'Kanal ve yapı katmanlarını keşfedin',
  'welcome.step3': 'Bildirim tercihlerinizi özelleştirin',
  'welcome.button': 'Kontrol Paneline Git',
  'welcome.subject': "Trading Alerts'e hoş geldiniz!",

  'affiliateWelcome.title': 'Ortaklık Programına Hoş Geldiniz',
  'affiliateWelcome.heading': 'Artık bir ortaksınız, {name}!',
  'affiliateWelcome.body':
    'Ortaklık hesabınız etkin. İlk {count} yönlendirme kodunuzu oluşturduk; kodlar şu anda kontrol panelinizde hazır.',
  'affiliateWelcome.button': 'Ortaklık Kontrol Paneline Git',
  'affiliateWelcome.footer':
    'Bakiyeniz aylık asgari tutarı aştığında ödemeler Wise ile gönderilir. Herhangi bir sorunuz varsa bu e-postayı yanıtlayın veya yardım merkezimizi ziyaret edin.',
  'affiliateWelcome.subject': 'Artık bir ortaksınız - Trading Alerts',

  'verify.heading': 'E-posta Adresinizi Doğrulayın',
  'verify.body':
    'Merhaba {name}, e-posta adresinizi doğrulamak ve hesabınızı etkinleştirmek için aşağıdaki düğmeye tıklayın.',
  'verify.button': 'E-posta Adresini Doğrula',
  'verify.ignore':
    "Trading Alerts'te hesap oluşturmadıysanız bu e-postayı güvenle yok sayabilirsiniz.",
  'verify.expiry': 'Bu bağlantının süresi 24 saat içinde dolacak.',
  'verify.subject': 'E-postanızı doğrulayın - Trading Alerts',

  'reset.heading': 'Parolanızı Sıfırlayın',
  'reset.body':
    'Merhaba {name}, parolanızı sıfırlama isteği aldık. Yeni bir parola oluşturmak için aşağıdaki düğmeye tıklayın.',
  'reset.button': 'Parolayı Sıfırla',
  'reset.ignore':
    'Parola sıfırlama isteğinde bulunmadıysanız bu e-postayı yok sayabilirsiniz. Parolanız değişmeyecektir.',
  'reset.expiry': 'Bu bağlantının süresi 1 saat içinde dolacak.',
  'reset.subject': 'Parolanızı sıfırlayın - Trading Alerts',

  'newDevice.heading': 'Yeni Cihazdan Giriş Algılandı',
  'newDevice.body':
    'Merhaba {name}, Trading Alerts hesabınıza yeni bir cihazdan giriş yapıldığını fark ettik:',
  'newDevice.ifYou':
    '**Siz yaptıysanız:** Herhangi bir işlem gerekmez. Bu e-postayı güvenle yok sayabilirsiniz.',
  'newDevice.ifNotYou':
    '**Siz yapmadıysanız:** Hesabınıza başka biri erişmiş olabilir. Şunları öneririz:',
  'newDevice.tip2':
    'Etkin oturumlarınızı gözden geçirin ve tanımadığınız cihazlardan çıkış yapın',
  'newDevice.tip3': 'Ek güvenlik için iki adımlı doğrulamayı etkinleştirin',
  'newDevice.subject': 'Güvenlik Uyarısı: Yeni Cihazdan Giriş Algılandı',

  'passwordChanged.heading': 'Parola Başarıyla Değiştirildi',
  'passwordChanged.body':
    'Merhaba {name}, Trading Alerts hesabınızın parolası değiştirildi.',
  'passwordChanged.ifYou':
    '**Bu değişikliği siz yaptıysanız:** Herhangi bir işlem gerekmez. Hesabınız güvende.',
  'passwordChanged.ifNotYou':
    '**Bu değişikliği siz yapmadıysanız:** Hesabınız ele geçirilmiş olabilir. Lütfen:',
  'passwordChanged.tip1':
    '"Parolanızı mı unuttunuz?" özelliğini kullanarak parolanızı hemen sıfırlayın',
  'passwordChanged.tip2':
    'Hesabınızda yetkisiz değişiklik olup olmadığını kontrol edin',
  'passwordChanged.tip3':
    'Yardıma ihtiyacınız olursa destek ekibimizle iletişime geçin',
  'passwordChanged.subject': 'Güvenlik Uyarısı: Parola Değiştirildi',

  'twoFactorEnabled.heading': 'İki Adımlı Doğrulama Etkinleştirildi',
  'twoFactorEnabled.body':
    'Merhaba {name}, Trading Alerts hesabınızda iki adımlı doğrulama başarıyla etkinleştirildi.',
  'twoFactorEnabled.remindersHeading': 'Önemli Hatırlatmalar:',
  'twoFactorEnabled.reminder1': 'Yedek kodlarınızı güvenli bir yerde saklayın',
  'twoFactorEnabled.reminder2':
    'Giriş yapmak için kimlik doğrulayıcı uygulamanıza ihtiyacınız olacak',
  'twoFactorEnabled.reminder3':
    'Kimlik doğrulayıcıya erişimi kaybederseniz yedek kod kullanın',
  'twoFactorEnabled.ifNotYou':
    '**İki adımlı doğrulamayı siz etkinleştirmediyseniz:** Hesabınız ele geçirilmiş olabilir. Lütfen hemen destekle iletişime geçin.',
  'twoFactorEnabled.button': 'Güvenlik Ayarlarını Yönet',
  'twoFactorEnabled.subject':
    'Güvenlik Uyarısı: İki Adımlı Doğrulama Etkinleştirildi',

  'twoFactorDisabled.heading': 'İki Adımlı Doğrulama Devre Dışı Bırakıldı',
  'twoFactorDisabled.body':
    'Merhaba {name}, Trading Alerts hesabınızda iki adımlı doğrulama devre dışı bırakıldı.',
  'twoFactorDisabled.warning':
    'İki adımlı doğrulama olmadan hesabınız artık daha az güvenli.',
  'twoFactorDisabled.ifYou':
    '**Bunu siz yaptıysanız:** Azami güvenlik için yeniden etkinleştirmenizi öneririz.',
  'twoFactorDisabled.ifNotYou':
    '**Bunu siz yapmadıysanız:** Hesabınız ele geçirilmiş olabilir. Lütfen:',
  'twoFactorDisabled.tip2': 'İki adımlı doğrulamayı yeniden etkinleştirin',
  'twoFactorDisabled.tip3':
    'Hesabınızda yetkisiz değişiklik olup olmadığını kontrol edin',
  'twoFactorDisabled.subject':
    'Güvenlik Uyarısı: İki Adımlı Doğrulama Devre Dışı Bırakıldı',

  'accountDeletion.heading': 'Hesabınızın Silinmesini Onaylayın',
  'accountDeletion.body':
    'Merhaba {name}, Trading Alerts hesabınızı kalıcı olarak silme isteği aldık.',
  'accountDeletion.confirmIntro':
    '**Devam etmek için** aşağıdaki düğmeyle silme işlemini onaylayın. Bu işlem geri alınamaz.',
  'accountDeletion.confirmButton': 'Hesap Silmeyi Onayla',
  'accountDeletion.cancelIntro':
    '**Fikrinizi değiştirdiyseniz veya bu istek size ait değilse,** bunun yerine isteği iptal edin:',
  'accountDeletion.cancelButton': 'Silme İsteğini İptal Et',
  'accountDeletion.expiry':
    'Bu bağlantıların süresi {date} tarihinde dolacak. Bu bağlantılara sahip olan herkes isteğiniz üzerinde işlem yapabilir; bu nedenle lütfen bu e-postayı iletmeyin.',
  'accountDeletion.subject':
    'Hesabınızın silinmesini onaylayın - Trading Alerts',

  'subscription.heading': 'Abonelik Onaylandı!',
  'subscription.body': 'Merhaba {name}, **{plan}** aboneliğiniz artık etkin.',
  'subscription.planDetails': 'Plan Ayrıntıları',
  'subscription.tier': 'Seviye:',
  'subscription.billing': 'Faturalandırma:',
  'subscription.trial':
    '7 Günlük Ücretsiz Deneme: Deneme süreniz bitene kadar kartınızdan ücret alınmaz.',
  'subscription.proHeading': 'Pro ile Neler Elde Edersiniz:',
  'subscription.pro1':
    '**100 Fiyat Uyarısı** - Hiçbir işlem fırsatını kaçırmayın',
  'subscription.pro2':
    '**Çizim Motoru Çizgi Uyarıları** - Grafiğe bir çizgi çizin, fiyat çizgiye dokunduğunda uyarı alın',
  'subscription.pro3':
    '**Çoklu Zaman Dilimi Görselleştirmesi** - M5 yapısını M15 grafiklerinin üzerine bindirin',
  'subscription.pro4':
    '**Özel XAUUSD Analizleri** - Tam M5/M15 gösterge verileri (79 sütunun tamamı)',
  'subscription.pro5': '**Saatte 300 API İsteği**',
  'subscription.pro6': '**Öncelikli Destek ve Veri Dışa Aktarma**',
  'subscription.freeHeading': 'Ücretsiz Planınız Şunları İçerir:',
  'subscription.free1': '**XAUUSD (Altın)** - M5 ve M15 grafikleri',
  'subscription.free2':
    '**Tam Gösterge Verileri** - Pro ile aynı piyasa verileri',
  'subscription.free3': '**Saatte 60 API İsteği**',
  'subscription.upgradeLead':
    'Uyarılar, çizgi uyarıları ve çoklu zaman dilimi görünümü için {link}!',
  'subscription.upgradeLink': "Pro'ya geçin",
  'subscription.subject': '{plan} Aboneliği Onaylandı',

  'cancellation.heading': 'Abonelik İptal Edildi',
  'cancellation.body': '{app} PRO aboneliğiniz iptal edildi.',
  'cancellation.freeAccess': 'Artık FREE seviyesine erişiminiz var:',
  'cancellation.changedMind': 'Fikrinizi mi değiştirdiniz?',
  'cancellation.upgradeAgain':
    'Tüm PRO özelliklerine yeniden erişmek için istediğiniz zaman tekrar yükseltebilirsiniz.',
  'cancellation.button': 'Fiyatlandırmayı Görüntüle',
  'cancellation.thanks': "PRO'yu denediğiniz için teşekkürler!",
  'cancellation.subject': 'PRO aboneliğiniz iptal edildi',

  'paymentFailed.heading': 'Ödeme Başarısız',
  'paymentFailed.body': '{app} PRO ({amount}) için ödemenizi işleyemedik.',
  'paymentFailed.reason': '**Neden:** {reason}',
  'paymentFailed.action':
    'PRO erişiminizi korumak için **lütfen 3 gün içinde ödeme yönteminizi güncelleyin.**',
  'paymentFailed.button': 'Ödeme Yöntemini Güncelle',
  'paymentFailed.downgrade':
    'Sorun çözülmezse hesabınız FREE seviyesine düşürülecektir.',
  'paymentFailed.subject': 'Ödeme Başarısız - İşlem Gerekli',

  'receipt.title': 'Ödeme Makbuzu',
  'receipt.heading': 'Ödeme Başarılı',
  'receipt.body': 'Ödemeniz başarıyla alındı!',
  'receipt.description': 'Açıklama',
  'receipt.descriptionValue': '{app} PRO - Aylık',
  'receipt.amount': 'Tutar',
  'receipt.date': 'Tarih',
  'receipt.nextBilling': 'Sonraki fatura tarihi',
  'receipt.button': 'Faturayı İndir',
  'receipt.thanks': 'PRO üyesi olduğunuz için teşekkürler!',
  'receipt.subject': 'Ödeme Makbuzu - {app} PRO',

  'canceled.heading': 'Abonelik İptal Edildi',
  'canceled.body': '**{plan}** aboneliğiniz iptal edildi.',
  'canceled.accessUntil': '**Erişim Bitiş Tarihi:** {date}',
  'canceled.accessNote':
    '{date} tarihine kadar {plan} erişiminiz devam edecek.',
  'canceled.afterwards':
    'Bundan sonra hesabınız şunları içeren **Free** plana dönecek:',
  'canceled.reactivate': 'Fikrinizi mi değiştirdiniz? {link}',
  'canceled.reactivateLink': 'Aboneliğinizi yeniden etkinleştirin',
  'canceled.subject': 'Abonelik İptal Edildi - Trading Alerts',

  'commission.heading': 'Komisyon Kazandınız!',
  'commission.body':
    'Harika haber! Ortaklık kodunuz az önce kullanıldı ve komisyon kazandınız.',
  'commission.codeUsed': 'Kullanılan Kod',
  'commission.earned': 'Kazanılan Komisyon',
  'commission.total': 'Toplam Kazanç',
  'commission.rate': "**Komisyon Oranı:** abonelik gelirinin %{percent}'i",
  'commission.button': 'Kontrol Panelini Görüntüle',
  'commission.subject': 'Komisyon Kazandınız! {amount} - {app}',
};
