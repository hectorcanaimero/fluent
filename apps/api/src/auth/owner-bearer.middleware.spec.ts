import type { OwnerService } from '../common/owner.service.js';
import type { AuthGuard } from './auth.guard.js';
import { checkOwnerBearer } from './owner-bearer.middleware.js';

/**
 * Casos heredados de `admin/owner-auth.guard.spec.ts` (PR-05): el
 * `OwnerAuthGuard` y su `checkOwnerBearer` se borraron al fusionar PR-05 en
 * PR-02 (una sola forma de autorizar al owner, PEND-73), así que sus casos
 * (falta cabecera / no es Bearer / token inválido / no es owner / es owner)
 * se prueban aquí contra la implementación que queda.
 */
const OWNER_ID = 'd41e8bce-c1c1-4f2a-b123-456789abcdef';

function makeAuthGuard(resolved: string | null): Pick<AuthGuard, 'resolveUserId'> {
  return { resolveUserId: vi.fn().mockResolvedValue(resolved) };
}

const ownerService: Pick<OwnerService, 'isSystemOwner'> = {
  isSystemOwner: (userId: string) => userId === OWNER_ID,
};

describe('checkOwnerBearer', () => {
  it('401 UNAUTHENTICATED si no hay cabecera Authorization', async () => {
    const authGuard = makeAuthGuard(OWNER_ID);

    const result = await checkOwnerBearer(undefined, authGuard, ownerService);

    expect(result).toMatchObject({ ok: false, status: 401, error: 'UNAUTHENTICATED' });
    // Ni siquiera se intenta resolver el token.
    expect(authGuard.resolveUserId).not.toHaveBeenCalled();
  });

  it('401 UNAUTHENTICATED si el esquema no es Bearer', async () => {
    const result = await checkOwnerBearer(
      'Basic dGVzdDp0ZXN0',
      makeAuthGuard(OWNER_ID),
      ownerService,
    );

    expect(result).toMatchObject({ ok: false, status: 401, error: 'UNAUTHENTICATED' });
  });

  it('401 UNAUTHENTICATED si el token no resuelve a ningún usuario', async () => {
    const result = await checkOwnerBearer(
      'Bearer invalid_token',
      makeAuthGuard(null),
      ownerService,
    );

    expect(result).toMatchObject({ ok: false, status: 401, error: 'UNAUTHENTICATED' });
  });

  it('403 FORBIDDEN si el token es válido pero el usuario no es el owner', async () => {
    const result = await checkOwnerBearer(
      'Bearer valid_token',
      makeAuthGuard('other-user-id'),
      ownerService,
    );

    expect(result).toMatchObject({ ok: false, status: 403, error: 'FORBIDDEN' });
  });

  it('ok con el userId cuando el token es del owner', async () => {
    const result = await checkOwnerBearer(
      'Bearer valid_token',
      makeAuthGuard(OWNER_ID),
      ownerService,
    );

    expect(result).toEqual({ ok: true, userId: OWNER_ID });
  });

  it('reutiliza la caché del AuthGuard: una sola resolución por petición', async () => {
    const authGuard = makeAuthGuard(OWNER_ID);

    await checkOwnerBearer('Bearer  valid_token  ', authGuard, ownerService);

    // `extractBearerToken` normaliza espacios: el token llega limpio.
    expect(authGuard.resolveUserId).toHaveBeenCalledTimes(1);
    expect(authGuard.resolveUserId).toHaveBeenCalledWith('valid_token');
  });
});
