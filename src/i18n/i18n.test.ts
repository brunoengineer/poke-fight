import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en';
import { detectLanguage, LANGUAGES, MESSAGES, placeholders, setLanguage, t } from './index';

describe('translations', () => {
  afterEach(() => setLanguage('en'));

  it.each(LANGUAGES)('%s has every text, with the same {placeholders} as English', language => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const text = MESSAGES[language][key];
      expect(text, key).toBeTruthy();
      expect(placeholders(text), key).toEqual(placeholders(en[key]));
    }
  });

  it('fills placeholders, in the current language', () => {
    expect(t('results.level', { name: 'Pikachu', level: 12 })).toBe('Pikachu grew to Lv. 12!');
    setLanguage('pt');
    expect(t('results.level', { name: 'Pikachu', level: 12 })).toBe('Pikachu subiu para o Nv. 12!');
  });

  it('leaves a missing placeholder visible (easy to spot)', () => {
    expect(t('results.level', { name: 'Pikachu' })).toBe('Pikachu grew to Lv. {level}!');
  });

  it('picks Portuguese for any Portuguese browser, English otherwise', () => {
    expect(['pt-BR', 'pt-PT', 'pt', 'en-US', 'es-ES'].map(detectLanguage)).toEqual(['pt', 'pt', 'pt', 'en', 'en']);
  });
});
