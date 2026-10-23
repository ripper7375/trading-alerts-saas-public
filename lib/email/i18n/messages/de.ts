import type { EmailMessages } from './en-US';

export const de: EmailMessages = {
  'common.greeting': 'Hallo {name},',
  'common.userFallback': 'Nutzer',
  'common.questions':
    'Bei Fragen antworten Sie einfach auf diese E-Mail oder besuchen Sie unser Hilfecenter.',
  'common.signature': 'Das {app}-Team',
  'common.needHelpContact': 'Brauchen Sie Hilfe? Schreiben Sie uns an {email}',
  'common.needHelpReply':
    'Brauchen Sie Hilfe? Antworten Sie auf diese E-Mail oder schreiben Sie uns an {email}',
  'common.securityAlertsNote':
    'Sie erhalten diese E-Mail, weil Sicherheitsbenachrichtigungen für Ihr Konto aktiviert sind.',
  'common.manageNotifications': 'Benachrichtigungseinstellungen verwalten',

  'label.time': 'Zeit:',
  'label.location': 'Standort:',
  'label.ipAddress': 'IP-Adresse:',
  'label.device': 'Gerät:',
  'label.browser': 'Browser:',
  'label.os': 'Betriebssystem:',

  'value.unknown': 'Unbekannt',
  'value.unknownLocation': 'Unbekannter Standort',
  'value.device.desktop': 'Desktop',
  'value.device.mobile': 'Smartphone',
  'value.device.tablet': 'Tablet',

  'billing.perMonth': '{price}/Monat',
  'billing.perYear': '{price}/Jahr',
  'billing.perThreeDays': '{price}/3 Tage',

  'security.changePassword': 'Ändern Sie sofort Ihr Passwort',
  'security.secureButton': 'Mein Konto schützen',

  'freeTier.xauusd': 'XAUUSD (Gold) auf M5 und M15',
  'freeTier.marketData': 'Vollständige Marktdaten und Indikator-Overlays',
  'freeTier.noAlerts': 'Keine Preisalarme (PRO-Funktion)',

  'welcome.title': 'Willkommen bei Trading Alerts',
  'welcome.heading': 'Willkommen bei Trading Alerts, {name}!',
  'welcome.body':
    'Ihr Konto wurde erfolgreich erstellt. Sie können jetzt Ihren ersten Trading-Alarm einrichten!',
  'welcome.getStarted': 'So starten Sie:',
  'welcome.step1': 'Öffnen Sie den XAUUSD-Chart auf M5 oder M15',
  'welcome.step2': 'Entdecken Sie die Kanal- und Struktur-Overlays',
  'welcome.step3': 'Passen Sie Ihre Benachrichtigungseinstellungen an',
  'welcome.button': 'Zum Dashboard',
  'welcome.subject': 'Willkommen bei Trading Alerts!',

  'affiliateWelcome.title': 'Willkommen im Partnerprogramm',
  'affiliateWelcome.heading': 'Sie sind jetzt Affiliate-Partner, {name}!',
  'affiliateWelcome.body':
    'Ihr Affiliate-Konto ist aktiv. Wir haben Ihre ersten {count} Empfehlungscodes erstellt – sie stehen ab sofort in Ihrem Dashboard bereit.',
  'affiliateWelcome.button': 'Zum Affiliate-Dashboard',
  'affiliateWelcome.footer':
    'Auszahlungen erfolgen über Wise, sobald Ihr Guthaben den monatlichen Mindestbetrag übersteigt. Bei Fragen antworten Sie einfach auf diese E-Mail oder besuchen Sie unser Hilfecenter.',
  'affiliateWelcome.subject': 'Sie sind Affiliate-Partner - Trading Alerts',

  'verify.heading': 'Bestätigen Sie Ihre E-Mail-Adresse',
  'verify.body':
    'Hallo {name}, klicken Sie auf die Schaltfläche unten, um Ihre E-Mail-Adresse zu bestätigen und Ihr Konto zu aktivieren.',
  'verify.button': 'E-Mail-Adresse bestätigen',
  'verify.ignore':
    'Wenn Sie kein Konto bei Trading Alerts erstellt haben, können Sie diese E-Mail einfach ignorieren.',
  'verify.expiry': 'Dieser Link läuft in 24 Stunden ab.',
  'verify.subject': 'Bestätigen Sie Ihre E-Mail-Adresse - Trading Alerts',

  'reset.heading': 'Passwort zurücksetzen',
  'reset.body':
    'Hallo {name}, wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Klicken Sie auf die Schaltfläche unten, um ein neues Passwort festzulegen.',
  'reset.button': 'Passwort zurücksetzen',
  'reset.ignore':
    'Wenn Sie das Zurücksetzen nicht angefordert haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.',
  'reset.expiry': 'Dieser Link läuft in 1 Stunde ab.',
  'reset.subject': 'Passwort zurücksetzen - Trading Alerts',

  'newDevice.heading': 'Anmeldung von einem neuen Gerät erkannt',
  'newDevice.body':
    'Hallo {name}, wir haben eine Anmeldung bei Ihrem Trading-Alerts-Konto von einem neuen Gerät festgestellt:',
  'newDevice.ifYou':
    '**Wenn Sie das waren:** Sie müssen nichts tun. Sie können diese E-Mail ignorieren.',
  'newDevice.ifNotYou':
    '**Wenn Sie das nicht waren:** Möglicherweise hat jemand Zugriff auf Ihr Konto. Wir empfehlen:',
  'newDevice.tip2':
    'Prüfen Sie Ihre aktiven Sitzungen und melden Sie unbekannte Geräte ab',
  'newDevice.tip3':
    'Aktivieren Sie die Zwei-Faktor-Authentifizierung für zusätzliche Sicherheit',
  'newDevice.subject':
    'Sicherheitshinweis: Anmeldung von einem neuen Gerät erkannt',

  'passwordChanged.heading': 'Passwort erfolgreich geändert',
  'passwordChanged.body':
    'Hallo {name}, das Passwort Ihres Trading-Alerts-Kontos wurde geändert.',
  'passwordChanged.ifYou':
    '**Wenn Sie die Änderung vorgenommen haben:** Sie müssen nichts tun. Ihr Konto ist sicher.',
  'passwordChanged.ifNotYou':
    '**Wenn Sie die Änderung nicht vorgenommen haben:** Ihr Konto könnte gefährdet sein. Bitte:',
  'passwordChanged.tip1':
    'Setzen Sie Ihr Passwort sofort über „Passwort vergessen“ zurück',
  'passwordChanged.tip2':
    'Prüfen Sie Ihr Konto auf nicht autorisierte Änderungen',
  'passwordChanged.tip3':
    'Wenden Sie sich an unser Support-Team, wenn Sie Hilfe benötigen',
  'passwordChanged.subject': 'Sicherheitshinweis: Passwort geändert',

  'twoFactorEnabled.heading': 'Zwei-Faktor-Authentifizierung aktiviert',
  'twoFactorEnabled.body':
    'Hallo {name}, die Zwei-Faktor-Authentifizierung wurde für Ihr Trading-Alerts-Konto erfolgreich aktiviert.',
  'twoFactorEnabled.remindersHeading': 'Wichtige Hinweise:',
  'twoFactorEnabled.reminder1': 'Bewahren Sie Ihre Backup-Codes sicher auf',
  'twoFactorEnabled.reminder2':
    'Für die Anmeldung benötigen Sie Ihre Authenticator-App',
  'twoFactorEnabled.reminder3':
    'Wenn Sie den Zugriff auf Ihre Authenticator-App verlieren, verwenden Sie einen Backup-Code',
  'twoFactorEnabled.ifNotYou':
    '**Wenn Sie 2FA nicht aktiviert haben:** Ihr Konto könnte gefährdet sein. Bitte wenden Sie sich umgehend an den Support.',
  'twoFactorEnabled.button': 'Sicherheitseinstellungen verwalten',
  'twoFactorEnabled.subject':
    'Sicherheitshinweis: Zwei-Faktor-Authentifizierung aktiviert',

  'twoFactorDisabled.heading': 'Zwei-Faktor-Authentifizierung deaktiviert',
  'twoFactorDisabled.body':
    'Hallo {name}, die Zwei-Faktor-Authentifizierung wurde für Ihr Trading-Alerts-Konto deaktiviert.',
  'twoFactorDisabled.warning':
    'Ihr Konto ist ohne Zwei-Faktor-Authentifizierung nun weniger sicher.',
  'twoFactorDisabled.ifYou':
    '**Wenn Sie 2FA deaktiviert haben:** Wir empfehlen, sie für maximale Sicherheit wieder zu aktivieren.',
  'twoFactorDisabled.ifNotYou':
    '**Wenn Sie 2FA nicht deaktiviert haben:** Ihr Konto könnte gefährdet sein. Bitte:',
  'twoFactorDisabled.tip2':
    'Aktivieren Sie die Zwei-Faktor-Authentifizierung erneut',
  'twoFactorDisabled.tip3':
    'Prüfen Sie Ihr Konto auf nicht autorisierte Änderungen',
  'twoFactorDisabled.subject':
    'Sicherheitshinweis: Zwei-Faktor-Authentifizierung deaktiviert',

  'payoutDetails.heading': 'Auszahlungsdaten geändert',
  'payoutDetails.body':
    'Hallo {name}, für Ihr Trading-Alerts-Partnerkonto wurden Auszahlungsdaten hinzugefügt oder geändert.',
  'payoutDetails.holdLabel': 'Auszahlungen gesperrt bis:',
  'payoutDetails.hold':
    'Zu Ihrer Sicherheit sind Auszahlungen an diese Daten für {hours} Stunden gesperrt. Ihre Einnahmen sind sicher und werden nach Ende der Sperre ausgezahlt.',
  'payoutDetails.ifYou':
    '**Wenn Sie diese Änderung vorgenommen haben:** Sie müssen nichts weiter tun.',
  'payoutDetails.ifNotYou':
    '**Wenn Sie diese Änderung nicht vorgenommen haben:** Ihr Konto könnte gefährdet sein. Bitte:',
  'payoutDetails.tip2':
    'Wenden Sie sich an unser Support-Team, bevor die Sperre endet',
  'payoutDetails.tip3':
    'Prüfen Sie Ihr Konto auf nicht autorisierte Änderungen',
  'payoutDetails.subject':
    'Sicherheitshinweis: Ihre Auszahlungsdaten wurden geändert',

  'accountDeletion.heading': 'Löschung Ihres Kontos bestätigen',
  'accountDeletion.body':
    'Hallo {name}, wir haben eine Anfrage erhalten, Ihr Trading-Alerts-Konto dauerhaft zu löschen.',
  'accountDeletion.confirmIntro':
    '**Um fortzufahren,** bestätigen Sie die Löschung mit der Schaltfläche unten. Dies kann nicht rückgängig gemacht werden.',
  'accountDeletion.confirmButton': 'Kontolöschung bestätigen',
  'accountDeletion.cancelIntro':
    '**Wenn Sie es sich anders überlegt haben oder die Anfrage nicht von Ihnen stammt,** brechen Sie sie stattdessen ab:',
  'accountDeletion.cancelButton': 'Löschanfrage abbrechen',
  'accountDeletion.expiry':
    'Diese Links laufen am {date} ab. Wer diese Links besitzt, kann über Ihre Anfrage entscheiden – leiten Sie diese E-Mail daher bitte nicht weiter.',
  'accountDeletion.subject':
    'Löschung Ihres Kontos bestätigen - Trading Alerts',

  'subscription.heading': 'Abonnement bestätigt!',
  'subscription.body':
    'Hallo {name}, Ihr Abonnement **{plan}** ist jetzt aktiv.',
  'subscription.planDetails': 'Plandetails',
  'subscription.tier': 'Stufe:',
  'subscription.billing': 'Abrechnung:',
  'subscription.trial':
    '7 Tage kostenlos testen: Ihre Karte wird erst belastet, wenn die Testphase endet.',
  'subscription.proHeading': 'Das erhalten Sie mit Pro:',
  'subscription.pro1':
    '**100 Preisalarme** - Verpassen Sie keine Handelschance',
  'subscription.pro2':
    '**Linienalarme der Zeichen-Engine** - Zeichnen Sie eine Linie im Chart und lassen Sie sich benachrichtigen, wenn der Preis sie berührt',
  'subscription.pro3':
    '**Multi-Timeframe-Darstellung** - M5-Struktur über M15-Charts legen',
  'subscription.pro4':
    '**Exklusive XAUUSD-Einblicke** - Vollständige M5/M15-Indikatordaten (alle 79 Spalten)',
  'subscription.pro5': '**300 API-Anfragen pro Stunde**',
  'subscription.pro6': '**Prioritäts-Support und Datenexport**',
  'subscription.freeHeading': 'Ihr kostenloser Plan enthält:',
  'subscription.free1': '**XAUUSD (Gold)** - M5- und M15-Charts',
  'subscription.free2':
    '**Vollständige Indikatordaten** - Dieselben Marktdaten wie bei Pro',
  'subscription.free3': '**60 API-Anfragen pro Stunde**',
  'subscription.upgradeLead':
    '{link} für Alarme, Linienalarme und die Multi-Timeframe-Ansicht!',
  'subscription.upgradeLink': 'Auf Pro upgraden',
  'subscription.subject': 'Abonnement {plan} bestätigt',

  'cancellation.heading': 'Abonnement gekündigt',
  'cancellation.body': 'Ihr PRO-Abonnement bei {app} wurde gekündigt.',
  'cancellation.freeAccess': 'Sie haben jetzt Zugriff auf die FREE-Stufe:',
  'cancellation.changedMind': 'Anders entschieden?',
  'cancellation.upgradeAgain':
    'Sie können jederzeit wieder upgraden und erhalten erneut Zugriff auf alle PRO-Funktionen.',
  'cancellation.button': 'Preise ansehen',
  'cancellation.thanks': 'Danke, dass Sie PRO ausprobiert haben!',
  'cancellation.subject': 'Ihr PRO-Abonnement wurde gekündigt',

  'paymentFailed.heading': 'Zahlung fehlgeschlagen',
  'paymentFailed.body':
    'Wir konnten Ihre Zahlung für {app} PRO ({amount}) nicht verarbeiten.',
  'paymentFailed.reason': '**Grund:** {reason}',
  'paymentFailed.action':
    '**Bitte aktualisieren Sie Ihre Zahlungsmethode innerhalb von 3 Tagen,** um Ihren PRO-Zugang zu behalten.',
  'paymentFailed.button': 'Zahlungsmethode aktualisieren',
  'paymentFailed.downgrade':
    'Wird das Problem nicht behoben, wird Ihr Konto auf die FREE-Stufe zurückgestuft.',
  'paymentFailed.subject': 'Zahlung fehlgeschlagen - Handeln erforderlich',

  'receipt.title': 'Zahlungsbeleg',
  'receipt.heading': 'Zahlung erfolgreich',
  'receipt.body': 'Ihre Zahlung war erfolgreich!',
  'receipt.description': 'Beschreibung',
  'receipt.descriptionValue': '{app} PRO - Monatlich',
  'receipt.amount': 'Betrag',
  'receipt.date': 'Datum',
  'receipt.nextBilling': 'Nächstes Abrechnungsdatum',
  'receipt.button': 'Rechnung herunterladen',
  'receipt.thanks': 'Danke, dass Sie PRO-Mitglied sind!',
  'receipt.subject': 'Zahlungsbeleg - {app} PRO',

  'canceled.heading': 'Abonnement gekündigt',
  'canceled.body': 'Ihr Abonnement **{plan}** wurde gekündigt.',
  'canceled.accessUntil': '**Zugang bis:** {date}',
  'canceled.accessNote': 'Sie haben bis zum {date} weiterhin {plan}-Zugang.',
  'canceled.afterwards':
    'Danach wechselt Ihr Konto zurück zum **Free**-Plan mit:',
  'canceled.reactivate': 'Anders entschieden? {link}',
  'canceled.reactivateLink': 'Abonnement reaktivieren',
  'canceled.subject': 'Abonnement gekündigt - Trading Alerts',

  'commission.heading': 'Provision verdient!',
  'commission.body':
    'Gute Neuigkeiten! Ihr Affiliate-Code wurde gerade verwendet und Sie haben eine Provision verdient.',
  'commission.codeUsed': 'Verwendeter Code',
  'commission.earned': 'Verdiente Provision',
  'commission.total': 'Gesamteinnahmen',
  'commission.rate': '**Provisionssatz:** {percent} % der Abonnementeinnahmen',
  'commission.button': 'Dashboard ansehen',
  'commission.subject': 'Provision verdient! {amount} - {app}',
};
