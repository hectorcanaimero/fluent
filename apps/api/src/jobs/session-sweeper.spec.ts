import { Logger } from '@nestjs/common';

import { NullSessionSweeper } from './session-sweeper.js';

describe('NullSessionSweeper', () => {
  it('loguea el aviso de que PR-04 aún no existe y devuelve un resultado en ceros', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const sweeper = new NullSessionSweeper();

    const result = await sweeper.run();

    expect(result).toEqual({
      closedByHardCap: 0,
      closedAsAbandoned: 0,
      markedAbandoned: 0,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('SessionSweeper aún no implementado');

    warnSpy.mockRestore();
  });
});
