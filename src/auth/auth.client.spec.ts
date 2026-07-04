import { Test, TestingModule } from '@nestjs/testing';
import { AuthApiError, AuthClient } from './auth.client';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { AuthUserResponse } from './dto/auth-user-response.dto';

function makeAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

function makeAxiosError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('http error', String(status), undefined, undefined, {
    status,
    statusText: 'ERR',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

const mockUser: AuthUserResponse = {
  id: 'user-123',
  email: null,
  email_verified: false,
  username: null,
  telegram_id: 111,
  telegram_username: 'testuser',
  role: 'user',
  status: 'active',
  in_chat: false,
  is_external: false,
  created_at: '2026-05-01T00:00:00Z',
};

describe('AuthClient', () => {
  let client: AuthClient;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'AUTH_SERVICE_TOKEN') return 'auth-svc-token';
              if (key === 'AUTH_SERVICE_URL') return 'http://auth:8080';
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
        },
      ],
    }).compile();

    client = module.get<AuthClient>(AuthClient);
    httpService = module.get(HttpService);
  });

  it('createUser POSTs /svc/users with service headers', async () => {
    (httpService.post as jest.Mock).mockReturnValue(of(makeAxiosResponse(mockUser)));

    const result = await client.createUser({ telegram_id: 111, telegram_username: 'testuser' }, 'req-1');

    expect(httpService.post).toHaveBeenCalledWith(
      'http://auth:8080/svc/users',
      { telegram_id: 111, telegram_username: 'testuser' },
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Service-Token': 'auth-svc-token', 'X-Request-ID': 'req-1' }),
        timeout: 5000,
      }),
    );
    expect(result.id).toBe('user-123');
  });

  it('getUserByTelegramId returns null on 404', async () => {
    (httpService.get as jest.Mock).mockReturnValue(throwError(() => makeAxiosError(404)));

    const result = await client.getUserByTelegramId(999);

    expect(result).toBeNull();
  });

  it('getUserByTelegramId returns the user on 200', async () => {
    (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse(mockUser)));

    const result = await client.getUserByTelegramId(111);

    expect(httpService.get).toHaveBeenCalledWith(
      'http://auth:8080/svc/users/by-telegram/111',
      expect.objectContaining({ timeout: 5000 }),
    );
    expect(result?.telegram_username).toBe('testuser');
  });

  it('listUsers maps the bot filter to snake_case query params', async () => {
    (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse({ items: [mockUser], total: 1 })));

    const result = await client.listUsers({ hasTelegram: true, inChat: false, external: true, page: 2, limit: 5 });

    expect(httpService.get).toHaveBeenCalledWith(
      'http://auth:8080/svc/users',
      expect.objectContaining({
        params: { has_telegram: true, in_chat: false, external: true, page: 2, limit: 5 },
        timeout: 8000,
      }),
    );
    expect(result.total).toBe(1);
  });

  it('linkTelegram surfaces AuthApiError telegram_already_linked on 409 (no retry)', async () => {
    (httpService.post as jest.Mock).mockReturnValue(
      throwError(() => makeAxiosError(409, { error: 'telegram_already_linked', message: 'taken' })),
    );

    await expect(client.linkTelegram('user-123', 111)).rejects.toMatchObject({
      name: 'AuthApiError',
      code: 'telegram_already_linked',
      status: 409,
    });
    expect(httpService.post).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx up to 3 times', async () => {
    (httpService.post as jest.Mock).mockReturnValue(throwError(() => makeAxiosError(500, {})));

    await expect(client.createUser({ username: 'john' })).rejects.toBeInstanceOf(AuthApiError);
    expect(httpService.post).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry 4xx', async () => {
    (httpService.post as jest.Mock).mockReturnValue(throwError(() => makeAxiosError(409, { error: 'username_taken' })));

    await expect(client.createUser({ username: 'john' })).rejects.toBeInstanceOf(AuthApiError);
    expect(httpService.post).toHaveBeenCalledTimes(1);
  });

  it('confirmTelegram POSTs token + telegram identity', async () => {
    (httpService.post as jest.Mock).mockReturnValue(of(makeAxiosResponse({ success: true, flow: 'link' })));

    const result = await client.confirmTelegram('tok', 111, 'testuser', 'req-c');

    expect(httpService.post).toHaveBeenCalledWith(
      'http://auth:8080/svc/telegram/confirm',
      { token: 'tok', telegram_id: 111, telegram_username: 'testuser' },
      expect.objectContaining({ timeout: 5000 }),
    );
    expect(result.flow).toBe('link');
  });
});
