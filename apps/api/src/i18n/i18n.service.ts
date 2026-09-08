import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { ApiErrorCode } from '../common/api-error.js';
import type { Locale } from '../db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_LOCALE: Locale = 'es';

type Catalog = Record<string, string>;

function loadCatalog(filename: string): Catalog {
  const raw = readFileSync(join(__dirname, filename), 'utf-8');
  return JSON.parse(raw) as Catalog;
}

/**
 * Mensajes de error traducidos, elegidos por `locale` (SPEC-02 §6 y
 * `docs/specs/README.md`).
 *
 * Carga `es.json` y `pt-BR.json` una sola vez con `readFileSync` +
 * `fileURLToPath`, igual que `apps/api/src/content/index.ts` (así
 * `nest build` los copia a `dist` vía `compilerOptions.assets` de
 * `nest-cli.json`, que ya incluye `**\/*.json`).
 *
 * PEND-xx (docs/specs/pendientes/PR-02.md): el idioma se elige por
 * `profiles.locale`; si todavía no hay perfil (o el llamador no lo carga),
 * se cae a la cabecera `Accept-Language`, y si tampoco hay, a `es`. La app
 * móvil nunca envía `Accept-Language` (SPEC-06 §6), así que en la práctica
 * ese último recurso solo importa fuera de la app (Swagger, curl manual).
 */
@Injectable()
export class I18nService {
  private readonly catalogs: Record<Locale, Catalog> = {
    es: loadCatalog('es.json'),
    'pt-BR': loadCatalog('pt-BR.json'),
  };

  /** Texto para humanos de un código de error, en el idioma resuelto. */
  translate(code: ApiErrorCode, locale: Locale): string {
    return this.catalogs[locale][code] ?? this.catalogs[DEFAULT_LOCALE][code] ?? code;
  }

  /**
   * Resuelve el idioma: el del perfil si es válido, si no el de
   * `Accept-Language`, si no `es`.
   */
  resolveLocale(
    profileLocale?: string | null,
    acceptLanguageHeader?: string | null,
  ): Locale {
    if (this.isLocale(profileLocale)) {
      return profileLocale;
    }
    return this.fromAcceptLanguage(acceptLanguageHeader);
  }

  private isLocale(value: string | null | undefined): value is Locale {
    return value === 'es' || value === 'pt-BR';
  }

  /** Toma la primera preferencia de la cabecera; `pt*` → `pt-BR`, si no `es`. */
  private fromAcceptLanguage(header?: string | null): Locale {
    if (!header) {
      return DEFAULT_LOCALE;
    }
    const first = header.split(',')[0]?.split(';')[0]?.trim().toLowerCase();
    return first?.startsWith('pt') ? 'pt-BR' : DEFAULT_LOCALE;
  }
}
