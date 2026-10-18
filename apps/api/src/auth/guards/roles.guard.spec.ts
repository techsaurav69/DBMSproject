import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['citizen'] } }) }),
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects users that do not have the required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrator']);
    expect(() => new RolesGuard(reflector as never).canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('allows users assigned a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['citizen']);
    expect(new RolesGuard(reflector as never).canActivate(context as never)).toBe(true);
  });
});
