import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { Provider, ProviderCredential } from '../db/schema.js';
import type { CredentialErrorCode } from '../llm/llm.service.js';
import type { ProviderStatusRow } from './credentials.repository.js';

/** Credencial activa del usuario, con la key ya descifrada y solo en memoria. */
export interface ActiveCredential {
  readonly provider: Provider;
  readonly apiKey: string;
}

/** Fuente de credenciales. Solo credenciales con `status = 'active'`. */
export interface CredentialsSource {
  listActive(userId: string): Promise<readonly ActiveCredential[]>;
}

/**
 * Fase de transición (decisión D4): sesiones y jobs siguen pidiendo
 * credenciales, pero la respuesta es siempre la del operador
 * (`NINEROUTER_API_KEY`). No toca la base. La key nunca se registra en el log.
 */
@Injectable()
export class CredentialsService implements CredentialsSource {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async listActive(_userId: string): Promise<readonly ActiveCredential[]> {
    return [{ provider: '9router', apiKey: this.operatorKey() }];
  }

  async getActiveApiKey(_userId: string, _provider: Provider): Promise<string | null> {
    return this.operatorKey();
  }

  async saveApiKey(_userId: string, provider: Provider, _apiKey: string): Promise<void> {
    this.logger.warn(`saveApiKey('${provider}') ignorado: la credencial es la del operador.`);
  }

  async markCredentialError(
    _userId: string,
    provider: Provider,
    code: CredentialErrorCode,
  ): Promise<void> {
    this.logger.warn(`markCredentialError('${provider}', ${code}) ignorado: la credencial es la del operador.`);
  }

  async remove(_userId: string, provider: Provider): Promise<boolean> {
    this.logger.warn(`remove('${provider}') ignorado: la credencial es la del operador.`);
    return false;
  }

  async find(_userId: string, _provider: Provider): Promise<ProviderCredential | null> {
    return null;
  }

  async listStatuses(_userId: string): Promise<ProviderStatusRow[]> {
    return [];
  }

  private operatorKey(): string {
    return this.config.get('NINEROUTER_API_KEY', { infer: true });
  }
}
