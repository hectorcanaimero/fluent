import type { ConfigService } from '@nestjs/config';
import { CredentialsService } from './credentials.service.js';

const config = { get: vi.fn(() => 'operator-key') } as unknown as ConfigService<never, true>;
const service = new CredentialsService(config);

describe('CredentialsService (fase de transición D4)', () => {
  it('listActive devuelve siempre la credencial del operador', async () => {
    await expect(service.listActive('u1')).resolves.toEqual([
      { provider: '9router', apiKey: 'operator-key' },
    ]);
  });

  it('getActiveApiKey devuelve la key del operador', async () => {
    await expect(service.getActiveApiKey('u1', '9router')).resolves.toBe('operator-key');
  });

  it('find y listStatuses no devuelven nada', async () => {
    await expect(service.find('u1', '9router')).resolves.toBeNull();
    await expect(service.listStatuses('u1')).resolves.toEqual([]);
  });

  it('saveApiKey, remove y markCredentialError son no-op', async () => {
    await expect(service.saveApiKey('u1', '9router', 'k')).resolves.toBeUndefined();
    await expect(service.remove('u1', '9router')).resolves.toBe(false);
    await expect(service.markCredentialError('u1', '9router', 'AUTH_ERROR')).resolves.toBeUndefined();
  });
});
