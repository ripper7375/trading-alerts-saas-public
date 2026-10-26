import type { EmailMessages } from './en-US';

/** European Portuguese. */
export const pt: EmailMessages = {
  'common.greeting': 'Olá {name},',
  'common.userFallback': 'utilizador',
  'common.questions':
    'Se tiver alguma dúvida, responda a este e-mail ou visite o nosso centro de ajuda.',
  'common.signature': 'A equipa {app}',
  'common.needHelpContact': 'Precisa de ajuda? Contacte-nos em {email}',
  'common.needHelpReply':
    'Precisa de ajuda? Responda a este e-mail ou contacte-nos em {email}',
  'common.securityAlertsNote':
    'Recebe este e-mail porque tem os alertas de segurança ativados.',
  'common.manageNotifications': 'Gerir as preferências de notificação',

  'label.time': 'Hora:',
  'label.location': 'Localização:',
  'label.ipAddress': 'Endereço IP:',
  'label.device': 'Dispositivo:',
  'label.browser': 'Navegador:',
  'label.os': 'Sistema operativo:',

  'value.unknown': 'Desconhecido',
  'value.unknownLocation': 'Localização desconhecida',
  'value.device.desktop': 'Computador',
  'value.device.mobile': 'Telemóvel',
  'value.device.tablet': 'Tablet',

  'billing.perMonth': '{price}/mês',
  'billing.perYear': '{price}/ano',
  'billing.perThreeDays': '{price}/3 dias',

  'security.changePassword': 'Altere a sua palavra-passe imediatamente',
  'security.secureButton': 'Proteger a minha conta',

  'freeTier.xauusd': 'XAUUSD (ouro) em M5 e M15',
  'freeTier.marketData':
    'Dados de mercado completos e sobreposições de indicadores',
  'freeTier.noAlerts': 'Sem alertas de preço (funcionalidade PRO)',

  'welcome.title': 'Bem-vindo ao Trading Alerts',
  'welcome.heading': 'Bem-vindo ao Trading Alerts, {name}!',
  'welcome.body':
    'A sua conta foi criada com sucesso. Já pode configurar o seu primeiro alerta de trading!',
  'welcome.getStarted': 'Como começar:',
  'welcome.step1': 'Abra o gráfico XAUUSD em M5 ou M15',
  'welcome.step2': 'Explore as sobreposições de canais e de estrutura',
  'welcome.step3': 'Personalize as suas preferências de notificação',
  'welcome.button': 'Ir para o painel',
  'welcome.subject': 'Bem-vindo ao Trading Alerts!',

  'affiliateWelcome.title': 'Bem-vindo ao programa de afiliados',
  'affiliateWelcome.heading': 'Já é um parceiro afiliado, {name}!',
  'affiliateWelcome.body':
    'A sua conta de afiliado está ativa. Gerámos os seus primeiros {count} códigos de referência — já estão disponíveis no seu painel.',
  'affiliateWelcome.button': 'Ir para o painel de afiliados',
  'affiliateWelcome.footer':
    'Os pagamentos são enviados através da Wise quando o seu saldo ultrapassar o mínimo mensal. Se tiver alguma dúvida, responda a este e-mail ou visite o nosso centro de ajuda.',
  'affiliateWelcome.subject': 'Já é um parceiro afiliado - Trading Alerts',

  'verify.heading': 'Confirme o seu endereço de e-mail',
  'verify.body':
    'Olá {name}, clique no botão abaixo para confirmar o seu endereço de e-mail e ativar a sua conta.',
  'verify.button': 'Confirmar endereço de e-mail',
  'verify.ignore':
    'Se não criou uma conta no Trading Alerts, pode ignorar este e-mail com segurança.',
  'verify.expiry': 'Esta ligação expira dentro de 24 horas.',
  'verify.subject': 'Confirme o seu e-mail - Trading Alerts',

  'reset.heading': 'Repor a palavra-passe',
  'reset.body':
    'Olá {name}, recebemos um pedido para repor a sua palavra-passe. Clique no botão abaixo para criar uma nova.',
  'reset.button': 'Repor a palavra-passe',
  'reset.ignore':
    'Se não pediu para repor a palavra-passe, pode ignorar este e-mail. A sua palavra-passe permanecerá inalterada.',
  'reset.expiry': 'Esta ligação expira dentro de 1 hora.',
  'reset.subject': 'Repor a palavra-passe - Trading Alerts',

  'newDevice.heading': 'Início de sessão detetado num dispositivo novo',
  'newDevice.body':
    'Olá {name}, detetámos um início de sessão na sua conta Trading Alerts a partir de um dispositivo novo:',
  'newDevice.ifYou':
    '**Se foi você:** não precisa de fazer nada. Pode ignorar este e-mail.',
  'newDevice.ifNotYou':
    '**Se não foi você:** alguém pode ter acesso à sua conta. Recomendamos que:',
  'newDevice.tip2':
    'Reveja as suas sessões ativas e termine a sessão nos dispositivos desconhecidos',
  'newDevice.tip3': 'Ative a autenticação de dois fatores para maior segurança',
  'newDevice.subject':
    'Alerta de segurança: início de sessão detetado num dispositivo novo',

  'passwordChanged.heading': 'Palavra-passe alterada com sucesso',
  'passwordChanged.body':
    'Olá {name}, a palavra-passe da sua conta Trading Alerts foi alterada.',
  'passwordChanged.ifYou':
    '**Se fez esta alteração:** não precisa de fazer nada. A sua conta está segura.',
  'passwordChanged.ifNotYou':
    '**Se não fez esta alteração:** a sua conta pode estar comprometida. Por favor:',
  'passwordChanged.tip1':
    'Reponha imediatamente a sua palavra-passe através da opção «Esqueceu-se da palavra-passe?»',
  'passwordChanged.tip2':
    'Verifique se a sua conta tem alterações não autorizadas',
  'passwordChanged.tip3':
    'Contacte a nossa equipa de suporte se precisar de ajuda',
  'passwordChanged.subject': 'Alerta de segurança: palavra-passe alterada',

  'twoFactorEnabled.heading': 'Autenticação de dois fatores ativada',
  'twoFactorEnabled.body':
    'Olá {name}, a autenticação de dois fatores foi ativada com sucesso na sua conta Trading Alerts.',
  'twoFactorEnabled.remindersHeading': 'Lembretes importantes:',
  'twoFactorEnabled.reminder1':
    'Guarde os seus códigos de recuperação num local seguro',
  'twoFactorEnabled.reminder2':
    'Vai precisar da sua aplicação de autenticação para iniciar sessão',
  'twoFactorEnabled.reminder3':
    'Se perder o acesso à aplicação de autenticação, utilize um código de recuperação',
  'twoFactorEnabled.ifNotYou':
    '**Se não ativou a autenticação de dois fatores:** a sua conta pode estar comprometida. Contacte o suporte imediatamente.',
  'twoFactorEnabled.button': 'Gerir as definições de segurança',
  'twoFactorEnabled.subject':
    'Alerta de segurança: autenticação de dois fatores ativada',

  'twoFactorDisabled.heading': 'Autenticação de dois fatores desativada',
  'twoFactorDisabled.body':
    'Olá {name}, a autenticação de dois fatores foi desativada na sua conta Trading Alerts.',
  'twoFactorDisabled.warning':
    'A sua conta está agora menos segura sem a autenticação de dois fatores.',
  'twoFactorDisabled.ifYou':
    '**Se foi você que a desativou:** recomendamos que a volte a ativar para máxima segurança.',
  'twoFactorDisabled.ifNotYou':
    '**Se não foi você que a desativou:** a sua conta pode estar comprometida. Por favor:',
  'twoFactorDisabled.tip2': 'Volte a ativar a autenticação de dois fatores',
  'twoFactorDisabled.tip3':
    'Verifique se a sua conta tem alterações não autorizadas',
  'twoFactorDisabled.subject':
    'Alerta de segurança: autenticação de dois fatores desativada',

  'payoutDetails.heading': 'Dados de pagamento alterados',
  'payoutDetails.body':
    'Olá {name}, foram adicionados ou alterados os dados de pagamento da sua conta de afiliado Trading Alerts.',
  'payoutDetails.holdLabel': 'Pagamentos retidos até:',
  'payoutDetails.hold':
    'Para sua proteção, os pagamentos para estes dados ficam retidos durante {hours} horas. Os seus ganhos estão seguros e serão pagos quando a retenção terminar.',
  'payoutDetails.ifYou':
    '**Se fez esta alteração:** não precisa de fazer nada.',
  'payoutDetails.ifNotYou':
    '**Se não fez esta alteração:** a sua conta pode estar comprometida. Por favor:',
  'payoutDetails.tip2':
    'Contacte a nossa equipa de suporte antes de a retenção terminar',
  'payoutDetails.tip3':
    'Verifique se a sua conta tem alterações não autorizadas',
  'payoutDetails.subject':
    'Alerta de segurança: os seus dados de pagamento foram alterados',

  'accountDeletion.heading': 'Confirme a eliminação da sua conta',
  'accountDeletion.body':
    'Olá {name}, recebemos um pedido para eliminar permanentemente a sua conta Trading Alerts.',
  'accountDeletion.confirmIntro':
    '**Para prosseguir,** confirme a eliminação com o botão abaixo. Esta ação não pode ser anulada.',
  'accountDeletion.confirmButton': 'Confirmar eliminação da conta',
  'accountDeletion.cancelIntro':
    '**Se mudou de ideias ou não foi você,** cancele antes o pedido:',
  'accountDeletion.cancelButton': 'Cancelar o pedido de eliminação',
  'accountDeletion.expiry':
    'Estas ligações expiram em {date}. Quem tiver estas ligações pode agir sobre o seu pedido, por isso não reencaminhe este e-mail.',
  'accountDeletion.subject':
    'Confirme a eliminação da sua conta - Trading Alerts',

  'subscription.heading': 'Subscrição confirmada!',
  'subscription.body':
    'Olá {name}, a sua subscrição **{plan}** está agora ativa.',
  'subscription.planDetails': 'Detalhes do plano',
  'subscription.tier': 'Nível:',
  'subscription.billing': 'Faturação:',
  'subscription.trial':
    'Teste gratuito de 7 dias: o seu cartão não será cobrado até ao fim do período de teste.',
  'subscription.proHeading': 'O que inclui o Pro:',
  'subscription.pro1':
    '**100 alertas de preço** - Não perca nenhuma oportunidade de trading',
  'subscription.pro2':
    '**Alertas de linhas do motor de desenho** - Desenhe uma linha no gráfico e seja avisado quando o preço lhe tocar',
  'subscription.pro3':
    '**Visualização multi-timeframe** - Sobreponha a estrutura de M5 nos gráficos de M15',
  'subscription.pro4':
    '**Informação exclusiva de XAUUSD** - Dados completos dos indicadores M5/M15 (todas as 79 colunas)',
  'subscription.pro5': '**300 pedidos de API por hora**',
  'subscription.pro6': '**Suporte prioritário e exportação de dados**',
  'subscription.freeHeading': 'O seu plano gratuito inclui:',
  'subscription.free1': '**XAUUSD (ouro)** - gráficos M5 e M15',
  'subscription.free2':
    '**Dados completos dos indicadores** - Os mesmos dados de mercado do Pro',
  'subscription.free3': '**60 pedidos de API por hora**',
  'subscription.upgradeLead':
    '{link} para ter alertas, alertas de linhas e vista multi-timeframe!',
  'subscription.upgradeLink': 'Passe para o Pro',
  'subscription.subject': 'Subscrição {plan} confirmada',

  'cancellation.heading': 'Subscrição cancelada',
  'cancellation.body': 'A sua subscrição PRO do {app} foi cancelada.',
  'cancellation.freeAccess': 'Agora tem acesso ao nível FREE:',
  'cancellation.changedMind': 'Mudou de ideias?',
  'cancellation.upgradeAgain':
    'Pode voltar a subscrever a qualquer momento para recuperar o acesso a todas as funcionalidades PRO.',
  'cancellation.button': 'Ver preços',
  'cancellation.thanks': 'Obrigado por experimentar o PRO!',
  'cancellation.subject': 'A sua subscrição PRO foi cancelada',

  'paymentFailed.heading': 'Falha no pagamento',
  'paymentFailed.body':
    'Não conseguimos processar o seu pagamento do {app} PRO ({amount}).',
  'paymentFailed.reason': '**Motivo:** {reason}',
  'paymentFailed.action':
    '**Atualize o seu método de pagamento nos próximos 3 dias** para manter o acesso PRO.',
  'paymentFailed.button': 'Atualizar método de pagamento',
  'paymentFailed.downgrade':
    'Se o problema não for resolvido, a sua conta passará para o nível FREE.',
  'paymentFailed.subject': 'Falha no pagamento - Ação necessária',

  'receipt.title': 'Recibo de pagamento',
  'receipt.heading': 'Pagamento efetuado com sucesso',
  'receipt.body': 'O seu pagamento foi efetuado com sucesso!',
  'receipt.description': 'Descrição',
  'receipt.descriptionValue': '{app} PRO - Mensal',
  'receipt.amount': 'Montante',
  'receipt.date': 'Data',
  'receipt.nextBilling': 'Próxima data de faturação',
  'receipt.button': 'Transferir fatura',
  'receipt.thanks': 'Obrigado por ser membro PRO!',
  'receipt.subject': 'Recibo de pagamento - {app} PRO',

  'canceled.heading': 'Subscrição cancelada',
  'canceled.body': 'A sua subscrição **{plan}** foi cancelada.',
  'canceled.accessUntil': '**Acesso até:** {date}',
  'canceled.accessNote': 'Continuará a ter acesso {plan} até {date}.',
  'canceled.afterwards':
    'Depois disso, a sua conta voltará ao plano **Free**, que inclui:',
  'canceled.reactivate': 'Mudou de ideias? {link}',
  'canceled.reactivateLink': 'Reative a sua subscrição',
  'canceled.subject': 'Subscrição cancelada - Trading Alerts',

  // ── Subscription resumed (a scheduled cancellation was withdrawn) ──
  'resumed.heading': 'Subscrição retomada',
  'resumed.body': 'A sua subscrição **{plan}** vai continuar.',
  'resumed.nextBilling': '**Próxima data de faturação:** {date}',
  'resumed.note':
    'O seu cancelamento foi retirado. Mantém o acesso completo ao {plan} e a sua subscrição será renovada automaticamente em {date}.',
  'resumed.manage': 'Pode rever a sua subscrição em qualquer altura. {link}',
  'resumed.manageLink': 'Abrir as definições de faturação',
  'resumed.subject': 'A sua subscrição {plan} vai continuar - Trading Alerts',

  // ── Plan change: upgraded to yearly, switch to monthly scheduled (S3) ──
  'upgraded.heading': 'Mudança para faturação anual',
  'upgraded.body':
    'A sua subscrição **{plan}** passa a ser faturada anualmente.',
  'upgraded.charged': '**Cobrado hoje:** {amount}',
  'upgraded.price': '**Preço anual:** {price}',
  'upgraded.nextBilling': '**Próxima data de faturação:** {date}',
  'upgraded.firstCharge': '**Primeira cobrança:** {date}',
  'upgraded.note':
    'A cobrança de hoje é o preço anual menos o crédito pela parte não utilizada do seu período mensal atual.',
  'upgraded.trialNote':
    'O seu período de teste gratuito continua e hoje não foi cobrado nada. A sua primeira cobrança, ao preço anual, será em {date}.',
  'upgraded.subject': 'Passou a ter faturação anual - Trading Alerts',
  'switchScheduled.heading': 'Mudança para faturação mensal agendada',
  'switchScheduled.body':
    'A sua subscrição **{plan}** passará para a faturação mensal em {date}.',
  'switchScheduled.date': '**Data da mudança:** {date}',
  'switchScheduled.price': '**Preço mensal a partir dessa data:** {price}',
  'switchScheduled.note':
    'Mantém o seu acesso anual até {date}. Neste momento não é cobrado nem reembolsado nada e não há crédito pelo ano em curso.',
  'switchScheduled.keep':
    'Mudou de ideias? Pode manter a faturação anual antes dessa data. {link}',
  'switchScheduled.subject':
    'A sua mudança para faturação mensal está agendada - Trading Alerts',
  'planChange.manage': 'Pode rever a sua subscrição em qualquer altura. {link}',
  'planChange.manageLink': 'Abrir as definições de faturação',

  'commission.heading': 'Comissão ganha!',
  'commission.body':
    'Boas notícias! O seu código de afiliado acabou de ser utilizado e ganhou uma comissão.',
  'commission.codeUsed': 'Código utilizado',
  'commission.earned': 'Comissão ganha',
  'commission.total': 'Ganhos totais',
  'commission.rate':
    '**Taxa de comissão:** {percent} % das receitas da subscrição',
  'commission.button': 'Ver painel',
  'commission.subject': 'Comissão ganha! {amount} - {app}',
};
