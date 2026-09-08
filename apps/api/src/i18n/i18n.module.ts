import { Global, Module } from '@nestjs/common';
import { I18nService } from './i18n.service.js';

/**
 * Módulo global de i18n: expone `I18nService` (mensajes de error en `es` y
 * `pt-BR`, SPEC-02 §6) para que cualquier módulo lo inyecte sin volver a
 * importar este módulo.
 */
@Global()
@Module({
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
