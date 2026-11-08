// Texts in English and Portuguese (decided after milestone 4). t('key', { name: 'Pikachu' }) fills {name}.

import { en, type MessageKey } from './en';
import { pt } from './pt';

export const LANGUAGES = ['en', 'pt'] as const;
export type Language = (typeof LANGUAGES)[number];
export type { MessageKey };

const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, pt };

let current: Language = 'en';

export const language = () => current;
export function setLanguage(next: Language) {
  current = next;
}

export const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

/** Portuguese for any Portuguese browser (pt-BR, pt-PT…), English otherwise. */
export const detectLanguage = (browserLanguage: string): Language => (browserLanguage.toLowerCase().startsWith('pt') ? 'pt' : 'en');

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return MESSAGES[current][key].replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** The language names, each in its own language (for the language picker). */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', pt: 'Português' };

export const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
export { MESSAGES };
