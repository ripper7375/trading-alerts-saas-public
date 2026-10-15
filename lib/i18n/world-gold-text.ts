import messages from './world-gold-messages.json';

/** The route bundles only its own messages, avoiding a language-loading flash or failure. */
export function worldGoldText(language: string, key: string): string {
  const dictionaries: Record<string, Record<string, string>> = messages;
  return dictionaries[language]?.[key] ?? dictionaries['en-GB']?.[key] ?? key;
}
