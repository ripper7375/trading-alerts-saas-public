import type { EmailMessages } from './en-US';

/** Arabic (right-to-left). */
export const ar: EmailMessages = {
  'common.greeting': 'مرحبًا {name}،',
  'common.userFallback': 'المستخدم',
  'common.questions':
    'إذا كانت لديك أي أسئلة، فرُدّ على هذا البريد الإلكتروني أو تفضّل بزيارة مركز المساعدة.',
  'common.signature': 'فريق {app}',
  'common.needHelpContact': 'هل تحتاج إلى مساعدة؟ تواصل معنا على {email}',
  'common.needHelpReply':
    'هل تحتاج إلى مساعدة؟ رُدّ على هذا البريد الإلكتروني أو تواصل معنا على {email}',
  'common.securityAlertsNote':
    'وصلتك هذه الرسالة لأن تنبيهات الأمان مفعّلة في حسابك.',
  'common.manageNotifications': 'إدارة تفضيلات الإشعارات',

  'label.time': 'الوقت:',
  'label.location': 'الموقع:',
  'label.ipAddress': 'عنوان IP:',
  'label.device': 'الجهاز:',
  'label.browser': 'المتصفح:',
  'label.os': 'نظام التشغيل:',

  'value.unknown': 'غير معروف',
  'value.unknownLocation': 'موقع غير معروف',
  'value.device.desktop': 'حاسوب مكتبي',
  'value.device.mobile': 'هاتف محمول',
  'value.device.tablet': 'جهاز لوحي',

  'billing.perMonth': '{price}/شهريًا',
  'billing.perYear': '{price}/سنويًا',
  'billing.perThreeDays': '{price}/3 أيام',

  'security.changePassword': 'غيّر كلمة المرور فورًا',
  'security.secureButton': 'تأمين حسابي',

  'freeTier.xauusd': 'XAUUSD (الذهب) على الإطارين M5 وM15',
  'freeTier.marketData': 'بيانات السوق الكاملة وطبقات المؤشرات',
  'freeTier.noAlerts': 'لا توجد تنبيهات أسعار (ميزة PRO)',

  'welcome.title': 'مرحبًا بك في Trading Alerts',
  'welcome.heading': 'مرحبًا بك في Trading Alerts يا {name}!',
  'welcome.body':
    'تم إنشاء حسابك بنجاح. أصبح بإمكانك الآن إعداد أول تنبيه تداول لك!',
  'welcome.getStarted': 'ابدأ من هنا:',
  'welcome.step1': 'افتح مخطط XAUUSD على الإطار M5 أو M15',
  'welcome.step2': 'استكشف طبقات القنوات والهيكل',
  'welcome.step3': 'خصّص تفضيلات الإشعارات الخاصة بك',
  'welcome.button': 'الانتقال إلى لوحة التحكم',
  'welcome.subject': 'مرحبًا بك في Trading Alerts!',

  'affiliateWelcome.title': 'مرحبًا بك في برنامج الشراكة',
  'affiliateWelcome.heading': 'أصبحت شريكًا في برنامج الشراكة يا {name}!',
  'affiliateWelcome.body':
    'حساب الشراكة الخاص بك نشط. أنشأنا لك أول {count} من رموز الإحالة، وهي جاهزة الآن في لوحة التحكم.',
  'affiliateWelcome.button': 'الانتقال إلى لوحة تحكم الشراكة',
  'affiliateWelcome.footer':
    'تُرسل الأرباح عبر Wise بمجرد أن يتجاوز رصيدك الحد الأدنى الشهري. إذا كانت لديك أي أسئلة، فرُدّ على هذا البريد الإلكتروني أو تفضّل بزيارة مركز المساعدة.',
  'affiliateWelcome.subject': 'أصبحت شريكًا في برنامج الشراكة - Trading Alerts',

  'verify.heading': 'تأكيد عنوان بريدك الإلكتروني',
  'verify.body':
    'مرحبًا {name}، انقر على الزر أدناه لتأكيد عنوان بريدك الإلكتروني وتفعيل حسابك.',
  'verify.button': 'تأكيد عنوان البريد الإلكتروني',
  'verify.ignore':
    'إذا لم تُنشئ حسابًا في Trading Alerts، فيمكنك تجاهل هذه الرسالة بأمان.',
  'verify.expiry': 'ستنتهي صلاحية هذا الرابط خلال 24 ساعة.',
  'verify.subject': 'تأكيد بريدك الإلكتروني - Trading Alerts',

  'reset.heading': 'إعادة تعيين كلمة المرور',
  'reset.body':
    'مرحبًا {name}، تلقّينا طلبًا لإعادة تعيين كلمة المرور الخاصة بك. انقر على الزر أدناه لإنشاء كلمة مرور جديدة.',
  'reset.button': 'إعادة تعيين كلمة المرور',
  'reset.ignore':
    'إذا لم تطلب إعادة تعيين كلمة المرور، فيمكنك تجاهل هذه الرسالة. ستبقى كلمة المرور كما هي.',
  'reset.expiry': 'ستنتهي صلاحية هذا الرابط خلال ساعة واحدة.',
  'reset.subject': 'إعادة تعيين كلمة المرور - Trading Alerts',

  'newDevice.heading': 'تم رصد تسجيل دخول من جهاز جديد',
  'newDevice.body':
    'مرحبًا {name}، رصدنا تسجيل دخول إلى حسابك في Trading Alerts من جهاز جديد:',
  'newDevice.ifYou':
    '**إذا كنت أنت:** لا يلزم اتخاذ أي إجراء. يمكنك تجاهل هذه الرسالة بأمان.',
  'newDevice.ifNotYou':
    '**إذا لم تكن أنت:** فقد يكون شخص ما قد وصل إلى حسابك. نوصي بما يلي:',
  'newDevice.tip2': 'راجع جلساتك النشطة وسجّل الخروج من الأجهزة غير المعروفة',
  'newDevice.tip3': 'فعّل التحقق بخطوتين لمزيد من الأمان',
  'newDevice.subject': 'تنبيه أمني: تم رصد تسجيل دخول من جهاز جديد',

  'passwordChanged.heading': 'تم تغيير كلمة المرور بنجاح',
  'passwordChanged.body':
    'مرحبًا {name}، تم تغيير كلمة مرور حسابك في Trading Alerts.',
  'passwordChanged.ifYou':
    '**إذا كنت أنت من أجرى هذا التغيير:** لا يلزم اتخاذ أي إجراء. حسابك آمن.',
  'passwordChanged.ifNotYou':
    '**إذا لم تكن أنت من أجرى هذا التغيير:** فقد يكون حسابك مُخترقًا. يُرجى:',
  'passwordChanged.tip1':
    'إعادة تعيين كلمة المرور فورًا باستخدام خيار «نسيت كلمة المرور؟»',
  'passwordChanged.tip2': 'مراجعة حسابك بحثًا عن أي تغييرات غير مصرّح بها',
  'passwordChanged.tip3':
    'التواصل مع فريق الدعم لدينا إذا كنت بحاجة إلى مساعدة',
  'passwordChanged.subject': 'تنبيه أمني: تم تغيير كلمة المرور',

  'twoFactorEnabled.heading': 'تم تفعيل التحقق بخطوتين',
  'twoFactorEnabled.body':
    'مرحبًا {name}، تم تفعيل التحقق بخطوتين بنجاح على حسابك في Trading Alerts.',
  'twoFactorEnabled.remindersHeading': 'تذكيرات مهمة:',
  'twoFactorEnabled.reminder1': 'احتفظ برموز النسخ الاحتياطي في مكان آمن',
  'twoFactorEnabled.reminder2': 'ستحتاج إلى تطبيق المصادقة لتسجيل الدخول',
  'twoFactorEnabled.reminder3':
    'إذا فقدت الوصول إلى تطبيق المصادقة، فاستخدم أحد رموز النسخ الاحتياطي',
  'twoFactorEnabled.ifNotYou':
    '**إذا لم تكن أنت من فعّل التحقق بخطوتين:** فقد يكون حسابك مُخترقًا. يُرجى التواصل مع الدعم فورًا.',
  'twoFactorEnabled.button': 'إدارة إعدادات الأمان',
  'twoFactorEnabled.subject': 'تنبيه أمني: تم تفعيل التحقق بخطوتين',

  'twoFactorDisabled.heading': 'تم تعطيل التحقق بخطوتين',
  'twoFactorDisabled.body':
    'مرحبًا {name}، تم تعطيل التحقق بخطوتين على حسابك في Trading Alerts.',
  'twoFactorDisabled.warning': 'أصبح حسابك أقل أمانًا من دون التحقق بخطوتين.',
  'twoFactorDisabled.ifYou':
    '**إذا كنت أنت من عطّله:** نوصي بإعادة تفعيله للحصول على أقصى درجات الأمان.',
  'twoFactorDisabled.ifNotYou':
    '**إذا لم تكن أنت من عطّله:** فقد يكون حسابك مُخترقًا. يُرجى:',
  'twoFactorDisabled.tip2': 'إعادة تفعيل التحقق بخطوتين',
  'twoFactorDisabled.tip3': 'مراجعة حسابك بحثًا عن أي تغييرات غير مصرّح بها',
  'twoFactorDisabled.subject': 'تنبيه أمني: تم تعطيل التحقق بخطوتين',

  'payoutDetails.heading': 'تم تغيير بيانات الدفع',
  'payoutDetails.body':
    'مرحبًا {name}، تمت إضافة بيانات دفع أو تغييرها في حساب الشريك الخاص بك في Trading Alerts.',
  'payoutDetails.holdLabel': 'المدفوعات معلّقة حتى:',
  'payoutDetails.hold':
    'لحمايتك، ستُعلَّق المدفوعات إلى هذه البيانات لمدة {hours} ساعة. أرباحك في أمان وستُدفع عند انتهاء التعليق.',
  'payoutDetails.ifYou':
    '**إذا كنت أنت من أجرى هذا التغيير:** فلا يلزمك أي إجراء.',
  'payoutDetails.ifNotYou':
    '**إذا لم تكن أنت من أجرى هذا التغيير:** فقد يكون حسابك مُخترقًا. يُرجى:',
  'payoutDetails.tip2': 'التواصل مع فريق الدعم لدينا قبل انتهاء التعليق',
  'payoutDetails.tip3': 'مراجعة حسابك بحثًا عن أي تغييرات غير مصرّح بها',
  'payoutDetails.subject': 'تنبيه أمني: تم تغيير بيانات الدفع الخاصة بك',

  'accountDeletion.heading': 'تأكيد حذف حسابك',
  'accountDeletion.body':
    'مرحبًا {name}، تلقّينا طلبًا لحذف حسابك في Trading Alerts نهائيًا.',
  'accountDeletion.confirmIntro':
    '**للمتابعة،** أكّد الحذف باستخدام الزر أدناه. لا يمكن التراجع عن هذا الإجراء.',
  'accountDeletion.confirmButton': 'تأكيد حذف الحساب',
  'accountDeletion.cancelIntro':
    '**إذا غيّرت رأيك، أو لم تكن أنت من قدّم الطلب،** فألغِ الطلب بدلًا من ذلك:',
  'accountDeletion.cancelButton': 'إلغاء طلب الحذف',
  'accountDeletion.expiry':
    'تنتهي صلاحية هذه الروابط في {date}. يمكن لأي شخص يملك هذه الروابط اتخاذ إجراء بشأن طلبك، لذا يُرجى عدم إعادة توجيه هذه الرسالة.',
  'accountDeletion.subject': 'تأكيد حذف حسابك - Trading Alerts',

  'subscription.heading': 'تم تأكيد الاشتراك!',
  'subscription.body': 'مرحبًا {name}، اشتراكك **{plan}** نشط الآن.',
  'subscription.planDetails': 'تفاصيل الخطة',
  'subscription.tier': 'المستوى:',
  'subscription.billing': 'الفوترة:',
  'subscription.trial':
    'تجربة مجانية لمدة 7 أيام: لن يتم خصم أي مبلغ من بطاقتك حتى تنتهي فترة التجربة.',
  'subscription.proHeading': 'ما تحصل عليه مع Pro:',
  'subscription.pro1': '**100 تنبيه سعري** - لا تفوّت أي فرصة تداول',
  'subscription.pro2':
    '**تنبيهات خطوط محرك الرسم** - ارسم خطًا على المخطط ليصلك تنبيه عندما يلامسه السعر',
  'subscription.pro3':
    '**عرض متعدد الأطر الزمنية** - ضع هيكل M5 فوق مخططات M15',
  'subscription.pro4':
    '**رؤى حصرية لـ XAUUSD** - بيانات مؤشرات M5/M15 الكاملة (جميع الأعمدة الـ 79)',
  'subscription.pro5': '**300 طلب API في الساعة**',
  'subscription.pro6': '**دعم ذو أولوية وتصدير البيانات**',
  'subscription.freeHeading': 'تتضمن خطتك المجانية:',
  'subscription.free1': '**XAUUSD (الذهب)** - مخططات M5 وM15',
  'subscription.free2':
    '**بيانات المؤشرات الكاملة** - بيانات السوق نفسها المتاحة في Pro',
  'subscription.free3': '**60 طلب API في الساعة**',
  'subscription.upgradeLead':
    '{link} للحصول على التنبيهات وتنبيهات الخطوط والعرض متعدد الأطر الزمنية!',
  'subscription.upgradeLink': 'الترقية إلى Pro',
  'subscription.subject': 'تم تأكيد اشتراك {plan}',

  'cancellation.heading': 'تم إلغاء الاشتراك',
  'cancellation.body': 'تم إلغاء اشتراكك في {app} PRO.',
  'cancellation.freeAccess': 'لديك الآن إمكانية الوصول إلى مستوى FREE:',
  'cancellation.changedMind': 'هل غيّرت رأيك؟',
  'cancellation.upgradeAgain':
    'يمكنك الترقية مجددًا في أي وقت لاستعادة الوصول إلى جميع ميزات PRO.',
  'cancellation.button': 'عرض التسعير',
  'cancellation.thanks': 'شكرًا لتجربتك PRO!',
  'cancellation.subject': 'تم إلغاء اشتراكك في PRO',

  'paymentFailed.heading': 'فشلت عملية الدفع',
  'paymentFailed.body': 'تعذّرت معالجة دفعتك لاشتراك {app} PRO ({amount}).',
  'paymentFailed.reason': '**السبب:** {reason}',
  'paymentFailed.action':
    '**يُرجى تحديث وسيلة الدفع خلال 3 أيام** للحفاظ على وصولك إلى PRO.',
  'paymentFailed.button': 'تحديث وسيلة الدفع',
  'paymentFailed.downgrade':
    'إذا لم تُحَل المشكلة، فسيتم تحويل حسابك إلى مستوى FREE.',
  'paymentFailed.subject': 'فشلت عملية الدفع - مطلوب إجراء منك',

  'receipt.title': 'إيصال الدفع',
  'receipt.heading': 'تمت عملية الدفع بنجاح',
  'receipt.body': 'تمت عملية الدفع بنجاح!',
  'receipt.description': 'الوصف',
  'receipt.descriptionValue': '{app} PRO - شهريًا',
  'receipt.amount': 'المبلغ',
  'receipt.date': 'التاريخ',
  'receipt.nextBilling': 'تاريخ الفوترة التالي',
  'receipt.button': 'تنزيل الفاتورة',
  'receipt.thanks': 'شكرًا لكونك عضوًا في PRO!',
  'receipt.subject': 'إيصال الدفع - {app} PRO',

  'canceled.heading': 'تم إلغاء الاشتراك',
  'canceled.body': 'تم إلغاء اشتراكك **{plan}**.',
  'canceled.accessUntil': '**الوصول حتى:** {date}',
  'canceled.accessNote': 'ستحتفظ بإمكانية الوصول إلى {plan} حتى {date}.',
  'canceled.afterwards': 'بعد ذلك، سيعود حسابك إلى خطة **Free** التي تتضمن:',
  'canceled.reactivate': 'هل غيّرت رأيك؟ {link}',
  'canceled.reactivateLink': 'أعد تفعيل اشتراكك',
  'canceled.subject': 'تم إلغاء الاشتراك - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': 'تم استئناف الاشتراك',
  'resumed.body': 'سيستمر اشتراكك **{plan}**.',
  'resumed.nextBilling': '**تاريخ الفوترة التالي:** {date}',
  'resumed.note':
    'تم سحب طلب الإلغاء. ستحتفظ بإمكانية الوصول الكاملة إلى {plan} وسيتجدد اشتراكك تلقائيًا في {date}.',
  'resumed.manage': 'يمكنك مراجعة اشتراكك في أي وقت. {link}',
  'resumed.manageLink': 'افتح إعدادات الفوترة',
  'resumed.subject': 'سيستمر اشتراكك {plan} - Trading Alerts',

  // ── Plan change: upgraded to yearly, switch to monthly scheduled (S3) ──
  'upgraded.heading': 'تم التحويل إلى الفوترة السنوية',
  'upgraded.body': 'أصبح اشتراكك **{plan}** يُفوتر سنويًا.',
  'upgraded.charged': '**المبلغ المحصَّل اليوم:** {amount}',
  'upgraded.price': '**السعر السنوي:** {price}',
  'upgraded.nextBilling': '**تاريخ الفوترة التالي:** {date}',
  'upgraded.firstCharge': '**أول عملية دفع:** {date}',
  'upgraded.note':
    'مبلغ اليوم هو السعر السنوي مطروحًا منه رصيد الجزء غير المستخدم من فترتك الشهرية الحالية.',
  'upgraded.trialNote':
    'تجربتك المجانية مستمرة ولم يُحصَّل أي مبلغ اليوم. ستكون أول عملية دفع، بالسعر السنوي، في {date}.',
  'upgraded.subject': 'أصبحت الآن على الفوترة السنوية - Trading Alerts',
  'switchScheduled.heading': 'تمت جدولة التحويل إلى الفوترة الشهرية',
  'switchScheduled.body':
    'سيتحول اشتراكك **{plan}** إلى الفوترة الشهرية في {date}.',
  'switchScheduled.date': '**تاريخ التحويل:** {date}',
  'switchScheduled.price': '**السعر الشهري بعد ذلك:** {price}',
  'switchScheduled.note':
    'تحتفظ بوصولك السنوي حتى {date}. لن يُحصَّل أو يُردّ أي مبلغ الآن، ولا يوجد رصيد عن السنة الحالية.',
  'switchScheduled.keep':
    'غيّرت رأيك؟ يمكنك الإبقاء على الفوترة السنوية قبل ذلك. {link}',
  'switchScheduled.subject':
    'تمت جدولة تحويلك إلى الفوترة الشهرية - Trading Alerts',
  'planChange.manage': 'يمكنك مراجعة اشتراكك في أي وقت. {link}',
  'planChange.manageLink': 'افتح إعدادات الفوترة',

  'commission.heading': 'لقد ربحت عمولة!',
  'commission.body':
    'أخبار سارة! تم استخدام رمز الشراكة الخاص بك للتو وربحت عمولة.',
  'commission.codeUsed': 'الرمز المستخدم',
  'commission.earned': 'العمولة المكتسبة',
  'commission.total': 'إجمالي الأرباح',
  'commission.rate': '**نسبة العمولة:** {percent}٪ من إيرادات الاشتراك',
  'commission.button': 'عرض لوحة التحكم',
  'commission.subject': 'لقد ربحت عمولة! {amount} - {app}',
};
