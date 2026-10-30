import { AuthService } from './auth.service';

describe('AuthService session management', () => {
  let service: AuthService;
  let db: any;

  beforeEach(() => {
    db = {
      activeSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      userLoginHistory: {
        create: jest.fn(),
      },
    };

    service = new AuthService(
      {} as any,
      db,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
      { get: jest.fn() } as any,
      {} as any,
      {} as any,
    );
  });

  it('creates a new session row for each browser instead of overwriting the previous one', async () => {
    const token = await service.createSession(42, '127.0.0.1', 'Chrome', 'Pune');

    expect(db.activeSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        sessionToken: expect.any(String),
        ipAddress: '127.0.0.1',
        userAgent: 'Chrome',
        location: 'Pune',
      }),
    });
    expect(token).toEqual(expect.any(String));
  });

  it('validates the active browser session using both userId and sessionToken', async () => {
    db.activeSession.findFirst.mockResolvedValue({ userId: 42, sessionToken: 'abc' });

    await expect(service.validateSessionToken(42, 'abc')).resolves.toBe(true);
    expect(db.activeSession.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 42,
        sessionToken: 'abc',
      },
    });
  });
});
