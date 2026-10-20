import type { EmailMessages } from './en-US';

export const es: EmailMessages = {
  'common.greeting': 'Hola {name},',
  'common.userFallback': 'usuario',
  'common.questions':
    'Si tienes alguna pregunta, responde a este correo o visita nuestro centro de ayuda.',
  'common.signature': 'El equipo de {app}',
  'common.needHelpContact': '¿Necesitas ayuda? Escríbenos a {email}',
  'common.needHelpReply':
    '¿Necesitas ayuda? Responde a este correo o escríbenos a {email}',
  'common.securityAlertsNote':
    'Recibes este correo porque tienes activadas las alertas de seguridad.',
  'common.manageNotifications': 'Gestionar las preferencias de notificaciones',

  'label.time': 'Hora:',
  'label.location': 'Ubicación:',
  'label.ipAddress': 'Dirección IP:',
  'label.device': 'Dispositivo:',
  'label.browser': 'Navegador:',
  'label.os': 'Sistema operativo:',

  'value.unknown': 'Desconocido',
  'value.unknownLocation': 'Ubicación desconocida',
  'value.device.desktop': 'Ordenador',
  'value.device.mobile': 'Móvil',
  'value.device.tablet': 'Tableta',

  'billing.perMonth': '{price}/mes',
  'billing.perYear': '{price}/año',

  'security.changePassword': 'Cambia tu contraseña de inmediato',
  'security.secureButton': 'Proteger mi cuenta',

  'freeTier.xauusd': 'XAUUSD (oro) en M5 y M15',
  'freeTier.marketData':
    'Datos de mercado completos y superposiciones de indicadores',
  'freeTier.noAlerts': 'Sin alertas de precio (función PRO)',

  'welcome.title': 'Te damos la bienvenida a Trading Alerts',
  'welcome.heading': '¡Te damos la bienvenida a Trading Alerts, {name}!',
  'welcome.body':
    'Tu cuenta se ha creado correctamente. ¡Ya puedes configurar tu primera alerta de trading!',
  'welcome.getStarted': 'Primeros pasos:',
  'welcome.step1': 'Abre el gráfico de XAUUSD en M5 o M15',
  'welcome.step2': 'Explora las superposiciones de canales y estructura',
  'welcome.step3': 'Personaliza tus preferencias de notificaciones',
  'welcome.button': 'Ir al panel principal',
  'welcome.subject': '¡Te damos la bienvenida a Trading Alerts!',

  'affiliateWelcome.title': 'Te damos la bienvenida al programa de afiliados',
  'affiliateWelcome.heading': '¡Ya eres socio afiliado, {name}!',
  'affiliateWelcome.body':
    'Tu cuenta de afiliado está activa. Hemos generado tus primeros {count} códigos de referido; ya están disponibles en tu panel.',
  'affiliateWelcome.button': 'Ir al panel de afiliados',
  'affiliateWelcome.footer':
    'Los pagos se envían a través de Wise cuando tu saldo supera el mínimo mensual. Si tienes alguna pregunta, responde a este correo o visita nuestro centro de ayuda.',
  'affiliateWelcome.subject': 'Ya eres socio afiliado - Trading Alerts',

  'verify.heading': 'Verifica tu dirección de correo electrónico',
  'verify.body':
    'Hola {name}, haz clic en el botón de abajo para verificar tu dirección de correo electrónico y activar tu cuenta.',
  'verify.button': 'Verificar dirección de correo',
  'verify.ignore':
    'Si no has creado una cuenta en Trading Alerts, puedes ignorar este correo sin problema.',
  'verify.expiry': 'Este enlace caducará en 24 horas.',
  'verify.subject': 'Verifica tu correo electrónico - Trading Alerts',

  'reset.heading': 'Restablece tu contraseña',
  'reset.body':
    'Hola {name}, hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva.',
  'reset.button': 'Restablecer contraseña',
  'reset.ignore':
    'Si no has solicitado restablecer tu contraseña, puedes ignorar este correo. Tu contraseña no cambiará.',
  'reset.expiry': 'Este enlace caducará en 1 hora.',
  'reset.subject': 'Restablece tu contraseña - Trading Alerts',

  'newDevice.heading': 'Inicio de sesión detectado desde un dispositivo nuevo',
  'newDevice.body':
    'Hola {name}, hemos detectado un inicio de sesión en tu cuenta de Trading Alerts desde un dispositivo nuevo:',
  'newDevice.ifYou':
    '**Si fuiste tú:** no tienes que hacer nada. Puedes ignorar este correo.',
  'newDevice.ifNotYou':
    '**Si no fuiste tú:** alguien podría tener acceso a tu cuenta. Te recomendamos:',
  'newDevice.tip2':
    'Revisar tus sesiones activas y cerrar la sesión en los dispositivos que no reconozcas',
  'newDevice.tip3':
    'Activar la autenticación de dos factores para mayor seguridad',
  'newDevice.subject':
    'Alerta de seguridad: inicio de sesión desde un dispositivo nuevo',

  'passwordChanged.heading': 'Contraseña cambiada correctamente',
  'passwordChanged.body':
    'Hola {name}, la contraseña de tu cuenta de Trading Alerts se ha cambiado.',
  'passwordChanged.ifYou':
    '**Si hiciste este cambio:** no tienes que hacer nada. Tu cuenta está segura.',
  'passwordChanged.ifNotYou':
    '**Si no hiciste este cambio:** tu cuenta podría estar comprometida. Por favor:',
  'passwordChanged.tip1':
    'Restablece tu contraseña de inmediato con la opción «¿Olvidaste tu contraseña?»',
  'passwordChanged.tip2': 'Revisa tu cuenta por si hay cambios no autorizados',
  'passwordChanged.tip3':
    'Ponte en contacto con nuestro equipo de soporte si necesitas ayuda',
  'passwordChanged.subject': 'Alerta de seguridad: contraseña cambiada',

  'twoFactorEnabled.heading': 'Autenticación de dos factores activada',
  'twoFactorEnabled.body':
    'Hola {name}, la autenticación de dos factores se ha activado correctamente en tu cuenta de Trading Alerts.',
  'twoFactorEnabled.remindersHeading': 'Recordatorios importantes:',
  'twoFactorEnabled.reminder1':
    'Guarda tus códigos de respaldo en un lugar seguro',
  'twoFactorEnabled.reminder2':
    'Necesitarás tu aplicación de autenticación para iniciar sesión',
  'twoFactorEnabled.reminder3':
    'Si pierdes el acceso a tu aplicación de autenticación, usa un código de respaldo',
  'twoFactorEnabled.ifNotYou':
    '**Si no activaste la autenticación de dos factores:** tu cuenta podría estar comprometida. Ponte en contacto con soporte de inmediato.',
  'twoFactorEnabled.button': 'Gestionar la configuración de seguridad',
  'twoFactorEnabled.subject':
    'Alerta de seguridad: autenticación de dos factores activada',

  'twoFactorDisabled.heading': 'Autenticación de dos factores desactivada',
  'twoFactorDisabled.body':
    'Hola {name}, la autenticación de dos factores se ha desactivado en tu cuenta de Trading Alerts.',
  'twoFactorDisabled.warning':
    'Tu cuenta es ahora menos segura sin la autenticación de dos factores.',
  'twoFactorDisabled.ifYou':
    '**Si la desactivaste tú:** te recomendamos volver a activarla para una seguridad máxima.',
  'twoFactorDisabled.ifNotYou':
    '**Si no la desactivaste tú:** tu cuenta podría estar comprometida. Por favor:',
  'twoFactorDisabled.tip2': 'Vuelve a activar la autenticación de dos factores',
  'twoFactorDisabled.tip3':
    'Revisa tu cuenta por si hay cambios no autorizados',
  'twoFactorDisabled.subject':
    'Alerta de seguridad: autenticación de dos factores desactivada',

  'accountDeletion.heading': 'Confirma la eliminación de tu cuenta',
  'accountDeletion.body':
    'Hola {name}, hemos recibido una solicitud para eliminar de forma permanente tu cuenta de Trading Alerts.',
  'accountDeletion.confirmIntro':
    '**Para continuar,** confirma la eliminación con el botón de abajo. Esta acción no se puede deshacer.',
  'accountDeletion.confirmButton': 'Confirmar eliminación de la cuenta',
  'accountDeletion.cancelIntro':
    '**Si has cambiado de opinión o no fuiste tú,** cancela la solicitud:',
  'accountDeletion.cancelButton': 'Cancelar la solicitud de eliminación',
  'accountDeletion.expiry':
    'Estos enlaces caducan el {date}. Cualquier persona con estos enlaces puede actuar sobre tu solicitud, así que no reenvíes este correo.',
  'accountDeletion.subject':
    'Confirma la eliminación de tu cuenta - Trading Alerts',

  'subscription.heading': '¡Suscripción confirmada!',
  'subscription.body': 'Hola {name}, tu suscripción **{plan}** ya está activa.',
  'subscription.planDetails': 'Detalles del plan',
  'subscription.tier': 'Nivel:',
  'subscription.billing': 'Facturación:',
  'subscription.trial':
    'Prueba gratuita de 7 días: no se cobrará nada a tu tarjeta hasta que termine la prueba.',
  'subscription.proHeading': 'Lo que incluye Pro:',
  'subscription.pro1':
    '**100 alertas de precio** - No pierdas ninguna oportunidad de trading',
  'subscription.pro2':
    '**Alertas de líneas del motor de dibujo** - Dibuja una línea en el gráfico y recibe un aviso cuando el precio la toque',
  'subscription.pro3':
    '**Visualización multitimeframe** - Superpón la estructura de M5 en los gráficos de M15',
  'subscription.pro4':
    '**Información exclusiva de XAUUSD** - Datos completos de indicadores en M5/M15 (las 79 columnas)',
  'subscription.pro5': '**300 solicitudes de API por hora**',
  'subscription.pro6': '**Soporte prioritario y exportación de datos**',
  'subscription.freeHeading': 'Tu plan gratuito incluye:',
  'subscription.free1': '**XAUUSD (oro)** - gráficos en M5 y M15',
  'subscription.free2':
    '**Datos completos de indicadores** - Los mismos datos de mercado que Pro',
  'subscription.free3': '**60 solicitudes de API por hora**',
  'subscription.upgradeLead':
    '{link} para tener alertas, alertas de líneas y vista multitimeframe.',
  'subscription.upgradeLink': 'Mejora a Pro',
  'subscription.subject': 'Suscripción {plan} confirmada',

  'cancellation.heading': 'Suscripción cancelada',
  'cancellation.body': 'Tu suscripción PRO de {app} se ha cancelado.',
  'cancellation.freeAccess': 'Ahora tienes acceso al nivel FREE:',
  'cancellation.changedMind': '¿Has cambiado de opinión?',
  'cancellation.upgradeAgain':
    'Puedes volver a mejorar tu plan en cualquier momento para recuperar el acceso a todas las funciones PRO.',
  'cancellation.button': 'Ver precios',
  'cancellation.thanks': '¡Gracias por probar PRO!',
  'cancellation.subject': 'Tu suscripción PRO se ha cancelado',

  'paymentFailed.heading': 'Pago fallido',
  'paymentFailed.body':
    'No hemos podido procesar tu pago de {app} PRO ({amount}).',
  'paymentFailed.reason': '**Motivo:** {reason}',
  'paymentFailed.action':
    '**Actualiza tu método de pago en un plazo de 3 días** para conservar tu acceso PRO.',
  'paymentFailed.button': 'Actualizar método de pago',
  'paymentFailed.downgrade':
    'Si no se resuelve, tu cuenta pasará al nivel FREE.',
  'paymentFailed.subject': 'Pago fallido - Se requiere una acción',

  'receipt.title': 'Recibo de pago',
  'receipt.heading': 'Pago realizado correctamente',
  'receipt.body': '¡Tu pago se ha realizado correctamente!',
  'receipt.description': 'Descripción',
  'receipt.descriptionValue': '{app} PRO - Mensual',
  'receipt.amount': 'Importe',
  'receipt.date': 'Fecha',
  'receipt.nextBilling': 'Próxima fecha de facturación',
  'receipt.button': 'Descargar factura',
  'receipt.thanks': '¡Gracias por ser miembro PRO!',
  'receipt.subject': 'Recibo de pago - {app} PRO',

  'canceled.heading': 'Suscripción cancelada',
  'canceled.body': 'Tu suscripción **{plan}** se ha cancelado.',
  'canceled.accessUntil': '**Acceso hasta:** {date}',
  'canceled.accessNote': 'Seguirás teniendo acceso {plan} hasta el {date}.',
  'canceled.afterwards':
    'Después, tu cuenta volverá al plan **Free**, que incluye:',
  'canceled.reactivate': '¿Has cambiado de opinión? {link}',
  'canceled.reactivateLink': 'Reactiva tu suscripción',
  'canceled.subject': 'Suscripción cancelada - Trading Alerts',

  'commission.heading': '¡Comisión ganada!',
  'commission.body':
    '¡Buenas noticias! Se acaba de usar tu código de afiliado y has ganado una comisión.',
  'commission.codeUsed': 'Código utilizado',
  'commission.earned': 'Comisión ganada',
  'commission.total': 'Ganancias totales',
  'commission.rate':
    '**Tasa de comisión:** {percent} % de los ingresos por suscripción',
  'commission.button': 'Ver panel',
  'commission.subject': '¡Comisión ganada! {amount} - {app}',
};
