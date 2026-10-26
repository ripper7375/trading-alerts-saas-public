import type { EmailMessages } from './en-US';

export const fr: EmailMessages = {
  'common.greeting': 'Bonjour {name},',
  'common.userFallback': 'utilisateur',
  'common.questions':
    "Pour toute question, répondez à cet e-mail ou consultez notre centre d'aide.",
  'common.signature': "L'équipe {app}",
  'common.needHelpContact': "Besoin d'aide ? Écrivez-nous à {email}",
  'common.needHelpReply':
    "Besoin d'aide ? Répondez à cet e-mail ou écrivez-nous à {email}",
  'common.securityAlertsNote':
    'Vous recevez cet e-mail parce que les alertes de sécurité sont activées sur votre compte.',
  'common.manageNotifications': 'Gérer les préférences de notification',

  'label.time': 'Heure :',
  'label.location': 'Lieu :',
  'label.ipAddress': 'Adresse IP :',
  'label.device': 'Appareil :',
  'label.browser': 'Navigateur :',
  'label.os': "Système d'exploitation :",

  'value.unknown': 'Inconnu',
  'value.unknownLocation': 'Lieu inconnu',
  'value.device.desktop': 'Ordinateur',
  'value.device.mobile': 'Mobile',
  'value.device.tablet': 'Tablette',

  'billing.perMonth': '{price}/mois',
  'billing.perYear': '{price}/an',
  'billing.perThreeDays': '{price}/3 jours',

  'security.changePassword': 'Modifiez immédiatement votre mot de passe',
  'security.secureButton': 'Sécuriser mon compte',

  'freeTier.xauusd': 'XAUUSD (or) en M5 et M15',
  'freeTier.marketData':
    "Données de marché complètes et superpositions d'indicateurs",
  'freeTier.noAlerts': "Pas d'alertes de prix (fonctionnalité PRO)",

  'welcome.title': 'Bienvenue sur Trading Alerts',
  'welcome.heading': 'Bienvenue sur Trading Alerts, {name} !',
  'welcome.body':
    'Votre compte a bien été créé. Vous pouvez maintenant configurer votre première alerte de trading !',
  'welcome.getStarted': 'Pour commencer :',
  'welcome.step1': 'Ouvrez le graphique XAUUSD en M5 ou M15',
  'welcome.step2': 'Explorez les superpositions de canaux et de structure',
  'welcome.step3': 'Personnalisez vos préférences de notification',
  'welcome.button': 'Accéder au tableau de bord',
  'welcome.subject': 'Bienvenue sur Trading Alerts !',

  'affiliateWelcome.title': "Bienvenue dans le programme d'affiliation",
  'affiliateWelcome.heading':
    'Vous êtes désormais partenaire affilié, {name} !',
  'affiliateWelcome.body':
    'Votre compte affilié est actif. Nous avons généré vos {count} premiers codes de parrainage : ils sont déjà disponibles dans votre tableau de bord.',
  'affiliateWelcome.button': 'Accéder au tableau de bord affilié',
  'affiliateWelcome.footer':
    "Les paiements sont envoyés via Wise dès que votre solde dépasse le minimum mensuel. Pour toute question, répondez à cet e-mail ou consultez notre centre d'aide.",
  'affiliateWelcome.subject': 'Vous êtes partenaire affilié - Trading Alerts',

  'verify.heading': 'Vérifiez votre adresse e-mail',
  'verify.body':
    'Bonjour {name}, cliquez sur le bouton ci-dessous pour vérifier votre adresse e-mail et activer votre compte.',
  'verify.button': "Vérifier l'adresse e-mail",
  'verify.ignore':
    "Si vous n'avez pas créé de compte sur Trading Alerts, vous pouvez ignorer cet e-mail.",
  'verify.expiry': 'Ce lien expirera dans 24 heures.',
  'verify.subject': 'Vérifiez votre adresse e-mail - Trading Alerts',

  'reset.heading': 'Réinitialisez votre mot de passe',
  'reset.body':
    'Bonjour {name}, nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en créer un nouveau.',
  'reset.button': 'Réinitialiser le mot de passe',
  'reset.ignore':
    "Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail. Votre mot de passe restera inchangé.",
  'reset.expiry': 'Ce lien expirera dans 1 heure.',
  'reset.subject': 'Réinitialisez votre mot de passe - Trading Alerts',

  'newDevice.heading': 'Connexion détectée depuis un nouvel appareil',
  'newDevice.body':
    'Bonjour {name}, nous avons détecté une connexion à votre compte Trading Alerts depuis un nouvel appareil :',
  'newDevice.ifYou':
    "**Si c'était vous :** aucune action n'est nécessaire. Vous pouvez ignorer cet e-mail.",
  'newDevice.ifNotYou':
    "**Si ce n'était pas vous :** quelqu'un a peut-être accès à votre compte. Nous vous recommandons de :",
  'newDevice.tip2':
    'Vérifier vos sessions actives et déconnecter les appareils inconnus',
  'newDevice.tip3':
    "Activer l'authentification à deux facteurs pour plus de sécurité",
  'newDevice.subject':
    'Alerte de sécurité : connexion détectée depuis un nouvel appareil',

  'passwordChanged.heading': 'Mot de passe modifié avec succès',
  'passwordChanged.body':
    'Bonjour {name}, le mot de passe de votre compte Trading Alerts a été modifié.',
  'passwordChanged.ifYou':
    "**Si vous avez effectué cette modification :** aucune action n'est nécessaire. Votre compte est en sécurité.",
  'passwordChanged.ifNotYou':
    "**Si vous n'êtes pas à l'origine de cette modification :** votre compte est peut-être compromis. Veuillez :",
  'passwordChanged.tip1':
    'Réinitialiser immédiatement votre mot de passe grâce à la fonction « Mot de passe oublié ? »',
  'passwordChanged.tip2':
    'Vérifier que votre compte ne comporte aucune modification non autorisée',
  'passwordChanged.tip3':
    "Contacter notre équipe d'assistance si vous avez besoin d'aide",
  'passwordChanged.subject': 'Alerte de sécurité : mot de passe modifié',

  'twoFactorEnabled.heading': 'Authentification à deux facteurs activée',
  'twoFactorEnabled.body':
    "Bonjour {name}, l'authentification à deux facteurs a bien été activée sur votre compte Trading Alerts.",
  'twoFactorEnabled.remindersHeading': 'Rappels importants :',
  'twoFactorEnabled.reminder1': 'Conservez vos codes de secours en lieu sûr',
  'twoFactorEnabled.reminder2':
    "Vous aurez besoin de votre application d'authentification pour vous connecter",
  'twoFactorEnabled.reminder3':
    "Si vous perdez l'accès à votre application d'authentification, utilisez un code de secours",
  'twoFactorEnabled.ifNotYou':
    "**Si vous n'avez pas activé l'authentification à deux facteurs :** votre compte est peut-être compromis. Contactez immédiatement l'assistance.",
  'twoFactorEnabled.button': 'Gérer les paramètres de sécurité',
  'twoFactorEnabled.subject':
    'Alerte de sécurité : authentification à deux facteurs activée',

  'twoFactorDisabled.heading': 'Authentification à deux facteurs désactivée',
  'twoFactorDisabled.body':
    "Bonjour {name}, l'authentification à deux facteurs a été désactivée sur votre compte Trading Alerts.",
  'twoFactorDisabled.warning':
    'Sans authentification à deux facteurs, votre compte est désormais moins sécurisé.',
  'twoFactorDisabled.ifYou':
    "**Si c'est vous qui l'avez désactivée :** nous vous recommandons de la réactiver pour une sécurité maximale.",
  'twoFactorDisabled.ifNotYou':
    "**Si ce n'est pas vous qui l'avez désactivée :** votre compte est peut-être compromis. Veuillez :",
  'twoFactorDisabled.tip2': "Réactiver l'authentification à deux facteurs",
  'twoFactorDisabled.tip3':
    'Vérifier que votre compte ne comporte aucune modification non autorisée',
  'twoFactorDisabled.subject':
    'Alerte de sécurité : authentification à deux facteurs désactivée',

  'payoutDetails.heading': 'Coordonnées de paiement modifiées',
  'payoutDetails.body':
    'Bonjour {name}, les coordonnées de paiement de votre compte affilié Trading Alerts ont été ajoutées ou modifiées.',
  'payoutDetails.holdLabel': "Paiements suspendus jusqu'au :",
  'payoutDetails.hold':
    'Pour votre protection, les paiements vers ces coordonnées sont suspendus pendant {hours} heures. Vos gains sont en sécurité et seront versés à la fin de la suspension.',
  'payoutDetails.ifYou':
    "**Si vous avez effectué cette modification :** aucune action n'est nécessaire.",
  'payoutDetails.ifNotYou':
    "**Si vous n'avez pas effectué cette modification :** votre compte est peut-être compromis. Veuillez :",
  'payoutDetails.tip2':
    "Contacter notre équipe d'assistance avant la fin de la suspension",
  'payoutDetails.tip3':
    'Vérifier que votre compte ne comporte aucune modification non autorisée',
  'payoutDetails.subject':
    'Alerte de sécurité : vos coordonnées de paiement ont été modifiées',

  'accountDeletion.heading': 'Confirmez la suppression de votre compte',
  'accountDeletion.body':
    'Bonjour {name}, nous avons reçu une demande de suppression définitive de votre compte Trading Alerts.',
  'accountDeletion.confirmIntro':
    '**Pour continuer,** confirmez la suppression avec le bouton ci-dessous. Cette action est irréversible.',
  'accountDeletion.confirmButton': 'Confirmer la suppression du compte',
  'accountDeletion.cancelIntro':
    "**Si vous avez changé d'avis ou si ce n'était pas vous,** annulez plutôt la demande :",
  'accountDeletion.cancelButton': 'Annuler la demande de suppression',
  'accountDeletion.expiry':
    'Ces liens expirent le {date}. Toute personne disposant de ces liens peut agir sur votre demande ; veuillez donc ne pas transférer cet e-mail.',
  'accountDeletion.subject':
    'Confirmez la suppression de votre compte - Trading Alerts',

  'subscription.heading': 'Abonnement confirmé !',
  'subscription.body':
    'Bonjour {name}, votre abonnement **{plan}** est maintenant actif.',
  'subscription.planDetails': "Détails de l'offre",
  'subscription.tier': 'Niveau :',
  'subscription.billing': 'Facturation :',
  'subscription.trial':
    "Essai gratuit de 7 jours : votre carte ne sera pas débitée avant la fin de l'essai.",
  'subscription.proHeading': 'Ce que vous obtenez avec Pro :',
  'subscription.pro1':
    '**100 alertes de prix** - Ne manquez plus aucune opportunité de trading',
  'subscription.pro2':
    '**Alertes sur lignes du moteur de dessin** - Tracez une ligne sur le graphique et soyez alerté lorsque le prix la touche',
  'subscription.pro3':
    '**Visualisation multi-timeframe** - Superposez la structure M5 aux graphiques M15',
  'subscription.pro4':
    '**Analyses exclusives sur XAUUSD** - Données complètes des indicateurs M5/M15 (les 79 colonnes)',
  'subscription.pro5': '**300 requêtes API par heure**',
  'subscription.pro6': '**Assistance prioritaire et export des données**',
  'subscription.freeHeading': 'Votre offre gratuite comprend :',
  'subscription.free1': '**XAUUSD (or)** - graphiques M5 et M15',
  'subscription.free2':
    '**Données complètes des indicateurs** - Les mêmes données de marché que Pro',
  'subscription.free3': '**60 requêtes API par heure**',
  'subscription.upgradeLead':
    '{link} pour bénéficier des alertes, des alertes sur lignes et de la vue multi-timeframe !',
  'subscription.upgradeLink': 'Passez à Pro',
  'subscription.subject': 'Abonnement {plan} confirmé',

  'cancellation.heading': 'Abonnement résilié',
  'cancellation.body': 'Votre abonnement PRO à {app} a été résilié.',
  'cancellation.freeAccess': 'Vous avez maintenant accès au niveau FREE :',
  'cancellation.changedMind': "Vous avez changé d'avis ?",
  'cancellation.upgradeAgain':
    "Vous pouvez repasser à PRO à tout moment pour retrouver l'accès à toutes les fonctionnalités PRO.",
  'cancellation.button': 'Voir les tarifs',
  'cancellation.thanks': "Merci d'avoir essayé PRO !",
  'cancellation.subject': 'Votre abonnement PRO a été résilié',

  'paymentFailed.heading': 'Échec du paiement',
  'paymentFailed.body':
    "Nous n'avons pas pu traiter votre paiement pour {app} PRO ({amount}).",
  'paymentFailed.reason': '**Motif :** {reason}',
  'paymentFailed.action':
    '**Veuillez mettre à jour votre moyen de paiement sous 3 jours** pour conserver votre accès PRO.',
  'paymentFailed.button': 'Mettre à jour le moyen de paiement',
  'paymentFailed.downgrade':
    "Si le problème n'est pas résolu, votre compte repassera au niveau FREE.",
  'paymentFailed.subject': 'Échec du paiement - Action requise',

  'receipt.title': 'Reçu de paiement',
  'receipt.heading': 'Paiement réussi',
  'receipt.body': 'Votre paiement a bien été effectué !',
  'receipt.description': 'Description',
  'receipt.descriptionValue': '{app} PRO - Mensuel',
  'receipt.amount': 'Montant',
  'receipt.date': 'Date',
  'receipt.nextBilling': 'Prochaine date de facturation',
  'receipt.button': 'Télécharger la facture',
  'receipt.thanks': 'Merci de faire partie des membres PRO !',
  'receipt.subject': 'Reçu de paiement - {app} PRO',

  'canceled.heading': 'Abonnement résilié',
  'canceled.body': 'Votre abonnement **{plan}** a été résilié.',
  'canceled.accessUntil': "**Accès jusqu'au :** {date}",
  'canceled.accessNote': "Vous conserverez l'accès {plan} jusqu'au {date}.",
  'canceled.afterwards':
    "Ensuite, votre compte repassera à l'offre **Free**, qui comprend :",
  'canceled.reactivate': "Vous avez changé d'avis ? {link}",
  'canceled.reactivateLink': 'Réactivez votre abonnement',
  'canceled.subject': 'Abonnement résilié - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': 'Abonnement repris',
  'resumed.body': 'Votre abonnement **{plan}** se poursuit.',
  'resumed.nextBilling': '**Prochaine date de facturation :** {date}',
  'resumed.note':
    "Votre résiliation a été annulée. Vous conservez l'accès complet à {plan} et votre abonnement sera renouvelé automatiquement le {date}.",
  'resumed.manage':
    'Vous pouvez consulter votre abonnement à tout moment. {link}',
  'resumed.manageLink': 'Ouvrir les paramètres de facturation',
  'resumed.subject': 'Votre abonnement {plan} se poursuit - Trading Alerts',

  // ── Plan change: upgraded to yearly, switch to monthly scheduled (S3) ──
  'upgraded.heading': 'Passage à la facturation annuelle',
  'upgraded.body':
    'Votre abonnement **{plan}** est désormais facturé chaque année.',
  'upgraded.charged': "**Débité aujourd'hui :** {amount}",
  'upgraded.price': '**Prix annuel :** {price}',
  'upgraded.nextBilling': '**Prochaine date de facturation :** {date}',
  'upgraded.firstCharge': '**Premier prélèvement :** {date}',
  'upgraded.note':
    "Le prélèvement d'aujourd'hui correspond au prix annuel moins le crédit pour la partie inutilisée de votre période mensuelle en cours.",
  'upgraded.trialNote':
    "Votre essai gratuit se poursuit et rien n'a été débité aujourd'hui. Votre premier prélèvement, au prix annuel, aura lieu le {date}.",
  'upgraded.subject':
    'Vous êtes maintenant en facturation annuelle - Trading Alerts',
  'switchScheduled.heading': 'Passage à la facturation mensuelle programmé',
  'switchScheduled.body':
    'Votre abonnement **{plan}** passera à la facturation mensuelle le {date}.',
  'switchScheduled.date': '**Date du changement :** {date}',
  'switchScheduled.price': '**Prix mensuel à partir de cette date :** {price}',
  'switchScheduled.note':
    "Vous conservez votre accès annuel jusqu'au {date}. Rien n'est débité ni remboursé maintenant, et il n'y a pas de crédit pour l'année en cours.",
  'switchScheduled.keep':
    "Vous avez changé d'avis ? Vous pouvez conserver la facturation annuelle avant cette date. {link}",
  'switchScheduled.subject':
    'Votre passage à la facturation mensuelle est programmé - Trading Alerts',
  'planChange.manage':
    'Vous pouvez consulter votre abonnement à tout moment. {link}',
  'planChange.manageLink': 'Ouvrir les paramètres de facturation',

  'commission.heading': 'Commission gagnée !',
  'commission.body':
    "Bonne nouvelle ! Votre code d'affilié vient d'être utilisé et vous avez gagné une commission.",
  'commission.codeUsed': 'Code utilisé',
  'commission.earned': 'Commission gagnée',
  'commission.total': 'Gains totaux',
  'commission.rate':
    "**Taux de commission :** {percent} % des revenus d'abonnement",
  'commission.button': 'Voir le tableau de bord',
  'commission.subject': 'Commission gagnée ! {amount} - {app}',
};
