import type { EmailMessages } from './en-US';

export const hi: EmailMessages = {
  'common.greeting': 'नमस्ते {name},',
  'common.userFallback': 'उपयोगकर्ता',
  'common.questions':
    'कोई भी प्रश्न हो तो इस ईमेल का उत्तर दें या हमारे सहायता केंद्र पर जाएँ।',
  'common.signature': '{app} टीम',
  'common.needHelpContact': 'मदद चाहिए? हमसे {email} पर संपर्क करें',
  'common.needHelpReply':
    'मदद चाहिए? इस ईमेल का उत्तर दें या हमसे {email} पर संपर्क करें',
  'common.securityAlertsNote':
    'आपको यह ईमेल इसलिए मिला है क्योंकि आपके खाते में सुरक्षा अलर्ट चालू हैं।',
  'common.manageNotifications': 'सूचना प्राथमिकताएँ प्रबंधित करें',

  'label.time': 'समय:',
  'label.location': 'स्थान:',
  'label.ipAddress': 'IP पता:',
  'label.device': 'डिवाइस:',
  'label.browser': 'ब्राउज़र:',
  'label.os': 'ऑपरेटिंग सिस्टम:',

  'value.unknown': 'अज्ञात',
  'value.unknownLocation': 'अज्ञात स्थान',
  'value.device.desktop': 'डेस्कटॉप',
  'value.device.mobile': 'मोबाइल',
  'value.device.tablet': 'टैबलेट',

  'billing.perMonth': '{price}/माह',
  'billing.perYear': '{price}/वर्ष',
  'billing.perThreeDays': '{price}/3 दिन',

  'security.changePassword': 'तुरंत अपना पासवर्ड बदलें',
  'security.secureButton': 'मेरा खाता सुरक्षित करें',

  'freeTier.xauusd': 'M5 और M15 पर XAUUSD (सोना)',
  'freeTier.marketData': 'पूरा मार्केट डेटा और इंडिकेटर ओवरले',
  'freeTier.noAlerts': 'कोई प्राइस अलर्ट नहीं (PRO सुविधा)',

  'welcome.title': 'Trading Alerts में आपका स्वागत है',
  'welcome.heading': 'Trading Alerts में आपका स्वागत है, {name}!',
  'welcome.body':
    'आपका खाता सफलतापूर्वक बन गया है। अब आप अपना पहला ट्रेडिंग अलर्ट सेट कर सकते हैं!',
  'welcome.getStarted': 'शुरू करें:',
  'welcome.step1': 'M5 या M15 पर XAUUSD चार्ट खोलें',
  'welcome.step2': 'चैनल और स्ट्रक्चर ओवरले देखें',
  'welcome.step3': 'अपनी सूचना प्राथमिकताएँ अपने अनुसार सेट करें',
  'welcome.button': 'डैशबोर्ड पर जाएँ',
  'welcome.subject': 'Trading Alerts में आपका स्वागत है!',

  'affiliateWelcome.title': 'एफ़िलिएट प्रोग्राम में आपका स्वागत है',
  'affiliateWelcome.heading': '{name}, अब आप एफ़िलिएट पार्टनर हैं!',
  'affiliateWelcome.body':
    'आपका एफ़िलिएट खाता सक्रिय है। हमने आपके पहले {count} रेफ़रल कोड बना दिए हैं — वे अब आपके डैशबोर्ड में उपलब्ध हैं।',
  'affiliateWelcome.button': 'एफ़िलिएट डैशबोर्ड पर जाएँ',
  'affiliateWelcome.footer':
    'जैसे ही आपका बैलेंस मासिक न्यूनतम राशि पार करता है, भुगतान Wise के माध्यम से भेजे जाते हैं। कोई भी प्रश्न हो तो इस ईमेल का उत्तर दें या हमारे सहायता केंद्र पर जाएँ।',
  'affiliateWelcome.subject': 'आप एफ़िलिएट पार्टनर हैं - Trading Alerts',

  'verify.heading': 'अपना ईमेल पता सत्यापित करें',
  'verify.body':
    'नमस्ते {name}, अपना ईमेल पता सत्यापित करने और खाता सक्रिय करने के लिए नीचे दिए बटन पर क्लिक करें।',
  'verify.button': 'ईमेल पता सत्यापित करें',
  'verify.ignore':
    'यदि आपने Trading Alerts पर खाता नहीं बनाया है, तो आप इस ईमेल को अनदेखा कर सकते हैं।',
  'verify.expiry': 'यह लिंक 24 घंटे में समाप्त हो जाएगा।',
  'verify.subject': 'अपना ईमेल सत्यापित करें - Trading Alerts',

  'reset.heading': 'अपना पासवर्ड रीसेट करें',
  'reset.body':
    'नमस्ते {name}, हमें आपका पासवर्ड रीसेट करने का अनुरोध मिला है। नया पासवर्ड बनाने के लिए नीचे दिए बटन पर क्लिक करें।',
  'reset.button': 'पासवर्ड रीसेट करें',
  'reset.ignore':
    'यदि आपने पासवर्ड रीसेट का अनुरोध नहीं किया है, तो इस ईमेल को अनदेखा करें। आपका पासवर्ड वैसा ही रहेगा।',
  'reset.expiry': 'यह लिंक 1 घंटे में समाप्त हो जाएगा।',
  'reset.subject': 'अपना पासवर्ड रीसेट करें - Trading Alerts',

  'newDevice.heading': 'नए डिवाइस से लॉगिन का पता चला',
  'newDevice.body':
    'नमस्ते {name}, हमने एक नए डिवाइस से आपके Trading Alerts खाते में लॉगिन का पता लगाया है:',
  'newDevice.ifYou':
    '**यदि यह आप थे:** कुछ करने की आवश्यकता नहीं है। आप इस ईमेल को अनदेखा कर सकते हैं।',
  'newDevice.ifNotYou':
    '**यदि यह आप नहीं थे:** हो सकता है किसी और की आपके खाते तक पहुँच हो। हमारी सलाह है कि:',
  'newDevice.tip2': 'अपने सक्रिय सेशन जाँचें और अनजान डिवाइस से साइन आउट करें',
  'newDevice.tip3': 'अतिरिक्त सुरक्षा के लिए द्वि-चरणीय प्रमाणीकरण चालू करें',
  'newDevice.subject': 'सुरक्षा अलर्ट: नए डिवाइस से लॉगिन का पता चला',

  'passwordChanged.heading': 'पासवर्ड सफलतापूर्वक बदल गया',
  'passwordChanged.body':
    'नमस्ते {name}, आपके Trading Alerts खाते का पासवर्ड बदल दिया गया है।',
  'passwordChanged.ifYou':
    '**यदि यह बदलाव आपने किया:** कुछ करने की आवश्यकता नहीं है। आपका खाता सुरक्षित है।',
  'passwordChanged.ifNotYou':
    '**यदि यह बदलाव आपने नहीं किया:** आपका खाता असुरक्षित हो सकता है। कृपया:',
  'passwordChanged.tip1':
    '"पासवर्ड भूल गए?" सुविधा से तुरंत अपना पासवर्ड रीसेट करें',
  'passwordChanged.tip2': 'अपने खाते में किसी अनधिकृत बदलाव की जाँच करें',
  'passwordChanged.tip3': 'सहायता चाहिए तो हमारी सपोर्ट टीम से संपर्क करें',
  'passwordChanged.subject': 'सुरक्षा अलर्ट: पासवर्ड बदला गया',

  'twoFactorEnabled.heading': 'द्वि-चरणीय प्रमाणीकरण चालू हो गया',
  'twoFactorEnabled.body':
    'नमस्ते {name}, आपके Trading Alerts खाते पर द्वि-चरणीय प्रमाणीकरण सफलतापूर्वक चालू हो गया है।',
  'twoFactorEnabled.remindersHeading': 'ज़रूरी बातें:',
  'twoFactorEnabled.reminder1': 'अपने बैकअप कोड सुरक्षित जगह रखें',
  'twoFactorEnabled.reminder2':
    'साइन इन करने के लिए आपको अपना ऑथेंटिकेटर ऐप चाहिए होगा',
  'twoFactorEnabled.reminder3':
    'यदि ऑथेंटिकेटर तक आपकी पहुँच खो जाए, तो बैकअप कोड का उपयोग करें',
  'twoFactorEnabled.ifNotYou':
    '**यदि आपने द्वि-चरणीय प्रमाणीकरण चालू नहीं किया:** आपका खाता असुरक्षित हो सकता है। कृपया तुरंत सपोर्ट से संपर्क करें।',
  'twoFactorEnabled.button': 'सुरक्षा सेटिंग प्रबंधित करें',
  'twoFactorEnabled.subject': 'सुरक्षा अलर्ट: द्वि-चरणीय प्रमाणीकरण चालू हुआ',

  'twoFactorDisabled.heading': 'द्वि-चरणीय प्रमाणीकरण बंद हो गया',
  'twoFactorDisabled.body':
    'नमस्ते {name}, आपके Trading Alerts खाते पर द्वि-चरणीय प्रमाणीकरण बंद कर दिया गया है।',
  'twoFactorDisabled.warning':
    'द्वि-चरणीय प्रमाणीकरण के बिना आपका खाता अब कम सुरक्षित है।',
  'twoFactorDisabled.ifYou':
    '**यदि इसे आपने बंद किया:** अधिकतम सुरक्षा के लिए हम इसे फिर से चालू करने की सलाह देते हैं।',
  'twoFactorDisabled.ifNotYou':
    '**यदि इसे आपने बंद नहीं किया:** आपका खाता असुरक्षित हो सकता है। कृपया:',
  'twoFactorDisabled.tip2': 'द्वि-चरणीय प्रमाणीकरण फिर से चालू करें',
  'twoFactorDisabled.tip3': 'अपने खाते में किसी अनधिकृत बदलाव की जाँच करें',
  'twoFactorDisabled.subject': 'सुरक्षा अलर्ट: द्वि-चरणीय प्रमाणीकरण बंद हुआ',

  'payoutDetails.heading': 'भुगतान विवरण बदले गए',
  'payoutDetails.body':
    'नमस्ते {name}, आपके Trading Alerts एफ़िलिएट खाते में भुगतान विवरण जोड़े या बदले गए हैं।',
  'payoutDetails.holdLabel': 'भुगतान इस समय तक रोके गए हैं:',
  'payoutDetails.hold':
    'आपकी सुरक्षा के लिए, इन विवरणों पर भुगतान {hours} घंटे के लिए रोके गए हैं। आपकी कमाई सुरक्षित है और रोक समाप्त होने के बाद उसका भुगतान कर दिया जाएगा।',
  'payoutDetails.ifYou':
    '**यदि यह बदलाव आपने किया:** तो किसी कार्रवाई की आवश्यकता नहीं है।',
  'payoutDetails.ifNotYou':
    '**यदि यह बदलाव आपने नहीं किया:** आपका खाता असुरक्षित हो सकता है। कृपया:',
  'payoutDetails.tip2':
    'रोक समाप्त होने से पहले हमारी सहायता टीम से संपर्क करें',
  'payoutDetails.tip3': 'अपने खाते में किसी अनधिकृत बदलाव की जाँच करें',
  'payoutDetails.subject': 'सुरक्षा अलर्ट: आपके भुगतान विवरण बदले गए',

  'accountDeletion.heading': 'अपने खाते को हटाने की पुष्टि करें',
  'accountDeletion.body':
    'नमस्ते {name}, हमें आपका Trading Alerts खाता स्थायी रूप से हटाने का अनुरोध मिला है।',
  'accountDeletion.confirmIntro':
    '**आगे बढ़ने के लिए** नीचे दिए बटन से खाता हटाने की पुष्टि करें। इसे पूर्ववत नहीं किया जा सकता।',
  'accountDeletion.confirmButton': 'खाता हटाने की पुष्टि करें',
  'accountDeletion.cancelIntro':
    '**यदि आपने अपना मन बदल लिया है या यह अनुरोध आपका नहीं था,** तो इसके बजाय अनुरोध रद्द करें:',
  'accountDeletion.cancelButton': 'हटाने का अनुरोध रद्द करें',
  'accountDeletion.expiry':
    'ये लिंक {date} को समाप्त हो जाएँगे। इन लिंक वाला कोई भी व्यक्ति आपके अनुरोध पर कार्रवाई कर सकता है, इसलिए कृपया यह ईमेल फ़ॉरवर्ड न करें।',
  'accountDeletion.subject':
    'अपने खाते को हटाने की पुष्टि करें - Trading Alerts',

  'subscription.heading': 'सदस्यता की पुष्टि हो गई!',
  'subscription.body': 'नमस्ते {name}, आपकी **{plan}** सदस्यता अब सक्रिय है।',
  'subscription.planDetails': 'प्लान का विवरण',
  'subscription.tier': 'स्तर:',
  'subscription.billing': 'बिलिंग:',
  'subscription.trial':
    '7 दिन का निःशुल्क ट्रायल: ट्रायल समाप्त होने तक आपके कार्ड से शुल्क नहीं लिया जाएगा।',
  'subscription.proHeading': 'Pro में आपको क्या मिलता है:',
  'subscription.pro1': '**100 प्राइस अलर्ट** - ट्रेडिंग का कोई मौका न चूकें',
  'subscription.pro2':
    '**ड्रॉइंग इंजन लाइन अलर्ट** - चार्ट पर लाइन खींचें और कीमत के उसे छूते ही अलर्ट पाएँ',
  'subscription.pro3':
    '**मल्टी-टाइमफ़्रेम विज़ुअलाइज़ेशन** - M15 चार्ट पर M5 स्ट्रक्चर ओवरले करें',
  'subscription.pro4':
    '**XAUUSD की विशेष जानकारी** - M5/M15 इंडिकेटर का पूरा डेटा (सभी 79 कॉलम)',
  'subscription.pro5': '**प्रति घंटे 300 API अनुरोध**',
  'subscription.pro6': '**प्राथमिकता सपोर्ट और डेटा एक्सपोर्ट**',
  'subscription.freeHeading': 'आपके निःशुल्क प्लान में शामिल है:',
  'subscription.free1': '**XAUUSD (सोना)** - M5 और M15 चार्ट',
  'subscription.free2': '**पूरा इंडिकेटर डेटा** - Pro जैसा ही मार्केट डेटा',
  'subscription.free3': '**प्रति घंटे 60 API अनुरोध**',
  'subscription.upgradeLead':
    'अलर्ट, लाइन अलर्ट और मल्टी-टाइमफ़्रेम व्यू के लिए {link}!',
  'subscription.upgradeLink': 'Pro में अपग्रेड करें',
  'subscription.subject': '{plan} सदस्यता की पुष्टि हो गई',

  'cancellation.heading': 'सदस्यता रद्द हो गई',
  'cancellation.body': 'आपकी {app} PRO सदस्यता रद्द कर दी गई है।',
  'cancellation.freeAccess': 'अब आपके पास FREE स्तर की पहुँच है:',
  'cancellation.changedMind': 'क्या आपने अपना मन बदल लिया?',
  'cancellation.upgradeAgain':
    'सभी PRO सुविधाओं की पहुँच फिर से पाने के लिए आप कभी भी दोबारा अपग्रेड कर सकते हैं।',
  'cancellation.button': 'मूल्य निर्धारण देखें',
  'cancellation.thanks': 'PRO आज़माने के लिए धन्यवाद!',
  'cancellation.subject': 'आपकी PRO सदस्यता रद्द कर दी गई है',

  'paymentFailed.heading': 'भुगतान विफल रहा',
  'paymentFailed.body':
    'हम {app} PRO ({amount}) के लिए आपका भुगतान प्रोसेस नहीं कर सके।',
  'paymentFailed.reason': '**कारण:** {reason}',
  'paymentFailed.action':
    'अपनी PRO पहुँच बनाए रखने के लिए **कृपया 3 दिनों के भीतर अपनी भुगतान विधि अपडेट करें।**',
  'paymentFailed.button': 'भुगतान विधि अपडेट करें',
  'paymentFailed.downgrade':
    'यदि समस्या हल नहीं हुई, तो आपका खाता FREE स्तर पर आ जाएगा।',
  'paymentFailed.subject': 'भुगतान विफल - कार्रवाई आवश्यक',

  'receipt.title': 'भुगतान रसीद',
  'receipt.heading': 'भुगतान सफल रहा',
  'receipt.body': 'आपका भुगतान सफल रहा!',
  'receipt.description': 'विवरण',
  'receipt.descriptionValue': '{app} PRO - मासिक',
  'receipt.amount': 'राशि',
  'receipt.date': 'तारीख',
  'receipt.nextBilling': 'अगली बिलिंग तारीख',
  'receipt.button': 'इनवॉइस डाउनलोड करें',
  'receipt.thanks': 'PRO सदस्य बनने के लिए धन्यवाद!',
  'receipt.subject': 'भुगतान रसीद - {app} PRO',

  'canceled.heading': 'सदस्यता रद्द हो गई',
  'canceled.body': 'आपकी **{plan}** सदस्यता रद्द कर दी गई है।',
  'canceled.accessUntil': '**पहुँच की अंतिम तारीख:** {date}',
  'canceled.accessNote': '{date} तक आपके पास {plan} की पहुँच बनी रहेगी।',
  'canceled.afterwards':
    'उसके बाद आपका खाता **Free** प्लान पर लौट जाएगा, जिसमें शामिल है:',
  'canceled.reactivate': 'क्या आपने अपना मन बदल लिया? {link}',
  'canceled.reactivateLink': 'अपनी सदस्यता फिर से चालू करें',
  'canceled.subject': 'सदस्यता रद्द हो गई - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': 'सदस्यता फिर से शुरू हो गई',
  'resumed.body': 'आपकी **{plan}** सदस्यता जारी रहेगी।',
  'resumed.nextBilling': '**अगली बिलिंग तारीख:** {date}',
  'resumed.note':
    'आपका रद्दीकरण वापस ले लिया गया है। आपके पास {plan} की पूरी पहुँच बनी रहेगी और आपकी सदस्यता {date} को अपने-आप नवीनीकृत होगी।',
  'resumed.manage': 'आप कभी भी अपनी सदस्यता देख सकते हैं। {link}',
  'resumed.manageLink': 'बिलिंग सेटिंग खोलें',
  'resumed.subject': 'आपकी {plan} सदस्यता जारी रहेगी - Trading Alerts',

  // ── Plan change: upgraded to yearly, switch to monthly scheduled (S3) ──
  'upgraded.heading': 'वार्षिक बिलिंग पर स्विच किया गया',
  'upgraded.body': 'आपकी **{plan}** सदस्यता अब वार्षिक बिल की जाएगी।',
  'upgraded.charged': '**आज लिया गया शुल्क:** {amount}',
  'upgraded.price': '**वार्षिक मूल्य:** {price}',
  'upgraded.nextBilling': '**अगली बिलिंग तारीख:** {date}',
  'upgraded.firstCharge': '**पहला शुल्क:** {date}',
  'upgraded.note':
    'आज का शुल्क वार्षिक मूल्य में से आपकी वर्तमान मासिक अवधि के अप्रयुक्त हिस्से का क्रेडिट घटाकर है।',
  'upgraded.trialNote':
    'आपका निःशुल्क परीक्षण जारी है और आज कुछ भी चार्ज नहीं किया गया। वार्षिक मूल्य पर आपका पहला शुल्क {date} को लिया जाएगा।',
  'upgraded.subject': 'अब आप वार्षिक बिलिंग पर हैं - Trading Alerts',
  'switchScheduled.heading': 'मासिक बिलिंग पर स्विच निर्धारित किया गया',
  'switchScheduled.body':
    'आपकी **{plan}** सदस्यता {date} को मासिक बिलिंग पर स्विच हो जाएगी।',
  'switchScheduled.date': '**स्विच की तारीख:** {date}',
  'switchScheduled.price': '**उसके बाद मासिक मूल्य:** {price}',
  'switchScheduled.note':
    '{date} तक आपकी वार्षिक पहुँच बनी रहेगी। अभी कुछ भी चार्ज या रिफ़ंड नहीं किया जाएगा, और चालू वर्ष के लिए कोई क्रेडिट नहीं है।',
  'switchScheduled.keep':
    'मन बदल गया? उससे पहले आप वार्षिक बिलिंग बनाए रख सकते हैं। {link}',
  'switchScheduled.subject':
    'मासिक बिलिंग पर आपका स्विच निर्धारित है - Trading Alerts',
  'planChange.manage': 'आप कभी भी अपनी सदस्यता देख सकते हैं। {link}',
  'planChange.manageLink': 'बिलिंग सेटिंग खोलें',

  'commission.heading': 'कमीशन मिला!',
  'commission.body':
    'खुशखबरी! आपका एफ़िलिएट कोड अभी इस्तेमाल हुआ है और आपने कमीशन कमाया है।',
  'commission.codeUsed': 'इस्तेमाल किया गया कोड',
  'commission.earned': 'कमाया गया कमीशन',
  'commission.total': 'कुल कमाई',
  'commission.rate': '**कमीशन दर:** सदस्यता राजस्व का {percent}%',
  'commission.button': 'डैशबोर्ड देखें',
  'commission.subject': 'कमीशन मिला! {amount} - {app}',
};
