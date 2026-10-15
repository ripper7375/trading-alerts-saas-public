/**
 * Every word the chat panel shows, in English (build step 7 part 8; ADR-098 D14, plan decision D14 of
 * step 6 applies: a draft in all 19 languages ships, the native readers are still to be named).
 *
 * This file is the single source of the panel's text. It is (1) the fallback `t(key, text)` gets,
 * (2) the content of the two English dictionaries, and (3) the list the translation test holds the
 * 19 dictionaries to, key by key. A key in a dictionary and not here, or here and not in a
 * dictionary, fails `__tests__/components/chat/translation-coverage.test.ts`.
 *
 * What is NOT here and must never be: a model's words (they come in the reply, in the reader's
 * language, already checked), a number, a price, a level name (`MCD2.baseline`), a state code, a
 * sensor id (`MCD1`), a rule id or a model slug. Those stay as they arrive, in every language.
 *
 * Placeholders: `{name}` only, the same in every language. A figure goes into a placeholder already
 * formatted for the reader and isolated for its direction (`use-chat-words.ts`).
 *
 * Reused, not repeated: `AI Analyst`, `Collapse panel` and `dashboard.upgrade_to_pro` are older keys
 * every dictionary already carries.
 *
 * @module components/chat/text
 */

export const CHAT_TEXT = {
  // -- the panel ---------------------------------------------------------------------------
  'chat.panel.label': 'AI Analyst chat',
  'chat.loading': 'Loading the analyst…',
  'chat.unavailable.title': 'The AI Analyst is not switched on yet',
  'chat.unavailable.body':
    'Your charts and line alerts keep working in the meantime.',
  'chat.state_failed': 'The analyst could not be reached just now.',
  'chat.retry': 'Try again',
  'chat.empty.title': 'Ask about gold',
  'chat.empty.body':
    'Ask about XAUUSD on the M15 and M5 charts. Answers are built from the same sensor data as your charts.',

  // -- the composer ------------------------------------------------------------------------
  'chat.composer.label': 'Your question',
  'chat.composer.placeholder': 'Ask about XAUUSD…',
  'chat.composer.busy': 'An analysis is in progress…',
  'chat.composer.send': 'Send question',
  'chat.composer.stop': 'Stop',
  'chat.composer.hint': 'Enter sends, Shift+Enter adds a line',
  'chat.composer.too_long': 'The question is too long.',

  // -- the conversation --------------------------------------------------------------------
  'chat.you': 'You',
  'chat.instant.INSTANT_M15_INSPECT': 'Inspect the M15 chart',
  'chat.instant.INSTANT_M5_INSPECT': 'Inspect the M5 chart',
  'chat.messages.label': 'Conversation',

  // -- progress ----------------------------------------------------------------------------
  'chat.stages.label': 'Progress',
  'chat.stage.GATE': 'Checking your access',
  'chat.stage.UNDERSTAND': 'Understanding your question',
  'chat.stage.DATA': 'Reading the latest data',
  'chat.stage.CONTEXT': 'Preparing the context',
  'chat.stage.MODEL': 'Writing the analysis',
  'chat.stage.CHECKS': 'Checking every number',
  'chat.stage.waiting': 'Waiting',
  'chat.stage.active': 'In progress',
  'chat.stage.done': 'Done',
  'chat.stage.skipped': 'Skipped',

  // -- direction ---------------------------------------------------------------------------
  'chat.report1.title': 'Market analysis',
  'chat.direction.label': 'Direction',
  'chat.direction.rule': 'Rule {rule}',
  'chat.direction.archetype': 'Archetype {archetype}',
  'chat.direction.note':
    'The direction comes from the market reading, not from the AI.',
  'chat.bias.LONG': 'Long (buy)',
  'chat.bias.SHORT': 'Short (sell)',
  'chat.bias.NEUTRAL': 'Neutral',
  'chat.bias.STAND_ASIDE': 'Stand aside',
  'chat.trend.WITH_TREND': 'With the trend',
  'chat.trend.COUNTER_TREND': 'Counter-trend',
  'chat.profile.DAY_TRADER': 'Day trader',
  'chat.profile.SCALPER': 'Scalper',

  // -- the six sections --------------------------------------------------------------------
  'chat.section.alignment': 'M15 and M5 alignment',
  'chat.section.levels': 'Levels',
  'chat.section.zones': 'Entry zones',
  'chat.section.watch': 'What would change the picture',
  'chat.section.risks': 'Risks and news',
  'chat.channel.status.VALID': 'Valid',
  'chat.channel.status.CAUTIONARY': 'Cautionary',
  'chat.channel.status.INVALID': 'Invalid',
  'chat.channel.status.STALE': 'Stale',
  'chat.channel.status.ABSENT': 'No reading',
  'chat.levels.channel': 'Channel',
  'chat.levels.context': 'Context',
  'chat.levels.none': 'No levels in this reading.',
  'chat.zone.heading': 'Zone {zone}',
  'chat.zone.long': 'Long zone',
  'chat.zone.short': 'Short zone',
  'chat.zone.band': 'Band',
  'chat.zone.reference': 'Reference',
  'chat.zone.invalidation': 'Invalidation',
  'chat.zone.basis.LEVEL': 'behind a level',
  'chat.zone.basis.MINIMUM_STOP': 'minimum stop',
  'chat.zone.basis.NO_LEVEL': 'no level behind it',
  'chat.zone.stop': 'Stop distance',
  'chat.zone.room': 'Room to the next level',
  'chat.zone.room_ratio': 'Room against the stop',
  'chat.zone.confluence': 'Sensors in agreement',
  'chat.zone.sources': 'Sensors',
  'chat.zone.none': 'No entry zone for this reading.',
  'chat.news.status.OK': 'Calendar up to date',
  'chat.news.status.LATE': 'Calendar is late',
  'chat.news.status.UNAVAILABLE': 'Calendar unavailable',
  'chat.news.none': 'No listed events in the window.',
  'chat.news.tier1': 'Tier 1',
  'chat.news.approximate': 'time approximate',
  'chat.news.age': 'Calendar age: {minutes} min',

  // -- the data stamp, the notices and the provenance --------------------------------------
  'chat.stamp.as_of': 'Data as of {time}',
  'chat.stamp.no_cycle': 'No market cycle was read.',
  'chat.stamp.retuning': 'Sensors are retuning',
  'chat.status.FRESH': 'Live',
  'chat.status.DELAYED': 'Delayed',
  'chat.status.STALE': 'Stopped',
  'chat.status.MARKET_CLOSED': 'Market closed',
  'chat.status.UNKNOWN': 'Unknown',
  'chat.flag.SENSORS_NOT_LIVE': 'Sensors are not live',
  'chat.flag.GATEWAY_UNREACHABLE': 'Data gateway unreachable',
  'chat.disclaimer.text':
    'Market analysis for information only, not investment advice. You decide, and you place any order yourself. Trading gold can lose money.',
  'chat.disclaimer.version': 'Version {version}',
  'chat.notice.ai':
    'Written by AI from your market data. Check it against your chart.',
  'chat.provenance.model': 'AI model',
  'chat.provenance.prompt': 'Prompt version',
  'chat.provenance.request': 'Request',
  'chat.provenance.no_model': 'built from the sensor data, no AI model',
  'chat.flagged.note':
    'Numbers that could not be verified are marked: {count}.',
  'chat.note.CHART_OTHER_CYCLE':
    'The chart image was drawn for another cycle, so it was not used.',
  'chat.note.CHART_UNAVAILABLE':
    'The chart image could not be read, so it was not used.',
  'chat.changes.title': 'Changed since your last answer',
  'chat.changes.none': 'none',

  // -- the trade setup action --------------------------------------------------------------
  'chat.action.open_setup': 'Open trade setup',
  'chat.action.hint': 'Size a trade from these zones.',
  'chat.action.failed': 'The trade setup could not be opened just now.',

  // -- the other cards ---------------------------------------------------------------------
  'chat.answer.cites': 'Based on: {ids}',
  'chat.fixed.title': 'Answer from the sensor board',
  'chat.fixed.board': 'Sensor board',
  'chat.fixed.no_direction': 'No direction is given.',
  'chat.fixed.reason.DATA_STALE':
    'The data has stopped, so no direction is given. This is the last reading, stamped with its time.',
  'chat.fixed.reason.WORDING_FAILED':
    'The written analysis did not pass our checks, so only the sensor data is shown.',
  'chat.fixed.reason.SCHEMA_FAILED':
    'The written analysis could not be put together, so only the sensor data is shown.',
  'chat.fixed.reason.MODEL_UNAVAILABLE':
    'The analysis model is not available right now. Here is the sensor data.',
  'chat.fixed.reason.DEADLINE':
    'The analysis took too long. Here is the sensor data.',
  'chat.fixed.reason.MARKET_CLOSED':
    'The market is closed. This is the picture from the last session.',
  'chat.fixed.reason.NO_SYNTHESIS':
    'No combined reading exists for this cycle, so no direction is given.',
  'chat.refusal.title': 'Not answered',
  'chat.refusal.allowance': 'Allowance left this month: {percent}',
  'chat.error.title': 'The request did not finish',
  'chat.error.request_id': 'Request ID {id}',
  'chat.error.INTERNAL': 'Something failed on our side. You can try again.',
  'chat.error.LEDGER_UNAVAILABLE':
    'Your usage could not be checked, so the request was not run. You can try again.',
  'chat.error.PERSISTENCE_FAILED':
    'The analysis was made but could not be saved, so it is not shown. Contact support with the request ID.',
  'chat.error.NETWORK': 'The connection dropped before the answer arrived.',
  'chat.error.BAD_STREAM':
    'The answer arrived in a form we could not read. You can try again.',
  'chat.error.HTTP': 'The server answered with an error. You can try again.',
  'chat.cancelled':
    'Stopped. An analysis that had already started may still show up in your history.',

  // -- the model picker and the quota meter ------------------------------------------------
  'chat.model.label': 'AI model',
  'chat.model.none': 'No model available yet',
  'chat.model.default': 'Default',
  'chat.model.not_measured': 'not measured yet',
  'chat.model.measured': 'cost measured',
  'chat.model.left': 'about {count} analyses left',
  'chat.model.locked': 'Model choice is part of PRO',
  'chat.quota.label': 'Monthly allowance',
  'chat.quota.left': '{percent} left',
  'chat.quota.analyses': 'About {count} analyses left',
  'chat.quota.not_measured': 'Analyses left: not measured yet',
  'chat.quota.unconfigured': 'The monthly allowance is not set yet.',
  'chat.quota.empty': 'The allowance for this month is used up.',

  // -- the header badges -------------------------------------------------------------------
  'chat.badge.cycle': 'Cycle {time}',
  'chat.badge.no_cycle': 'No cycle yet',

  // -- Panel A: the threads (build step 7 part 9) ------------------------------------------
  'chat.threads.label': 'Conversations',
  'chat.threads.new': 'New thread',
  'chat.threads.loading': 'Loading your conversations…',
  'chat.threads.empty_title': 'No conversations yet',
  'chat.threads.empty_body': 'Your questions to the AI Analyst are saved here.',
  'chat.threads.error': 'Your conversations could not be loaded.',
  'chat.threads.unavailable':
    'Conversations appear here once the AI Analyst is switched on.',
  'chat.threads.load_more': 'Show more',
  'chat.threads.more_failed': 'More conversations could not be loaded.',
  'chat.threads.bias.LONG': 'Long',
  'chat.threads.bias.SHORT': 'Short',
  'chat.threads.bias.NEUTRAL': 'Neutral',
  'chat.threads.bias.STAND_ASIDE': 'Stand aside',
  'chat.threads.rename_for': 'Rename {title}',
  'chat.threads.rename_label': 'Conversation name',
  'chat.threads.rename_save': 'Save name',
  'chat.threads.rename_cancel': 'Cancel',
  'chat.threads.rename_failed': 'The name could not be saved.',
  'chat.threads.delete_for': 'Delete {title}',
  'chat.threads.delete_title': 'Delete this conversation?',
  'chat.threads.delete_body':
    'The messages of this conversation are removed for good. A separate audit record of each request stays on our servers and cannot be changed or deleted; it holds no part of your questions.',
  'chat.threads.delete_confirm': 'Delete conversation',
  'chat.threads.delete_cancel': 'Keep it',
  'chat.threads.delete_failed': 'The conversation could not be deleted.',
  'chat.threads.opening': 'Opening the conversation…',
  'chat.threads.open_failed': 'This conversation could not be opened.',
  'chat.threads.demo_title': 'Recorded example',
  'chat.threads.last_message': 'Last message: {time}',

  // -- the Free tier -----------------------------------------------------------------------
  'chat.demo.label': 'Recorded example, data as of {time}',
  'chat.demo.body':
    'This is a recorded conversation, not live data. Upgrade to PRO to ask your own questions.',
  'chat.demo.empty': 'The recorded example is not available yet.',
  'chat.free.title': 'Read-only (Free tier)',
  'chat.free.body': 'Upgrade to PRO to ask the AI Analyst your own questions.',
} as const;

