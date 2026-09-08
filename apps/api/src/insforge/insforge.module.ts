import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdminClient } from '@insforge/sdk';
import type { Env } from '../config/env.js';
import { INSFORGE_ADMIN_CLIENT } from './insforge.constants.js';
import { InsforgeHttp } from './insforge.http.js';

const adminClientProvider: Provider = {
  provide: INSFORGE_ADMIN_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Env, true>) =>
    createAdminClient({
      baseUrl: configService.get('INSFORGE_URL', { infer: true }),
      apiKey: configService.get('INSFORGE_API_KEY', { infer: true }),
    }),
};

/**
 * Módulo global de InsForge: expone el cliente admin (`@insforge/sdk`,
 * `createAdminClient`) bajo el token `INSFORGE_ADMIN_CLIENT` y `InsforgeHttp`
 * (cliente `fetch` tipado para endpoints no cubiertos por el SDK), para que
 * módulos futuros de otros PRs los inyecten sin volver a importar este
 * módulo.
 */
@Global()
@Module({
  providers: [adminClientProvider, InsforgeHttp],
  exports: [INSFORGE_ADMIN_CLIENT, InsforgeHttp],
})
export class InsforgeModule {}
