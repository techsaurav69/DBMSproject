import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));

describe('AuthService', () => {
  const database = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  const user = {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'coordinator.demo@crisisgrid.local',
    display_name: 'Kiran Demo',
    password_hash: '$2a$12$placeholder',
    roles: ['coordinator'],
  };

  beforeEach(() => jest.clearAllMocks());

  it('issues a token only after successful password verification', async () => {
    database.query.mockResolvedValue({ rows: [user] });
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    const service = new AuthService(database as never, jwtService as never);

    await expect(service.login({ email: user.email, password: 'DemoOnly!ChangeBeforeProduction' })).resolves.toEqual({
      accessToken: 'signed-token',
      user: { id: user.id, email: user.email, displayName: user.display_name, roles: ['coordinator'] },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: user.id, email: user.email, roles: ['coordinator'] });
  });

  it('does not issue a token when credentials are invalid', async () => {
    database.query.mockResolvedValue({ rows: [user] });
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const service = new AuthService(database as never, jwtService as never);
    await expect(service.login({ email: user.email, password: 'incorrect-password' })).rejects.toThrow('Email or password is incorrect');
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
