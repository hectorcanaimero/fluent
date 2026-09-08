import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { OwnerAuthGuard, checkOwnerBearer } from './owner-auth.guard.js';
import { InsforgeHttp } from '../insforge/insforge.http.js';

describe('OwnerAuthGuard', () => {
  let guard: OwnerAuthGuard;
  let insforgeHttpMock: Partial<InsforgeHttp>;
  let configServiceMock: Partial<ConfigService>;

  const ownerId = 'd41e8bce-c1c1-4f2a-b123-456789abcdef';

  beforeEach(async () => {
    insforgeHttpMock = {
      getCurrentSession: vi.fn(),
    };

    configServiceMock = {
      get: vi.fn().mockReturnValue(ownerId),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnerAuthGuard,
        { provide: InsforgeHttp, useValue: insforgeHttpMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    guard = module.get<OwnerAuthGuard>(OwnerAuthGuard);
  });

  describe('canActivate', () => {
    it('throws UnauthorizedException when no Authorization header is present', async () => {
      const mockRequest = { headers: { authorization: undefined } } as Request;
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when bearer token is invalid', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: false,
      });

      const mockRequest = {
        headers: { authorization: 'Bearer invalid_token' },
      } as Request;
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException when userId does not match OWNER_USER_ID', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: true,
        userId: 'different-user-id',
      });

      const mockRequest = {
        headers: { authorization: 'Bearer valid_token' },
      } as Request;
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns true when userId matches OWNER_USER_ID', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: true,
        userId: ownerId,
      });

      const mockRequest = {
        headers: { authorization: 'Bearer valid_token' },
      } as Request;
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });
});

describe('checkOwnerBearer', () => {
  const ownerId = 'd41e8bce-c1c1-4f2a-b123-456789abcdef';

  let insforgeHttpMock: Partial<InsforgeHttp>;

  beforeEach(() => {
    insforgeHttpMock = {
      getCurrentSession: vi.fn(),
    };
  });

  it('returns 401 UNAUTHENTICATED when no Authorization header', async () => {
    const result = await checkOwnerBearer(
      undefined,
      insforgeHttpMock as InsforgeHttp,
      ownerId,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe('UNAUTHENTICATED');
  });

  it('returns 401 UNAUTHENTICATED when Authorization header is not Bearer', async () => {
    const result = await checkOwnerBearer(
      'Basic dGVzdDp0ZXN0',
      insforgeHttpMock as InsforgeHttp,
      ownerId,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe('UNAUTHENTICATED');
  });

  it('returns 401 UNAUTHENTICATED when getCurrentSession resolves to ok: false', async () => {
    vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
      ok: false,
    });

    const result = await checkOwnerBearer(
      'Bearer invalid_token',
      insforgeHttpMock as InsforgeHttp,
      ownerId,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe('UNAUTHENTICATED');
  });

  it('returns 403 FORBIDDEN when userId does not match ownerId', async () => {
    vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
      ok: true,
      userId: 'other-user-id',
    });

    const result = await checkOwnerBearer(
      'Bearer valid_token',
      insforgeHttpMock as InsforgeHttp,
      ownerId,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe('FORBIDDEN');
  });

  it('returns ok: true when userId matches ownerId', async () => {
    vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
      ok: true,
      userId: ownerId,
    });

    const result = await checkOwnerBearer(
      'Bearer valid_token',
      insforgeHttpMock as InsforgeHttp,
      ownerId,
    );
    expect(result.ok).toBe(true);
  });
});
