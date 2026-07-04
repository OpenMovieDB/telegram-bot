import { Test, TestingModule } from '@nestjs/testing';
import { AccountApiError, AccountClient, TelegramAuthTokenExpiredError } from './account.client';
import { AuthApiError, AuthClient } from '../auth/auth.client';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { AuthUserResponse } from '../auth/dto/auth-user-response.dto';

function makeAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

// auth-service UserResponse (identity).
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

// account-service AccountResponse (entitlement, GET /svc/accounts/:id).
const mockEntitlement = {
  user_id: 'user-123',
  email: null,
  telegram_id: 111,
  api_key: 'APIKEY-XYZ',
  tariff: { id: 'tariff-1', name: 'Free', display_name: 'Free', requests_limit: 100 },
  subscription: { active: false, started_at: null, ends_at: null },
  created_at: '2026-05-01T00:00:00Z',
};

describe('AccountClient (composition facade)', () => {
  let client: AccountClient;
  let httpService: jest.Mocked<HttpService>;
  let authClient: jest.Mocked<AuthClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ACCOUNT_SERVICE_TOKEN') return 'svc-token';
              if (key === 'ACCOUNT_SERVICE_URL') return 'http://account:8080';
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
        },
        {
          provide: AuthClient,
          useValue: {
            getUserByTelegramId: jest.fn(),
            getUserByUsername: jest.fn(),
            getUserById: jest.fn(),
            createUser: jest.fn(),
            listUsers: jest.fn(),
            linkTelegram: jest.fn(),
            patchTelegram: jest.fn(),
            confirmTelegram: jest.fn(),
          },
        },
      ],
    }).compile();

    client = module.get<AccountClient>(AccountClient);
    httpService = module.get(HttpService);
    authClient = module.get(AuthClient);
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('upsertByTelegramId', () => {
    it('resolves an existing auth user and composes the entitlement', async () => {
      authClient.getUserByTelegramId.mockResolvedValue(mockUser);
      (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse(mockEntitlement)));

      const result = await client.upsertByTelegramId(111, 'testuser', 'req-1');

      expect(authClient.getUserByTelegramId).toHaveBeenCalledWith(111, 'req-1');
      expect(authClient.createUser).not.toHaveBeenCalled();
      expect(httpService.get).toHaveBeenCalledWith(
        'http://account:8080/svc/accounts/user-123',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Service-Token': 'svc-token', 'X-Request-ID': 'req-1' }),
          timeout: 5000,
        }),
      );
      expect(result.id).toBe('user-123');
      expect(result.api_key).toBe('APIKEY-XYZ');
      expect(result.telegram_username).toBe('testuser');
      expect(result.tariff.requests_limit).toBe(100);
    });

    it('creates the auth user when telegram is unknown, then composes', async () => {
      authClient.getUserByTelegramId.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue(mockUser);
      (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse(mockEntitlement)));

      const result = await client.upsertByTelegramId(111, 'testuser');

      expect(authClient.createUser).toHaveBeenCalledWith(
        { telegram_id: 111, telegram_username: 'testuser' },
        undefined,
      );
      expect(result.api_key).toBe('APIKEY-XYZ');
    });

    it('re-reads on a 409 create race instead of failing', async () => {
      authClient.getUserByTelegramId.mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser);
      authClient.createUser.mockRejectedValue(new AuthApiError('telegram_already_linked', 409, 'race'));
      (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse(mockEntitlement)));

      const result = await client.upsertByTelegramId(111, 'testuser');

      expect(authClient.getUserByTelegramId).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('user-123');
    });
  });

  describe('getById', () => {
    it('composes identity (auth) + entitlement (account)', async () => {
      authClient.getUserById.mockResolvedValue(mockUser);
      (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse(mockEntitlement)));

      const result = await client.getById('user-123', 'req-3');

      expect(httpService.get).toHaveBeenCalledWith(
        'http://account:8080/svc/accounts/user-123',
        expect.objectContaining({ headers: expect.objectContaining({ 'X-Request-ID': 'req-3' }) }),
      );
      expect(result.tariff.requests_limit).toBe(100);
      expect(result.telegram_username).toBe('testuser');
    });

    it('falls back to account-only identity when auth 404s', async () => {
      authClient.getUserById.mockResolvedValue(null);
      (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse(mockEntitlement)));

      const result = await client.getById('user-123');

      expect(result.id).toBe('user-123');
      expect(result.api_key).toBe('APIKEY-XYZ');
      expect(result.username).toBeNull();
      expect(result.tariff.id).toBe('tariff-1');
    });
  });

  describe('getByTelegramId', () => {
    it('returns null when auth does not know the telegram id', async () => {
      authClient.getUserByTelegramId.mockResolvedValue(null);

      const result = await client.getByTelegramId(999);

      expect(result).toBeNull();
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });

  describe('confirmTelegramAuth', () => {
    const VALID_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('delegates to auth /svc/telegram/confirm and returns the flow', async () => {
      authClient.confirmTelegram.mockResolvedValue({ success: true, flow: 'login' });

      const result = await client.confirmTelegramAuth(VALID_TOKEN, 12345, 'vasya', 'Vasya', 'req-tg');

      expect(authClient.confirmTelegram).toHaveBeenCalledWith(VALID_TOKEN, 12345, 'vasya', 'req-tg');
      expect(result).toEqual({ success: true, flow: 'login' });
    });

    it('maps a 410 to TelegramAuthTokenExpiredError', async () => {
      authClient.confirmTelegram.mockRejectedValue(new AuthApiError('telegram_auth_expired', 410, 'gone'));

      await expect(client.confirmTelegramAuth(VALID_TOKEN, 12345, '', '')).rejects.toBeInstanceOf(
        TelegramAuthTokenExpiredError,
      );
    });

    it('maps a 404 to TelegramAuthTokenExpiredError too', async () => {
      authClient.confirmTelegram.mockRejectedValue(new AuthApiError('not_found', 404, 'unknown'));

      await expect(client.confirmTelegramAuth(VALID_TOKEN, 12345, '', '')).rejects.toBeInstanceOf(
        TelegramAuthTokenExpiredError,
      );
    });
  });

  describe('linkTelegram', () => {
    it('resolves the owner by token, links in auth, composes', async () => {
      (httpService.get as jest.Mock).mockImplementation((url: string) => {
        if (url.endsWith('/svc/accounts/by-token')) {
          return of(makeAxiosResponse({ user_id: 'user-123', token: 'APIKEY-XYZ', api_key: 'APIKEY-XYZ' }));
        }
        return of(makeAxiosResponse(mockEntitlement));
      });
      authClient.linkTelegram.mockResolvedValue(mockUser);

      const result = await client.linkTelegram('APIKEY-XYZ', 111, 'testuser');

      expect(authClient.linkTelegram).toHaveBeenCalledWith('user-123', 111, 'testuser', undefined);
      expect(result.id).toBe('user-123');
    });

    it('re-wraps auth telegram_already_linked as AccountApiError for the scene', async () => {
      (httpService.get as jest.Mock).mockReturnValue(
        of(makeAxiosResponse({ user_id: 'user-123', token: 'APIKEY-XYZ', api_key: 'APIKEY-XYZ' })),
      );
      authClient.linkTelegram.mockRejectedValue(new AuthApiError('telegram_already_linked', 409, 'taken'));

      await expect(client.linkTelegram('APIKEY-XYZ', 111)).rejects.toMatchObject({
        name: 'AccountApiError',
        code: 'telegram_already_linked',
      });
    });
  });

  describe('createExternal', () => {
    it('re-wraps auth username_taken as AccountApiError', async () => {
      authClient.createUser.mockRejectedValue(new AuthApiError('username_taken', 409, 'taken'));

      await expect(client.createExternal('john')).rejects.toBeInstanceOf(AccountApiError);
    });
  });

  describe('listAccounts', () => {
    it('returns identity-only rows by default (no per-row account hop)', async () => {
      authClient.listUsers.mockResolvedValue({ items: [mockUser], total: 1 });

      const result = await client.listAccounts({ hasTelegram: true });

      expect(httpService.get).not.toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.items[0].tariff).toEqual({ id: '', name: '', requests_limit: 0 });
      expect(result.items[0].telegram_username).toBe('testuser');
    });

    it('enriches per-row entitlement when withEntitlement is set', async () => {
      authClient.listUsers.mockResolvedValue({ items: [mockUser], total: 1 });
      (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse(mockEntitlement)));

      const result = await client.listAccounts({ external: true, withEntitlement: true });

      expect(httpService.get).toHaveBeenCalledWith('http://account:8080/svc/accounts/user-123', expect.anything());
      expect(result.items[0].tariff.requests_limit).toBe(100);
    });
  });

  describe('updateTelegramProfile', () => {
    it('delegates to auth patchTelegram', async () => {
      authClient.patchTelegram.mockResolvedValue(mockUser);

      await client.updateTelegramProfile('user-123', { inChat: true }, 'req-p');

      expect(authClient.patchTelegram).toHaveBeenCalledWith('user-123', { inChat: true }, 'req-p');
    });
  });

  describe('rotateToken', () => {
    it('calls POST /svc/accounts/{id}/token/rotate and returns new api_key', async () => {
      const rotateResponse = {
        token: 'NEW-APIKEY-ABC',
        uuid: '00000000-0000-0000-0000-000000000002',
        masked_token: 'NEW-****',
        created_at: '2026-05-01T00:00:00Z',
        status: 'active',
      };
      (httpService.post as jest.Mock).mockReturnValue(of(makeAxiosResponse(rotateResponse)));

      const result = await client.rotateToken('user-123', 'req-4');

      expect(httpService.post).toHaveBeenCalledWith(
        'http://account:8080/svc/accounts/user-123/token/rotate',
        {},
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Service-Token': 'svc-token' }),
          timeout: 5000,
        }),
      );
      expect(result.api_key).toBe('NEW-APIKEY-ABC');
    });
  });

  describe('getUsage', () => {
    it('calls GET /svc/accounts/{id}/usage and returns used/limit', async () => {
      (httpService.get as jest.Mock).mockReturnValue(of(makeAxiosResponse({ used: 7, limit: 100 })));

      const result = await client.getUsage('user-123');

      expect(httpService.get).toHaveBeenCalledWith(
        'http://account:8080/svc/accounts/user-123/usage',
        expect.anything(),
      );
      expect(result).toEqual({ used: 7, limit: 100 });
    });
  });
});
