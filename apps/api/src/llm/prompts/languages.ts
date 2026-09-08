import type { Locale } from '../config.js';

/**
 * SPEC-03 §4: `{native_language}`, `{note_language}` y `{summary_language}` se derivan
 * de `profiles.locale`. El de `summary_language` usa el locale del owner del grupo.
 */
const LANGUAGE_BY_LOCALE: Readonly<Record<Locale, string>> = Object.freeze({
  es: 'Spanish',
  'pt-BR': 'Brazilian Portuguese',
});

export function languageForLocale(locale: Locale): string {
  return LANGUAGE_BY_LOCALE[locale] ?? LANGUAGE_BY_LOCALE.es;
}
