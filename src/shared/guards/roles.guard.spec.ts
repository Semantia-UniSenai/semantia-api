import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { AuthUser } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const buildContext = (user?: AuthUser): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('allows routes without @Roles metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.PROFESSOR]);

    const context = buildContext({
      userId: 'user-1',
      email: 'prof@semantia.app',
      role: UserRole.PROFESSOR,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a user whose role is not listed (aluno on teacher-only route)', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.PROFESSOR]);

    const context = buildContext({
      userId: 'user-1',
      email: 'aluno@semantia.app',
      role: UserRole.ALUNO,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when there is no principal on the request', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ALUNO]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
