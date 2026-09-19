import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { BadgesRepository } from './badges.repository.js';
import { BadgesService } from './badges.service.js';

function makeService(awardPending: () => Promise<void>) {
  const calls: string[] = [];
  const repo = {
    awardPending: async () => {
      calls.push('award');
      await awardPending();
    },
    listCatalog: async () => {
      calls.push('read');
      return [];
    },
    listEarned: async () => [],
    findProgressSource: async () => null,
  } as unknown as BadgesRepository;
  const config = { get: () => 'https://x.insforge.app' } as unknown as ConfigService<Env, true>;
  return { service: new BadgesService(repo, config), calls };
}

describe('BadgesService.getBadges', () => {
  it('otorga lo pendiente antes de leer', async () => {
    const { service, calls } = makeService(async () => undefined);
    await service.getBadges('user-1');
    expect(calls).toEqual(['award', 'read']);
  });

  it('si otorgar falla, igual devuelve el catálogo', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = makeService(async () => {
      throw new Error('rpc caída');
    });
    await expect(service.getBadges('user-1')).resolves.toEqual({ badges: [] });
    warn.mockRestore();
  });
});
