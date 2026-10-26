import type { EmailMessages } from './en-US';

export const id: EmailMessages = {
  'common.greeting': 'Halo {name},',
  'common.userFallback': 'Pengguna',
  'common.questions':
    'Jika ada pertanyaan, balas email ini atau kunjungi pusat bantuan kami.',
  'common.signature': 'Tim {app}',
  'common.needHelpContact': 'Butuh bantuan? Hubungi kami di {email}',
  'common.needHelpReply':
    'Butuh bantuan? Balas email ini atau hubungi kami di {email}',
  'common.securityAlertsNote':
    'Anda menerima email ini karena peringatan keamanan diaktifkan.',
  'common.manageNotifications': 'Kelola preferensi notifikasi',

  'label.time': 'Waktu:',
  'label.location': 'Lokasi:',
  'label.ipAddress': 'Alamat IP:',
  'label.device': 'Perangkat:',
  'label.browser': 'Browser:',
  'label.os': 'Sistem operasi:',

  'value.unknown': 'Tidak diketahui',
  'value.unknownLocation': 'Lokasi tidak diketahui',
  'value.device.desktop': 'Desktop',
  'value.device.mobile': 'Ponsel',
  'value.device.tablet': 'Tablet',

  'billing.perMonth': '{price}/bulan',
  'billing.perYear': '{price}/tahun',
  'billing.perThreeDays': '{price}/3 hari',

  'security.changePassword': 'Segera ubah kata sandi Anda',
  'security.secureButton': 'Amankan akun saya',

  'freeTier.xauusd': 'XAUUSD (emas) di M5 dan M15',
  'freeTier.marketData': 'Data pasar lengkap dan overlay indikator',
  'freeTier.noAlerts': 'Tanpa peringatan harga (fitur PRO)',

  'welcome.title': 'Selamat datang di Trading Alerts',
  'welcome.heading': 'Selamat datang di Trading Alerts, {name}!',
  'welcome.body':
    'Akun Anda berhasil dibuat. Sekarang Anda siap membuat peringatan trading pertama!',
  'welcome.getStarted': 'Mulai:',
  'welcome.step1': 'Buka grafik XAUUSD di M5 atau M15',
  'welcome.step2': 'Jelajahi overlay kanal dan struktur',
  'welcome.step3': 'Sesuaikan preferensi notifikasi Anda',
  'welcome.button': 'Buka Dasbor',
  'welcome.subject': 'Selamat datang di Trading Alerts!',

  'affiliateWelcome.title': 'Selamat datang di Program Afiliasi',
  'affiliateWelcome.heading': 'Anda kini mitra afiliasi, {name}!',
  'affiliateWelcome.body':
    'Akun afiliasi Anda aktif. Kami telah membuat {count} kode referral pertama Anda — kode tersebut sudah tersedia di dasbor Anda.',
  'affiliateWelcome.button': 'Buka Dasbor Afiliasi',
  'affiliateWelcome.footer':
    'Pembayaran dikirim melalui Wise setelah saldo Anda melewati batas minimum bulanan. Jika ada pertanyaan, balas email ini atau kunjungi pusat bantuan kami.',
  'affiliateWelcome.subject': 'Anda kini mitra afiliasi - Trading Alerts',

  'verify.heading': 'Verifikasi alamat email Anda',
  'verify.body':
    'Halo {name}, klik tombol di bawah untuk memverifikasi alamat email dan mengaktifkan akun Anda.',
  'verify.button': 'Verifikasi alamat email',
  'verify.ignore':
    'Jika Anda tidak membuat akun Trading Alerts, abaikan saja email ini.',
  'verify.expiry': 'Tautan ini akan kedaluwarsa dalam 24 jam.',
  'verify.subject': 'Verifikasi email Anda - Trading Alerts',

  'reset.heading': 'Atur ulang kata sandi Anda',
  'reset.body':
    'Halo {name}, kami menerima permintaan untuk mengatur ulang kata sandi Anda. Klik tombol di bawah untuk membuat kata sandi baru.',
  'reset.button': 'Atur ulang kata sandi',
  'reset.ignore':
    'Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan saja email ini. Kata sandi Anda tidak akan berubah.',
  'reset.expiry': 'Tautan ini akan kedaluwarsa dalam 1 jam.',
  'reset.subject': 'Atur ulang kata sandi Anda - Trading Alerts',

  'newDevice.heading': 'Login dari perangkat baru terdeteksi',
  'newDevice.body':
    'Halo {name}, kami mendeteksi login ke akun Trading Alerts Anda dari perangkat baru:',
  'newDevice.ifYou':
    '**Jika itu Anda:** tidak perlu melakukan apa pun. Abaikan saja email ini.',
  'newDevice.ifNotYou':
    '**Jika itu bukan Anda:** seseorang mungkin memiliki akses ke akun Anda. Kami menyarankan Anda untuk:',
  'newDevice.tip2':
    'Periksa sesi aktif Anda dan keluar dari perangkat yang tidak dikenal',
  'newDevice.tip3': 'Aktifkan autentikasi dua faktor untuk keamanan tambahan',
  'newDevice.subject':
    'Peringatan keamanan: login dari perangkat baru terdeteksi',

  'passwordChanged.heading': 'Kata sandi berhasil diubah',
  'passwordChanged.body':
    'Halo {name}, kata sandi akun Trading Alerts Anda telah diubah.',
  'passwordChanged.ifYou':
    '**Jika Anda yang melakukan perubahan ini:** tidak perlu melakukan apa pun. Akun Anda aman.',
  'passwordChanged.ifNotYou':
    '**Jika bukan Anda yang melakukan perubahan ini:** akun Anda mungkin telah diretas. Mohon:',
  'passwordChanged.tip1':
    'Segera atur ulang kata sandi Anda dengan fitur "Lupa kata sandi?"',
  'passwordChanged.tip2': 'Periksa akun Anda dari perubahan yang tidak sah',
  'passwordChanged.tip3': 'Hubungi tim dukungan kami jika Anda butuh bantuan',
  'passwordChanged.subject': 'Peringatan keamanan: kata sandi diubah',

  'twoFactorEnabled.heading': 'Autentikasi dua faktor diaktifkan',
  'twoFactorEnabled.body':
    'Halo {name}, autentikasi dua faktor berhasil diaktifkan di akun Trading Alerts Anda.',
  'twoFactorEnabled.remindersHeading': 'Pengingat penting:',
  'twoFactorEnabled.reminder1': 'Simpan kode cadangan Anda di tempat yang aman',
  'twoFactorEnabled.reminder2':
    'Anda akan memerlukan aplikasi autentikator untuk masuk',
  'twoFactorEnabled.reminder3':
    'Jika Anda kehilangan akses ke autentikator, gunakan kode cadangan',
  'twoFactorEnabled.ifNotYou':
    '**Jika Anda tidak mengaktifkan autentikasi dua faktor:** akun Anda mungkin telah diretas. Segera hubungi dukungan.',
  'twoFactorEnabled.button': 'Kelola pengaturan keamanan',
  'twoFactorEnabled.subject':
    'Peringatan keamanan: autentikasi dua faktor diaktifkan',

  'twoFactorDisabled.heading': 'Autentikasi dua faktor dinonaktifkan',
  'twoFactorDisabled.body':
    'Halo {name}, autentikasi dua faktor telah dinonaktifkan di akun Trading Alerts Anda.',
  'twoFactorDisabled.warning':
    'Akun Anda kini kurang aman tanpa autentikasi dua faktor.',
  'twoFactorDisabled.ifYou':
    '**Jika Anda yang menonaktifkannya:** kami menyarankan mengaktifkannya kembali demi keamanan maksimal.',
  'twoFactorDisabled.ifNotYou':
    '**Jika bukan Anda yang menonaktifkannya:** akun Anda mungkin telah diretas. Mohon:',
  'twoFactorDisabled.tip2': 'Aktifkan kembali autentikasi dua faktor',
  'twoFactorDisabled.tip3': 'Periksa akun Anda dari perubahan yang tidak sah',
  'twoFactorDisabled.subject':
    'Peringatan keamanan: autentikasi dua faktor dinonaktifkan',

  'payoutDetails.heading': 'Detail Pembayaran Diubah',
  'payoutDetails.body':
    'Halo {name}, detail pembayaran di akun afiliasi Trading Alerts Anda telah ditambahkan atau diubah.',
  'payoutDetails.holdLabel': 'Pembayaran ditahan hingga:',
  'payoutDetails.hold':
    'Demi perlindungan Anda, pembayaran ke detail ini ditahan selama {hours} jam. Pendapatan Anda aman dan akan dibayarkan setelah masa penahanan berakhir.',
  'payoutDetails.ifYou':
    '**Jika Anda yang melakukan perubahan ini:** tidak ada tindakan yang diperlukan.',
  'payoutDetails.ifNotYou':
    '**Jika bukan Anda yang melakukan perubahan ini:** akun Anda mungkin telah diretas. Mohon:',
  'payoutDetails.tip2':
    'Hubungi tim dukungan kami sebelum masa penahanan berakhir',
  'payoutDetails.tip3': 'Periksa akun Anda dari perubahan yang tidak sah',
  'payoutDetails.subject': 'Peringatan keamanan: detail pembayaran Anda diubah',

  'accountDeletion.heading': 'Konfirmasi penghapusan akun Anda',
  'accountDeletion.body':
    'Halo {name}, kami menerima permintaan untuk menghapus akun Trading Alerts Anda secara permanen.',
  'accountDeletion.confirmIntro':
    '**Untuk melanjutkan,** konfirmasikan penghapusan dengan tombol di bawah. Tindakan ini tidak dapat dibatalkan.',
  'accountDeletion.confirmButton': 'Konfirmasi penghapusan akun',
  'accountDeletion.cancelIntro':
    '**Jika Anda berubah pikiran, atau ini bukan Anda,** batalkan permintaan ini:',
  'accountDeletion.cancelButton': 'Batalkan permintaan penghapusan',
  'accountDeletion.expiry':
    'Tautan ini kedaluwarsa pada {date}. Siapa pun yang memiliki tautan ini dapat bertindak atas permintaan Anda, jadi jangan teruskan email ini.',
  'accountDeletion.subject':
    'Konfirmasi penghapusan akun Anda - Trading Alerts',

  'subscription.heading': 'Langganan dikonfirmasi!',
  'subscription.body': 'Halo {name}, langganan **{plan}** Anda kini aktif.',
  'subscription.planDetails': 'Detail paket',
  'subscription.tier': 'Tingkat:',
  'subscription.billing': 'Penagihan:',
  'subscription.trial':
    'Uji coba gratis 7 hari: kartu Anda tidak akan ditagih sampai uji coba berakhir.',
  'subscription.proHeading': 'Yang Anda dapatkan dengan Pro:',
  'subscription.pro1':
    '**100 peringatan harga** - Jangan lewatkan peluang trading',
  'subscription.pro2':
    '**Peringatan garis mesin gambar** - Gambar garis di grafik, lalu dapatkan peringatan saat harga menyentuhnya',
  'subscription.pro3':
    '**Visualisasi multi-timeframe** - Tumpuk struktur M5 pada grafik M15',
  'subscription.pro4':
    '**Wawasan eksklusif XAUUSD** - Data indikator M5/M15 lengkap (semua 79 kolom)',
  'subscription.pro5': '**300 permintaan API per jam**',
  'subscription.pro6': '**Dukungan prioritas dan ekspor data**',
  'subscription.freeHeading': 'Paket gratis Anda mencakup:',
  'subscription.free1': '**XAUUSD (emas)** - grafik M5 dan M15',
  'subscription.free2':
    '**Data indikator lengkap** - Data pasar yang sama dengan Pro',
  'subscription.free3': '**60 permintaan API per jam**',
  'subscription.upgradeLead':
    '{link} untuk mendapatkan peringatan, peringatan garis, dan tampilan multi-timeframe!',
  'subscription.upgradeLink': 'Upgrade ke Pro',
  'subscription.subject': 'Langganan {plan} dikonfirmasi',

  'cancellation.heading': 'Langganan dibatalkan',
  'cancellation.body': 'Langganan {app} PRO Anda telah dibatalkan.',
  'cancellation.freeAccess': 'Kini Anda memiliki akses tingkat FREE:',
  'cancellation.changedMind': 'Berubah pikiran?',
  'cancellation.upgradeAgain':
    'Anda dapat upgrade lagi kapan saja untuk mendapatkan kembali akses ke semua fitur PRO.',
  'cancellation.button': 'Lihat Harga',
  'cancellation.thanks': 'Terima kasih telah mencoba PRO!',
  'cancellation.subject': 'Langganan PRO Anda telah dibatalkan',

  'paymentFailed.heading': 'Pembayaran gagal',
  'paymentFailed.body':
    'Kami tidak dapat memproses pembayaran Anda untuk {app} PRO ({amount}).',
  'paymentFailed.reason': '**Alasan:** {reason}',
  'paymentFailed.action':
    '**Mohon perbarui metode pembayaran Anda dalam 3 hari** agar akses PRO Anda tetap aktif.',
  'paymentFailed.button': 'Perbarui metode pembayaran',
  'paymentFailed.downgrade':
    'Jika tidak diselesaikan, akun Anda akan diturunkan ke tingkat FREE.',
  'paymentFailed.subject': 'Pembayaran gagal - Tindakan diperlukan',

  'receipt.title': 'Tanda terima pembayaran',
  'receipt.heading': 'Pembayaran berhasil',
  'receipt.body': 'Pembayaran Anda berhasil!',
  'receipt.description': 'Deskripsi',
  'receipt.descriptionValue': '{app} PRO - Bulanan',
  'receipt.amount': 'Jumlah',
  'receipt.date': 'Tanggal',
  'receipt.nextBilling': 'Tanggal penagihan berikutnya',
  'receipt.button': 'Unduh faktur',
  'receipt.thanks': 'Terima kasih telah menjadi anggota PRO!',
  'receipt.subject': 'Tanda terima pembayaran - {app} PRO',

  'canceled.heading': 'Langganan dibatalkan',
  'canceled.body': 'Langganan **{plan}** Anda telah dibatalkan.',
  'canceled.accessUntil': '**Akses hingga:** {date}',
  'canceled.accessNote': 'Anda tetap memiliki akses {plan} hingga {date}.',
  'canceled.afterwards':
    'Setelah itu, akun Anda akan kembali ke paket **Free** yang mencakup:',
  'canceled.reactivate': 'Berubah pikiran? {link}',
  'canceled.reactivateLink': 'Aktifkan kembali langganan Anda',
  'canceled.subject': 'Langganan dibatalkan - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': 'Langganan dilanjutkan',
  'resumed.body': 'Langganan **{plan}** Anda akan tetap berlanjut.',
  'resumed.nextBilling': '**Tanggal penagihan berikutnya:** {date}',
  'resumed.note':
    'Pembatalan Anda telah ditarik. Anda tetap memiliki akses {plan} penuh dan langganan Anda diperpanjang otomatis pada {date}.',
  'resumed.manage': 'Anda dapat meninjau langganan Anda kapan saja. {link}',
  'resumed.manageLink': 'Buka pengaturan penagihan',
  'resumed.subject':
    'Langganan {plan} Anda akan tetap berlanjut - Trading Alerts',

  // ── Plan change: upgraded to yearly, switch to monthly scheduled (S3) ──
  'upgraded.heading': 'Beralih ke penagihan tahunan',
  'upgraded.body': 'Langganan **{plan}** Anda sekarang ditagih setiap tahun.',
  'upgraded.charged': '**Ditagih hari ini:** {amount}',
  'upgraded.price': '**Harga tahunan:** {price}',
  'upgraded.nextBilling': '**Tanggal penagihan berikutnya:** {date}',
  'upgraded.firstCharge': '**Penagihan pertama:** {date}',
  'upgraded.note':
    'Tagihan hari ini adalah harga tahunan dikurangi kredit untuk bagian periode bulanan Anda saat ini yang belum terpakai.',
  'upgraded.trialNote':
    'Uji coba gratis Anda masih berjalan dan tidak ada yang ditagih hari ini. Penagihan pertama Anda, dengan harga tahunan, adalah pada {date}.',
  'upgraded.subject':
    'Anda sekarang menggunakan penagihan tahunan - Trading Alerts',
  'switchScheduled.heading': 'Peralihan ke penagihan bulanan dijadwalkan',
  'switchScheduled.body':
    'Langganan **{plan}** Anda akan beralih ke penagihan bulanan pada {date}.',
  'switchScheduled.date': '**Tanggal peralihan:** {date}',
  'switchScheduled.price': '**Harga bulanan setelah itu:** {price}',
  'switchScheduled.note':
    'Anda tetap memiliki akses tahunan hingga {date}. Tidak ada yang ditagih atau dikembalikan sekarang, dan tidak ada kredit untuk tahun berjalan.',
  'switchScheduled.keep':
    'Berubah pikiran? Anda dapat tetap menggunakan penagihan tahunan sebelum tanggal itu. {link}',
  'switchScheduled.subject':
    'Peralihan Anda ke penagihan bulanan telah dijadwalkan - Trading Alerts',
  'planChange.manage': 'Anda dapat meninjau langganan Anda kapan saja. {link}',
  'planChange.manageLink': 'Buka pengaturan penagihan',

  'commission.heading': 'Komisi diterima!',
  'commission.body':
    'Kabar baik! Kode afiliasi Anda baru saja digunakan dan Anda mendapatkan komisi.',
  'commission.codeUsed': 'Kode yang digunakan',
  'commission.earned': 'Komisi diterima',
  'commission.total': 'Total pendapatan',
  'commission.rate': '**Tarif komisi:** {percent}% dari pendapatan langganan',
  'commission.button': 'Lihat Dasbor',
  'commission.subject': 'Komisi diterima! {amount} - {app}',
};
