import type { EmailMessages } from './en-US';

/** Brazilian Portuguese. */
export const ptBR: EmailMessages = {
  'common.greeting': 'Olá, {name},',
  'common.userFallback': 'usuário',
  'common.questions':
    'Se tiver alguma dúvida, responda a este e-mail ou acesse nossa central de ajuda.',
  'common.signature': 'A equipe {app}',
  'common.needHelpContact': 'Precisa de ajuda? Fale conosco em {email}',
  'common.needHelpReply':
    'Precisa de ajuda? Responda a este e-mail ou fale conosco em {email}',
  'common.securityAlertsNote':
    'Você está recebendo este e-mail porque os alertas de segurança estão ativados.',
  'common.manageNotifications': 'Gerenciar preferências de notificação',

  'label.time': 'Hora:',
  'label.location': 'Localização:',
  'label.ipAddress': 'Endereço IP:',
  'label.device': 'Dispositivo:',
  'label.browser': 'Navegador:',
  'label.os': 'Sistema operacional:',

  'value.unknown': 'Desconhecido',
  'value.unknownLocation': 'Localização desconhecida',
  'value.device.desktop': 'Computador',
  'value.device.mobile': 'Celular',
  'value.device.tablet': 'Tablet',

  'billing.perMonth': '{price}/mês',
  'billing.perYear': '{price}/ano',
  'billing.perThreeDays': '{price}/3 dias',

  'security.changePassword': 'Altere sua senha imediatamente',
  'security.secureButton': 'Proteger minha conta',

  'freeTier.xauusd': 'XAUUSD (ouro) em M5 e M15',
  'freeTier.marketData':
    'Dados de mercado completos e sobreposições de indicadores',
  'freeTier.noAlerts': 'Sem alertas de preço (recurso PRO)',

  'welcome.title': 'Boas-vindas ao Trading Alerts',
  'welcome.heading': 'Boas-vindas ao Trading Alerts, {name}!',
  'welcome.body':
    'Sua conta foi criada com sucesso. Agora você já pode configurar seu primeiro alerta de trading!',
  'welcome.getStarted': 'Primeiros passos:',
  'welcome.step1': 'Abra o gráfico de XAUUSD em M5 ou M15',
  'welcome.step2': 'Explore as sobreposições de canais e de estrutura',
  'welcome.step3': 'Personalize suas preferências de notificação',
  'welcome.button': 'Ir para o painel',
  'welcome.subject': 'Boas-vindas ao Trading Alerts!',

  'affiliateWelcome.title': 'Boas-vindas ao programa de afiliados',
  'affiliateWelcome.heading': 'Você agora é um parceiro afiliado, {name}!',
  'affiliateWelcome.body':
    'Sua conta de afiliado está ativa. Geramos seus primeiros {count} códigos de indicação — eles já estão disponíveis no seu painel.',
  'affiliateWelcome.button': 'Ir para o painel de afiliados',
  'affiliateWelcome.footer':
    'Os pagamentos são enviados pela Wise quando seu saldo ultrapassa o mínimo mensal. Se tiver alguma dúvida, responda a este e-mail ou acesse nossa central de ajuda.',
  'affiliateWelcome.subject': 'Você é um parceiro afiliado - Trading Alerts',

  'verify.heading': 'Confirme seu endereço de e-mail',
  'verify.body':
    'Olá, {name}, clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta.',
  'verify.button': 'Confirmar endereço de e-mail',
  'verify.ignore':
    'Se você não criou uma conta no Trading Alerts, pode ignorar este e-mail com segurança.',
  'verify.expiry': 'Este link expira em 24 horas.',
  'verify.subject': 'Confirme seu e-mail - Trading Alerts',

  'reset.heading': 'Redefina sua senha',
  'reset.body':
    'Olá, {name}, recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.',
  'reset.button': 'Redefinir senha',
  'reset.ignore':
    'Se você não solicitou a redefinição de senha, pode ignorar este e-mail. Sua senha permanecerá a mesma.',
  'reset.expiry': 'Este link expira em 1 hora.',
  'reset.subject': 'Redefina sua senha - Trading Alerts',

  'newDevice.heading': 'Login detectado em um novo dispositivo',
  'newDevice.body':
    'Olá, {name}, detectamos um login na sua conta do Trading Alerts a partir de um novo dispositivo:',
  'newDevice.ifYou':
    '**Se foi você:** nenhuma ação é necessária. Você pode ignorar este e-mail.',
  'newDevice.ifNotYou':
    '**Se não foi você:** alguém pode ter acesso à sua conta. Recomendamos:',
  'newDevice.tip2':
    'Revise suas sessões ativas e saia dos dispositivos desconhecidos',
  'newDevice.tip3': 'Ative a autenticação de dois fatores para mais segurança',
  'newDevice.subject':
    'Alerta de segurança: login detectado em um novo dispositivo',

  'passwordChanged.heading': 'Senha alterada com sucesso',
  'passwordChanged.body':
    'Olá, {name}, a senha da sua conta do Trading Alerts foi alterada.',
  'passwordChanged.ifYou':
    '**Se você fez essa alteração:** nenhuma ação é necessária. Sua conta está segura.',
  'passwordChanged.ifNotYou':
    '**Se você não fez essa alteração:** sua conta pode estar comprometida. Por favor:',
  'passwordChanged.tip1':
    'Redefina sua senha imediatamente usando a opção "Esqueci minha senha"',
  'passwordChanged.tip2':
    'Verifique se há alterações não autorizadas na sua conta',
  'passwordChanged.tip3':
    'Entre em contato com nosso suporte se precisar de ajuda',
  'passwordChanged.subject': 'Alerta de segurança: senha alterada',

  'twoFactorEnabled.heading': 'Autenticação de dois fatores ativada',
  'twoFactorEnabled.body':
    'Olá, {name}, a autenticação de dois fatores foi ativada com sucesso na sua conta do Trading Alerts.',
  'twoFactorEnabled.remindersHeading': 'Lembretes importantes:',
  'twoFactorEnabled.reminder1':
    'Guarde seus códigos de backup em um local seguro',
  'twoFactorEnabled.reminder2':
    'Você precisará do seu aplicativo autenticador para fazer login',
  'twoFactorEnabled.reminder3':
    'Se perder o acesso ao autenticador, use um código de backup',
  'twoFactorEnabled.ifNotYou':
    '**Se você não ativou a autenticação de dois fatores:** sua conta pode estar comprometida. Entre em contato com o suporte imediatamente.',
  'twoFactorEnabled.button': 'Gerenciar configurações de segurança',
  'twoFactorEnabled.subject':
    'Alerta de segurança: autenticação de dois fatores ativada',

  'twoFactorDisabled.heading': 'Autenticação de dois fatores desativada',
  'twoFactorDisabled.body':
    'Olá, {name}, a autenticação de dois fatores foi desativada na sua conta do Trading Alerts.',
  'twoFactorDisabled.warning':
    'Sua conta está menos segura sem a autenticação de dois fatores.',
  'twoFactorDisabled.ifYou':
    '**Se foi você que a desativou:** recomendamos ativá-la novamente para máxima segurança.',
  'twoFactorDisabled.ifNotYou':
    '**Se não foi você que a desativou:** sua conta pode estar comprometida. Por favor:',
  'twoFactorDisabled.tip2': 'Ative novamente a autenticação de dois fatores',
  'twoFactorDisabled.tip3':
    'Verifique se há alterações não autorizadas na sua conta',
  'twoFactorDisabled.subject':
    'Alerta de segurança: autenticação de dois fatores desativada',

  'payoutDetails.heading': 'Dados de pagamento alterados',
  'payoutDetails.body':
    'Olá, {name}, os dados de pagamento da sua conta de afiliado do Trading Alerts foram adicionados ou alterados.',
  'payoutDetails.holdLabel': 'Pagamentos retidos até:',
  'payoutDetails.hold':
    'Para a sua proteção, os pagamentos para esses dados ficam retidos por {hours} horas. Seus ganhos estão seguros e serão pagos quando a retenção terminar.',
  'payoutDetails.ifYou':
    '**Se foi você que fez essa alteração:** nenhuma ação é necessária.',
  'payoutDetails.ifNotYou':
    '**Se não foi você que fez essa alteração:** sua conta pode estar comprometida. Por favor:',
  'payoutDetails.tip2':
    'Entre em contato com nossa equipe de suporte antes de a retenção terminar',
  'payoutDetails.tip3':
    'Verifique se há alterações não autorizadas na sua conta',
  'payoutDetails.subject':
    'Alerta de segurança: seus dados de pagamento foram alterados',

  'accountDeletion.heading': 'Confirme a exclusão da sua conta',
  'accountDeletion.body':
    'Olá, {name}, recebemos uma solicitação para excluir permanentemente sua conta do Trading Alerts.',
  'accountDeletion.confirmIntro':
    '**Para continuar,** confirme a exclusão no botão abaixo. Esta ação não pode ser desfeita.',
  'accountDeletion.confirmButton': 'Confirmar exclusão da conta',
  'accountDeletion.cancelIntro':
    '**Se você mudou de ideia ou não foi você,** cancele a solicitação:',
  'accountDeletion.cancelButton': 'Cancelar solicitação de exclusão',
  'accountDeletion.expiry':
    'Estes links expiram em {date}. Qualquer pessoa com estes links pode agir sobre sua solicitação, portanto não encaminhe este e-mail.',
  'accountDeletion.subject':
    'Confirme a exclusão da sua conta - Trading Alerts',

  'subscription.heading': 'Assinatura confirmada!',
  'subscription.body': 'Olá, {name}, sua assinatura **{plan}** já está ativa.',
  'subscription.planDetails': 'Detalhes do plano',
  'subscription.tier': 'Nível:',
  'subscription.billing': 'Cobrança:',
  'subscription.trial':
    'Teste grátis de 7 dias: seu cartão não será cobrado até o fim do período de teste.',
  'subscription.proHeading': 'O que você recebe com o Pro:',
  'subscription.pro1':
    '**100 alertas de preço** - Não perca nenhuma oportunidade de trading',
  'subscription.pro2':
    '**Alertas de linhas do motor de desenho** - Desenhe uma linha no gráfico e seja avisado quando o preço tocá-la',
  'subscription.pro3':
    '**Visualização multi-timeframe** - Sobreponha a estrutura de M5 aos gráficos de M15',
  'subscription.pro4':
    '**Informações exclusivas de XAUUSD** - Dados completos dos indicadores M5/M15 (todas as 79 colunas)',
  'subscription.pro5': '**300 requisições de API por hora**',
  'subscription.pro6': '**Suporte prioritário e exportação de dados**',
  'subscription.freeHeading': 'Seu plano gratuito inclui:',
  'subscription.free1': '**XAUUSD (ouro)** - gráficos M5 e M15',
  'subscription.free2':
    '**Dados completos dos indicadores** - Os mesmos dados de mercado do Pro',
  'subscription.free3': '**60 requisições de API por hora**',
  'subscription.upgradeLead':
    '{link} para ter alertas, alertas de linhas e visão multi-timeframe!',
  'subscription.upgradeLink': 'Faça upgrade para o Pro',
  'subscription.subject': 'Assinatura {plan} confirmada',

  'cancellation.heading': 'Assinatura cancelada',
  'cancellation.body': 'Sua assinatura PRO do {app} foi cancelada.',
  'cancellation.freeAccess': 'Agora você tem acesso ao nível FREE:',
  'cancellation.changedMind': 'Mudou de ideia?',
  'cancellation.upgradeAgain':
    'Você pode fazer upgrade novamente a qualquer momento para recuperar o acesso a todos os recursos PRO.',
  'cancellation.button': 'Ver preços',
  'cancellation.thanks': 'Obrigado por experimentar o PRO!',
  'cancellation.subject': 'Sua assinatura PRO foi cancelada',

  'paymentFailed.heading': 'Falha no pagamento',
  'paymentFailed.body':
    'Não foi possível processar seu pagamento do {app} PRO ({amount}).',
  'paymentFailed.reason': '**Motivo:** {reason}',
  'paymentFailed.action':
    '**Atualize sua forma de pagamento em até 3 dias** para manter o acesso PRO.',
  'paymentFailed.button': 'Atualizar forma de pagamento',
  'paymentFailed.downgrade':
    'Se não for resolvido, sua conta será rebaixada para o nível FREE.',
  'paymentFailed.subject': 'Falha no pagamento - Ação necessária',

  'receipt.title': 'Recibo de pagamento',
  'receipt.heading': 'Pagamento realizado com sucesso',
  'receipt.body': 'Seu pagamento foi realizado com sucesso!',
  'receipt.description': 'Descrição',
  'receipt.descriptionValue': '{app} PRO - Mensal',
  'receipt.amount': 'Valor',
  'receipt.date': 'Data',
  'receipt.nextBilling': 'Próxima data de cobrança',
  'receipt.button': 'Baixar fatura',
  'receipt.thanks': 'Obrigado por ser um membro PRO!',
  'receipt.subject': 'Recibo de pagamento - {app} PRO',

  'canceled.heading': 'Assinatura cancelada',
  'canceled.body': 'Sua assinatura **{plan}** foi cancelada.',
  'canceled.accessUntil': '**Acesso até:** {date}',
  'canceled.accessNote': 'Você continuará com acesso {plan} até {date}.',
  'canceled.afterwards':
    'Depois disso, sua conta voltará ao plano **Free**, que inclui:',
  'canceled.reactivate': 'Mudou de ideia? {link}',
  'canceled.reactivateLink': 'Reative sua assinatura',
  'canceled.subject': 'Assinatura cancelada - Trading Alerts',

  'commission.heading': 'Comissão recebida!',
  'commission.body':
    'Ótimas notícias! Seu código de afiliado acabou de ser usado e você ganhou uma comissão.',
  'commission.codeUsed': 'Código usado',
  'commission.earned': 'Comissão recebida',
  'commission.total': 'Ganhos totais',
  'commission.rate':
    '**Taxa de comissão:** {percent}% da receita das assinaturas',
  'commission.button': 'Ver painel',
  'commission.subject': 'Comissão recebida! {amount} - {app}',
};
