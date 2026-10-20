/**
 * HTML building blocks for the e-mail templates. Pure: see `languages.ts`.
 *
 * Two looks exist, kept as they were before the e-mails were translated:
 * the "card" (account and security mail) and the "banner" (billing mail). Both
 * are inline-styled tables-free HTML that mail clients render reliably. Arabic
 * and Urdu get `dir="rtl"`, with the start / end sides swapped where a style
 * names one (mail clients do not support logical CSS properties).
 */

import {
  escapeHtml,
  html as catalogHtml,
  isolate,
  plain as catalogPlain,
  raw,
  type EmailVars,
} from './catalog';
import type { EmailMessageKey } from './messages/en-US';
import { isRtlEmailLanguage, type EmailLocale } from './languages';

/** The brand. It is not translated. */
export const APP_NAME = 'Trading Alerts';

export interface EmailContext {
  locale: EmailLocale;
  rtl: boolean;
  /** The side text starts on: `left`, or `right` for Arabic and Urdu. */
  start: 'left' | 'right';
  end: 'left' | 'right';
  /** Catalog text for an HTML body (escaped, `**bold**` rendered). */
  h(key: EmailMessageKey, vars?: EmailVars): string;
  /** Catalog text for a subject or plain part (not escaped). */
  p(key: EmailMessageKey, vars?: EmailVars): string;
}

export function createContext(locale: EmailLocale): EmailContext {
  const rtl = isRtlEmailLanguage(locale.language);
  return {
    locale,
    rtl,
    start: rtl ? 'right' : 'left',
    end: rtl ? 'left' : 'right',
    h: (key, vars) => catalogHtml(locale, key, vars),
    p: (key, vars) => catalogPlain(locale, key, vars),
  };
}

/** A value the template shows next to a label. User-controlled: escaped. */
export function value(text: string): string {
  return escapeHtml(text);
}

/**
 * The recipient's name, or the localized word for "User" when there is none.
 * Callers have always passed the English `'User'` for an account without a
 * name; that literal counts as no name, so it is translated too.
 */
export function displayName(
  ctx: EmailContext,
  name: string | null | undefined
): string {
  const trimmed = name?.trim();
  return trimmed && trimmed !== 'User' ? trimmed : ctx.p('common.userFallback');
}

/** A link inside running text, for placeholders such as `{link}`. */
export function textLink(href: string, label: string, style: string): string {
  return raw(
    `<a href="${escapeHtml(href)}" style="${style}">${escapeHtml(label)}</a>`
  ).html;
}

function dirAttr(ctx: EmailContext): string {
  return ctx.rtl ? ' dir="rtl"' : '';
}

/** The whole document. `inner` is already-safe HTML. */
export function documentShell(
  ctx: EmailContext,
  title: string,
  bodyStyle: string,
  inner: string
): string {
  return `
    <!DOCTYPE html>
    <html lang="${ctx.locale.language}"${dirAttr(ctx)}>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="${bodyStyle}"${dirAttr(ctx)}>
      ${inner}
    </body>
    </html>
  `;
}

const FONT =
  "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";

// ─── The card look (account and security mail) ──────────────────────────────

export const card = {
  bodyStyle: `${FONT} margin: 0; padding: 20px; background-color: #f4f4f5;`,

  wrap(ctx: EmailContext, inner: string): string {
    return `<div${dirAttr(ctx)} style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        ${inner}
      </div>`;
  },

  h1(text: string): string {
    return `<h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px;">${text}</h1>`;
  },

  banner(background: string, color: string, text: string): string {
    return `<div style="background: ${background}; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h1 style="color: ${color}; margin: 0; font-size: 20px;">${text}</h1>
        </div>`;
  },

  h2(text: string): string {
    return `<h2 style="color: #18181b; font-size: 18px; margin: 24px 0 12px 0;">${text}</h2>`;
  },

  h3(text: string): string {
    return `<h3 style="color: #18181b; font-size: 16px; margin: 24px 0 12px 0;">${text}</h3>`;
  },

  p(text: string, margin = '0 0 16px 0', extra = ''): string {
    return `<p style="color: #52525b; line-height: 1.6; margin: ${margin};${extra}">${text}</p>`;
  },

  small(text: string, margin = '24px 0 0 0'): string {
    return `<p style="color: #71717a; font-size: 14px; margin: ${margin};">${text}</p>`;
  },

  ul(ctx: EmailContext, items: string[]): string {
    return `<ul style="color: #52525b; line-height: 1.8; padding-${ctx.start}: 20px; margin: 0 0 24px 0;">
          ${items.map((item) => `<li>${item}</li>`).join('\n          ')}
        </ul>`;
  },

  button(href: string, label: string, background: string, extra = ''): string {
    return `<a href="${escapeHtml(href)}" style="display: inline-block; background: ${background}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;${extra}">
          ${label}
        </a>`;
  },

  /** Label / value rows in a grey box. Both sides are escaped here. */
  facts(ctx: EmailContext, rows: Array<[label: string, text: string]>): string {
    return `<div style="background: #f4f4f5; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            ${rows
              .map(
                ([label, text]) => `<tr>
              <td style="color: #71717a; padding: 8px 0;">${escapeHtml(label)}</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: ${ctx.end};">${ctx.rtl ? isolate(text) : escapeHtml(text)}</td>
            </tr>`
              )
              .join('\n            ')}
          </table>
        </div>`;
  },

  /** "You're receiving this because you have security alerts" + the link. */
  securityFooter(ctx: EmailContext, settingsUrl: string): string {
    return card.small(
      `${ctx.h('common.securityAlertsNote')}
          <a href="${escapeHtml(settingsUrl)}" style="color: #2563eb;">${ctx.h('common.manageNotifications')}</a>`,
      '32px 0 0 0'
    );
  },
};

