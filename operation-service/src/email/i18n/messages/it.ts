import type { EmailMessages } from './en-US';

export const it: EmailMessages = {
  'common.greeting': 'Ciao {name},',
  'common.userFallback': 'utente',
  'common.questions':
    'Per qualsiasi domanda, rispondi a questa email o visita il nostro centro assistenza.',
  'common.signature': 'Il team di {app}',
  'common.needHelpContact': 'Hai bisogno di aiuto? Scrivici a {email}',
  'common.needHelpReply':
    'Hai bisogno di aiuto? Rispondi a questa email o scrivici a {email}',
  'common.securityAlertsNote':
    'Ricevi questa email perché hai attivato gli avvisi di sicurezza.',
  'common.manageNotifications': 'Gestisci le preferenze di notifica',

  'label.time': 'Ora:',
  'label.location': 'Posizione:',
  'label.ipAddress': 'Indirizzo IP:',
  'label.device': 'Dispositivo:',
  'label.browser': 'Browser:',
  'label.os': 'Sistema operativo:',

  'value.unknown': 'Sconosciuto',
  'value.unknownLocation': 'Posizione sconosciuta',
  'value.device.desktop': 'Computer',
  'value.device.mobile': 'Smartphone',
  'value.device.tablet': 'Tablet',

  'billing.perMonth': '{price}/mese',
  'billing.perYear': '{price}/anno',
  'billing.perThreeDays': '{price}/3 giorni',

  'security.changePassword': 'Cambia subito la password',
  'security.secureButton': 'Proteggi il mio account',

  'freeTier.xauusd': 'XAUUSD (oro) su M5 e M15',
  'freeTier.marketData': 'Dati di mercato completi e overlay degli indicatori',
  'freeTier.noAlerts': 'Nessun avviso di prezzo (funzione PRO)',

  'welcome.title': 'Benvenuto su Trading Alerts',
  'welcome.heading': 'Benvenuto su Trading Alerts, {name}!',
  'welcome.body':
    'Il tuo account è stato creato con successo. Ora puoi configurare il tuo primo avviso di trading!',
  'welcome.getStarted': 'Come iniziare:',
  'welcome.step1': 'Apri il grafico XAUUSD su M5 o M15',
  'welcome.step2': 'Esplora gli overlay di canali e struttura',
  'welcome.step3': 'Personalizza le tue preferenze di notifica',
  'welcome.button': 'Vai alla dashboard',
  'welcome.subject': 'Benvenuto su Trading Alerts!',

  'affiliateWelcome.title': 'Benvenuto nel programma di affiliazione',
  'affiliateWelcome.heading': 'Ora sei un partner affiliato, {name}!',
  'affiliateWelcome.body':
    'Il tuo account affiliato è attivo. Abbiamo generato i tuoi primi {count} codici di invito: sono già disponibili nella tua dashboard.',
  'affiliateWelcome.button': 'Vai alla dashboard affiliati',
  'affiliateWelcome.footer':
    'I pagamenti vengono inviati tramite Wise quando il tuo saldo supera il minimo mensile. Per qualsiasi domanda, rispondi a questa email o visita il nostro centro assistenza.',
  'affiliateWelcome.subject': 'Sei un partner affiliato - Trading Alerts',

  'verify.heading': 'Verifica il tuo indirizzo email',
  'verify.body':
    'Ciao {name}, fai clic sul pulsante qui sotto per verificare il tuo indirizzo email e attivare il tuo account.',
  'verify.button': 'Verifica indirizzo email',
  'verify.ignore':
    'Se non hai creato un account su Trading Alerts, puoi ignorare questa email.',
  'verify.expiry': 'Questo link scadrà tra 24 ore.',
  'verify.subject': 'Verifica la tua email - Trading Alerts',

  'reset.heading': 'Reimposta la tua password',
  'reset.body':
    'Ciao {name}, abbiamo ricevuto una richiesta di reimpostazione della tua password. Fai clic sul pulsante qui sotto per crearne una nuova.',
  'reset.button': 'Reimposta password',
  'reset.ignore':
    'Se non hai richiesto la reimpostazione della password, puoi ignorare questa email. La tua password rimarrà invariata.',
  'reset.expiry': 'Questo link scadrà tra 1 ora.',
  'reset.subject': 'Reimposta la tua password - Trading Alerts',

  'newDevice.heading': 'Accesso rilevato da un nuovo dispositivo',
  'newDevice.body':
    'Ciao {name}, abbiamo rilevato un accesso al tuo account Trading Alerts da un nuovo dispositivo:',
  'newDevice.ifYou':
    '**Se sei stato tu:** non è necessaria alcuna azione. Puoi ignorare questa email.',
  'newDevice.ifNotYou':
    '**Se non sei stato tu:** qualcuno potrebbe avere accesso al tuo account. Ti consigliamo di:',
  'newDevice.tip2':
    'Controllare le sessioni attive e disconnettere i dispositivi sconosciuti',
  'newDevice.tip3':
    "Attivare l'autenticazione a due fattori per una maggiore sicurezza",
  'newDevice.subject':
    'Avviso di sicurezza: accesso rilevato da un nuovo dispositivo',

  'passwordChanged.heading': 'Password modificata con successo',
  'passwordChanged.body':
    'Ciao {name}, la password del tuo account Trading Alerts è stata modificata.',
  'passwordChanged.ifYou':
    '**Se hai effettuato tu la modifica:** non è necessaria alcuna azione. Il tuo account è al sicuro.',
  'passwordChanged.ifNotYou':
    '**Se non hai effettuato tu la modifica:** il tuo account potrebbe essere compromesso. Per favore:',
  'passwordChanged.tip1':
    'Reimposta subito la password con la funzione «Password dimenticata?»',
  'passwordChanged.tip2':
    'Controlla il tuo account per eventuali modifiche non autorizzate',
  'passwordChanged.tip3':
    'Contatta il nostro team di assistenza se hai bisogno di aiuto',
  'passwordChanged.subject': 'Avviso di sicurezza: password modificata',

  'twoFactorEnabled.heading': 'Autenticazione a due fattori attivata',
  'twoFactorEnabled.body':
    "Ciao {name}, l'autenticazione a due fattori è stata attivata con successo sul tuo account Trading Alerts.",
  'twoFactorEnabled.remindersHeading': 'Promemoria importanti:',
  'twoFactorEnabled.reminder1':
    'Conserva i codici di backup in un luogo sicuro',
  'twoFactorEnabled.reminder2':
    'Ti servirà la tua app di autenticazione per accedere',
  'twoFactorEnabled.reminder3':
    "Se perdi l'accesso alla tua app di autenticazione, usa un codice di backup",
  'twoFactorEnabled.ifNotYou':
    "**Se non hai attivato tu l'autenticazione a due fattori:** il tuo account potrebbe essere compromesso. Contatta subito l'assistenza.",
  'twoFactorEnabled.button': 'Gestisci le impostazioni di sicurezza',
  'twoFactorEnabled.subject':
    'Avviso di sicurezza: autenticazione a due fattori attivata',

  'twoFactorDisabled.heading': 'Autenticazione a due fattori disattivata',
  'twoFactorDisabled.body':
    "Ciao {name}, l'autenticazione a due fattori è stata disattivata sul tuo account Trading Alerts.",
  'twoFactorDisabled.warning':
    "Senza l'autenticazione a due fattori il tuo account è meno sicuro.",
  'twoFactorDisabled.ifYou':
    "**Se l'hai disattivata tu:** ti consigliamo di riattivarla per la massima sicurezza.",
  'twoFactorDisabled.ifNotYou':
    "**Se non l'hai disattivata tu:** il tuo account potrebbe essere compromesso. Per favore:",
  'twoFactorDisabled.tip2': "Riattiva l'autenticazione a due fattori",
  'twoFactorDisabled.tip3':
    'Controlla il tuo account per eventuali modifiche non autorizzate',
  'twoFactorDisabled.subject':
    'Avviso di sicurezza: autenticazione a due fattori disattivata',

  'accountDeletion.heading': "Conferma l'eliminazione del tuo account",
  'accountDeletion.body':
    'Ciao {name}, abbiamo ricevuto una richiesta di eliminazione definitiva del tuo account Trading Alerts.',
  'accountDeletion.confirmIntro':
    "**Per procedere,** conferma l'eliminazione con il pulsante qui sotto. L'operazione non può essere annullata.",
  'accountDeletion.confirmButton': "Conferma l'eliminazione dell'account",
  'accountDeletion.cancelIntro':
    '**Se hai cambiato idea o non sei stato tu,** annulla invece la richiesta:',
  'accountDeletion.cancelButton': 'Annulla la richiesta di eliminazione',
  'accountDeletion.expiry':
    'Questi link scadono il {date}. Chiunque disponga di questi link può agire sulla tua richiesta, quindi non inoltrare questa email.',
  'accountDeletion.subject':
    "Conferma l'eliminazione del tuo account - Trading Alerts",

  'subscription.heading': 'Abbonamento confermato!',
  'subscription.body':
    'Ciao {name}, il tuo abbonamento **{plan}** è ora attivo.',
  'subscription.planDetails': 'Dettagli del piano',
  'subscription.tier': 'Livello:',
  'subscription.billing': 'Fatturazione:',
  'subscription.trial':
    'Prova gratuita di 7 giorni: la tua carta non verrà addebitata fino al termine della prova.',
  'subscription.proHeading': 'Cosa ottieni con Pro:',
  'subscription.pro1':
    '**100 avvisi di prezzo** - Non perdere nessuna opportunità di trading',
  'subscription.pro2':
    '**Avvisi sulle linee del motore di disegno** - Traccia una linea sul grafico e ricevi un avviso quando il prezzo la tocca',
  'subscription.pro3':
    '**Visualizzazione multi-timeframe** - Sovrapponi la struttura M5 ai grafici M15',
  'subscription.pro4':
    '**Analisi esclusive su XAUUSD** - Dati completi degli indicatori M5/M15 (tutte le 79 colonne)',
  'subscription.pro5': "**300 richieste API all'ora**",
  'subscription.pro6': '**Assistenza prioritaria ed esportazione dei dati**',
  'subscription.freeHeading': 'Il tuo piano gratuito include:',
  'subscription.free1': '**XAUUSD (oro)** - grafici M5 e M15',
  'subscription.free2':
    '**Dati completi degli indicatori** - Gli stessi dati di mercato di Pro',
  'subscription.free3': "**60 richieste API all'ora**",
  'subscription.upgradeLead':
    '{link} per avvisi, avvisi sulle linee e visualizzazione multi-timeframe!',
  'subscription.upgradeLink': 'Passa a Pro',
  'subscription.subject': 'Abbonamento {plan} confermato',

  'cancellation.heading': 'Abbonamento annullato',
  'cancellation.body': 'Il tuo abbonamento PRO a {app} è stato annullato.',
  'cancellation.freeAccess': 'Ora hai accesso al livello FREE:',
  'cancellation.changedMind': 'Hai cambiato idea?',
  'cancellation.upgradeAgain':
    "Puoi passare di nuovo a PRO in qualsiasi momento per riottenere l'accesso a tutte le funzioni PRO.",
  'cancellation.button': 'Visualizza i prezzi',
  'cancellation.thanks': 'Grazie per aver provato PRO!',
  'cancellation.subject': 'Il tuo abbonamento PRO è stato annullato',

  'paymentFailed.heading': 'Pagamento non riuscito',
  'paymentFailed.body':
    'Non siamo riusciti a elaborare il tuo pagamento per {app} PRO ({amount}).',
  'paymentFailed.reason': '**Motivo:** {reason}',
  'paymentFailed.action':
    "**Aggiorna il tuo metodo di pagamento entro 3 giorni** per mantenere l'accesso PRO.",
  'paymentFailed.button': 'Aggiorna il metodo di pagamento',
  'paymentFailed.downgrade':
    'Se il problema non viene risolto, il tuo account passerà al livello FREE.',
  'paymentFailed.subject': 'Pagamento non riuscito - Azione richiesta',

  'receipt.title': 'Ricevuta di pagamento',
  'receipt.heading': 'Pagamento riuscito',
  'receipt.body': 'Il tuo pagamento è andato a buon fine!',
  'receipt.description': 'Descrizione',
  'receipt.descriptionValue': '{app} PRO - Mensile',
  'receipt.amount': 'Importo',
  'receipt.date': 'Data',
  'receipt.nextBilling': 'Prossima data di fatturazione',
  'receipt.button': 'Scarica la fattura',
  'receipt.thanks': 'Grazie per essere un membro PRO!',
  'receipt.subject': 'Ricevuta di pagamento - {app} PRO',

  'canceled.heading': 'Abbonamento annullato',
  'canceled.body': 'Il tuo abbonamento **{plan}** è stato annullato.',
  'canceled.accessUntil': '**Accesso fino al:** {date}',
  'canceled.accessNote':
    "Continuerai ad avere l'accesso {plan} fino al {date}.",
  'canceled.afterwards':
    'Dopo tale data il tuo account tornerà al piano **Free**, che include:',
  'canceled.reactivate': 'Hai cambiato idea? {link}',
  'canceled.reactivateLink': 'Riattiva il tuo abbonamento',
  'canceled.subject': 'Abbonamento annullato - Trading Alerts',

  'commission.heading': 'Commissione guadagnata!',
  'commission.body':
    'Ottime notizie! Il tuo codice affiliato è stato appena utilizzato e hai guadagnato una commissione.',
  'commission.codeUsed': 'Codice utilizzato',
  'commission.earned': 'Commissione guadagnata',
  'commission.total': 'Guadagni totali',
  'commission.rate':
    "**Percentuale di commissione:** {percent}% dei ricavi dell'abbonamento",
  'commission.button': 'Visualizza la dashboard',
  'commission.subject': 'Commissione guadagnata! {amount} - {app}',
};
