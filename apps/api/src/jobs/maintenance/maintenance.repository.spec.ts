import type { InsForgeClient } from '@insforge/sdk';

import { IN_CHUNK_SIZE, InsforgeMaintenanceRepository } from './maintenance.repository.js';

/** Cliente falso: cada `.select().in(col, ids)` responde un perfil por id y registra el tamaño. */
function fakeClient() {
  const inSizes: number[] = [];
  const client = {
    database: {
      from: () => ({
        select: () => ({
          in: async (_column: string, ids: string[]) => {
            inSizes.push(ids.length);
            return { data: ids.map((id) => ({ user_id: id, timezone: 'UTC' })), error: null };
          },
        }),
      }),
    },
  } as unknown as InsForgeClient;
  return { client, inSizes };
}

describe('InsforgeMaintenanceRepository.loadTimezones', () => {
  it('trocea el .in() en lotes de IN_CHUNK_SIZE ids', async () => {
    const { client, inSizes } = fakeClient();
    const repository = new InsforgeMaintenanceRepository(client);
    const ids = Array.from({ length: 450 }, (_unused, i) => `user-${i}`);

    const timezones = await repository.loadTimezones(ids);

    expect(IN_CHUNK_SIZE).toBe(200);
    expect(inSizes).toEqual([200, 200, 50]);
    expect(timezones.size).toBe(450);
  });

  it('sin ids no hace ninguna petición', async () => {
    const { client, inSizes } = fakeClient();
    const repository = new InsforgeMaintenanceRepository(client);

    expect((await repository.loadTimezones([])).size).toBe(0);
    expect(inSizes).toEqual([]);
  });
});