// ─── The banner look (billing mail) ─────────────────────────────────────────

export const banner = {
  bodyStyle: `${FONT} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;`,

  header(
    background: string,
    color: string,
    text: string,
    radius = '10px 10px 0 0'
  ): string {
    return `<div style="background: ${background}; padding: 30px; border-radius: ${radius}; text-align: center;">
    <h1 style="color: ${color}; margin: 0; font-size: 28px;">${text}</h1>
  </div>`;
  },

  content(inner: string): string {
    return `<div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    ${inner}
  </div>`;
  },

  p(text: string): string {
    return `<p style="font-size: 16px;">${text}</p>`;
  },

  ul(ctx: EmailContext, items: string[], gap = 10): string {
    return `<ul style="font-size: 16px; padding-${ctx.start}: 20px;">
      ${items.map((item) => `<li style="margin-bottom: ${gap}px;">${item}</li>`).join('\n      ')}
    </ul>`;
  },

  callout(
    ctx: EmailContext,
    border: string,
    inner: string,
    background = 'white'
  ): string {
    return `<div style="background: ${background}; padding: 20px; border-radius: 8px; margin: 20px 0; border-${ctx.start}: 4px solid ${border};">
      ${inner}
    </div>`;
  },

  button(href: string, label: string, background: string): string {
    return `<p style="font-size: 16px;">
      <a href="${escapeHtml(href)}" style="display: inline-block; background: ${background}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">${label}</a>
    </p>`;
  },

  /** Rows of a statement; `last` has no bottom rule. Values are escaped. */
  statement(
    ctx: EmailContext,
    rows: Array<{
      label: string;
      text: string;
      bold?: boolean;
      color?: string;
    }>
  ): string {
    const lastIndex = rows.length - 1;
    return `<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        ${rows
          .map((row, index) => {
            const rule =
              index === lastIndex ? '' : ' border-bottom: 1px solid #e5e7eb;';
            const weight = row.bold ? ' font-weight: 600;' : '';
            const color = row.color ? ` color: ${row.color};` : '';
            return `<tr>
          <td style="padding: 10px 0;${rule} color: #666;">${escapeHtml(row.label)}</td>
          <td style="padding: 10px 0;${rule} text-align: ${ctx.end};${weight}${color}">${ctx.rtl ? isolate(row.text) : escapeHtml(row.text)}</td>
        </tr>`;
          })
          .join('\n        ')}
      </table>
    </div>`;
  },

  signature(ctx: EmailContext, appUrl: string, before = ''): string {
    return `<p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      ${before}${ctx.h('common.signature', { app: APP_NAME })}<br>
      <a href="${escapeHtml(appUrl)}" style="color: #2563eb;">${escapeHtml(appUrl)}</a>
    </p>`;
  },
};

// ─── Plain-text alternative ─────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * A readable plain-text version of an e-mail body, links kept as `(url)`.
 * Like a browser, it treats the template's own line breaks as spaces: only a
 * tag (a paragraph, a list item, a table row) starts a new line.
 */
export function htmlToText(source: string): string {
  const text = source
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/\s+/g, ' ')
    .replace(
      /<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_whole, href: string, label: string) =>
        `${label.replace(/<[^>]+>/g, '').trim()} (${href})`
    )
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h1|h2|h3|ul|table)>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