export type ChatKey = keyof typeof CHAT_TEXT;

export const CHAT_KEYS = Object.keys(CHAT_TEXT) as ChatKey[];

/**
 * The wording that waits for counsel and for a native reader before the flag goes on (the notices
 * that tell the reader what the AI is and is not, and what was and was not checked). A draft in all
 * 19 languages ships; the flag stays off (`REPLY_ENABLED`).
 */
export const DRAFT_TEXT_KEYS: readonly ChatKey[] = [
  'chat.disclaimer.text',
  'chat.notice.ai',
  'chat.direction.note',
  'chat.flagged.note',
  'chat.demo.label',
  'chat.demo.body',
  'chat.fixed.reason.DATA_STALE',
  'chat.fixed.reason.WORDING_FAILED',
  'chat.fixed.reason.SCHEMA_FAILED',
  'chat.fixed.reason.MODEL_UNAVAILABLE',
  'chat.fixed.reason.DEADLINE',
  'chat.fixed.reason.MARKET_CLOSED',
  'chat.fixed.reason.NO_SYNTHESIS',
  'chat.error.PERSISTENCE_FAILED',
  // what is kept after a conversation is deleted is a statement about the audit record (ADR-098 D16)
  'chat.threads.delete_body',
];

export type TextParams = Readonly<Record<string, string>>;

/** The `{name}` placeholders of a text, in order of appearance, each once. */
export function placeholdersOf(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    const name = match[1] as string;
    if (!found.includes(name)) found.push(name);
  }
  return found;
}

/** The text with each `{name}` replaced by its parameter; one that is not given stays as written. */
export function fillText(text: string, params?: TextParams): string {
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? (params[name] as string)
      : whole
  );
}
