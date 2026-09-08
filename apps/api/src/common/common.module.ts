import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { createValidationPipe } from './validation-pipe.factory.js';
import { I18nService } from '../i18n/i18n.service.js';

/**
 * Filtro global de errores y `ValidationPipe` global de PR-02/T3, ambos
 * registrados con los tokens `APP_*` de Nest (`APP_FILTER`, `APP_PIPE`) en
 * vez de con `app.useGlobalFilters`/`app.useGlobalPipes` en `main.ts`.
 *
 * Motivo (SPEC-02 §6/§8): un provider `APP_*` se activa automáticamente para
 * **cualquier** `Test.createTestingModule({ imports: [AppModule] })`, que es
 * como arrancan los tests e2e (`apps/api/test/*.e2e-spec.ts`). Si en cambio
 * se registrara solo en `main.ts`, cada test e2e tendría que repetir la
 * configuración a mano (y desincronizarse con facilidad). `main.ts` ya no
 * necesita `app.useGlobalPipes(...)` — este módulo basta.
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    {
      provide: APP_PIPE,
      useFactory: (i18nService: I18nService): ValidationPipe =>
        createValidationPipe(i18nService),
      inject: [I18nService],
    },
  ],
})
export class CommonModule {}
