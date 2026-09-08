import { I18nService } from './i18n.service.js';
import { API_ERROR_STATUS } from '../common/api-error.js';

describe('I18nService.translate', () => {
  const i18n = new I18nService();

  it('has a Spanish and Portuguese message for every SPEC-02 §6 error code', () => {
    for (const code of Object.keys(API_ERROR_STATUS) as (keyof typeof API_ERROR_STATUS)[]) {
      expect(i18n.translate(code, 'es')).not.toBe(code);
      expect(i18n.translate(code, 'pt-BR')).not.toBe(code);
    }
  });

  it('returns different text for es and pt-BR', () => {
    expect(i18n.translate('INVITATION_EXPIRED', 'es')).not.toBe(
      i18n.translate('INVITATION_EXPIRED', 'pt-BR'),
    );
  });
});

describe('I18nService.resolveLocale', () => {
  const i18n = new I18nService();

  it('uses the profile locale when it is valid', () => {
    expect(i18n.resolveLocale('pt-BR')).toBe('pt-BR');
    expect(i18n.resolveLocale('es')).toBe('es');
  });

  it('falls back to Accept-Language when there is no profile locale', () => {
    expect(i18n.resolveLocale(null, 'pt-BR,pt;q=0.9')).toBe('pt-BR');
    expect(i18n.resolveLocale(undefined, 'pt;q=0.9')).toBe('pt-BR');
    expect(i18n.resolveLocale(null, 'en-US,en;q=0.9')).toBe('es');
  });

  it('falls back to es when there is neither a profile locale nor Accept-Language', () => {
    expect(i18n.resolveLocale(null, undefined)).toBe('es');
    expect(i18n.resolveLocale(undefined, undefined)).toBe('es');
  });

  it('ignores an invalid/unexpected profile locale value and falls back', () => {
    expect(i18n.resolveLocale('fr', 'pt-BR')).toBe('pt-BR');
  });
});
