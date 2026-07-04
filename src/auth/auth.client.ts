import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import {
  AuthCreateUserInput,
  AuthTelegramConfirmResponse,
  AuthUserListFilter,
  AuthUserListResponse,
  AuthUserResponse,
} from './dto/auth-user-response.dto';

// AuthApiError mirrors auth-service's `{error, message}` envelope so the
// AccountClient facade can branch on the machine-readable code
// (`telegram_already_linked`, `username_taken`, …) instead of HTTP status or
// message text.
export class AuthApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = 'AuthApiError';
  }
}

function toAuthError(error: unknown): unknown {
  const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
  const response = axiosErr?.response;
  if (response) {
    const data = response.data ?? {};
    return new AuthApiError(data.error ?? 'auth_error', response.status, data.message ?? axiosErr.message);
  }
  return error;
}

function isNotFound(error: unknown): boolean {
  return error instanceof AuthApiError && error.status === 404;
}

// Low-level client for auth-service identity endpoints (/svc/*). The bot never
// injects this directly — AccountClient is the single facade. It composes these
// identity reads/writes with account-service entitlement.
@Injectable()
export class AuthClient {
  private readonly logger = new Logger(AuthClient.name);
  private readonly serviceToken: string;
  private readonly baseUrl: string;

  constructor(private readonly httpService: HttpService, private readonly configService: ConfigService) {
    this.serviceToken = this.configService.get<string>('AUTH_SERVICE_TOKEN') ?? '';
    this.baseUrl = this.configService.get<string>('AUTH_SERVICE_URL') ?? '';
  }

  private headers(requestId?: string): Record<string, string> {
    return {
      'X-Service-Token': this.serviceToken,
      'X-Request-ID': requestId ?? randomUUID(),
      'Content-Type': 'application/json',
    };
  }

  private async withRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = toAuthError(error);
        // 4xx are deterministic (not found / conflict / validation) — retrying
        // only delays the user-facing answer.
        if (lastError instanceof AuthApiError && lastError.status < 500) {
          throw lastError;
        }
        this.logger.warn(`${context} attempt ${attempt}/${maxAttempts} failed: ${(lastError as Error).message}`);

        if (attempt < maxAttempts) {
          const delay = Math.min(attempt * 1000, 2000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // POST /svc/users — telegram-only OR username-only ("external") creation.
  // Surfaces AuthApiError (`username_taken`, or 409 on a telegram race).
  async createUser(input: AuthCreateUserInput, requestId?: string): Promise<AuthUserResponse> {
    return this.withRetry(async () => {
      const { data } = await lastValueFrom(
        this.httpService.post<AuthUserResponse>(`${this.baseUrl}/svc/users`, input, {
          headers: this.headers(requestId),
          timeout: 5000,
        }),
      );
      return data;
    }, 'createUser');
  }

  async getUserById(userId: string, requestId?: string): Promise<AuthUserResponse | null> {
    try {
      return await this.withRetry(async () => {
        const { data } = await lastValueFrom(
          this.httpService.get<AuthUserResponse>(`${this.baseUrl}/svc/users/${userId}`, {
            headers: this.headers(requestId),
            timeout: 5000,
          }),
        );
        return data;
      }, `getUserById(${userId})`);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getUserByTelegramId(telegramId: number, requestId?: string): Promise<AuthUserResponse | null> {
    try {
      return await this.withRetry(async () => {
        const { data } = await lastValueFrom(
          this.httpService.get<AuthUserResponse>(`${this.baseUrl}/svc/users/by-telegram/${telegramId}`, {
            headers: this.headers(requestId),
            timeout: 5000,
          }),
        );
        return data;
      }, `getUserByTelegramId(${telegramId})`);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getUserByUsername(username: string, requestId?: string): Promise<AuthUserResponse | null> {
    try {
      return await this.withRetry(async () => {
        const { data } = await lastValueFrom(
          this.httpService.get<AuthUserResponse>(
            `${this.baseUrl}/svc/users/by-username/${encodeURIComponent(username)}`,
            { headers: this.headers(requestId), timeout: 5000 },
          ),
        );
        return data;
      }, `getUserByUsername(${username})`);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async listUsers(filter: AuthUserListFilter = {}, requestId?: string): Promise<AuthUserListResponse> {
    return this.withRetry(async () => {
      const params: Record<string, string | number | boolean> = {};
      if (filter.external !== undefined) params.external = filter.external;
      if (filter.hasTelegram !== undefined) params.has_telegram = filter.hasTelegram;
      if (filter.inChat !== undefined) params.in_chat = filter.inChat;
      if (filter.username) params.username = filter.username;
      if (filter.page) params.page = filter.page;
      if (filter.limit) params.limit = filter.limit;

      const { data } = await lastValueFrom(
        this.httpService.get<AuthUserListResponse>(`${this.baseUrl}/svc/users`, {
          headers: this.headers(requestId),
          params,
          timeout: 8000,
        }),
      );
      return data;
    }, 'listUsers');
  }

  // POST /svc/users/{id}/link-telegram — binds a telegram identity to an
  // existing user. Surfaces AuthApiError `telegram_already_linked` on 409.
  async linkTelegram(
    userId: string,
    telegramId: number,
    telegramUsername?: string,
    requestId?: string,
  ): Promise<AuthUserResponse> {
    return this.withRetry(async () => {
      const { data } = await lastValueFrom(
        this.httpService.post<AuthUserResponse>(
          `${this.baseUrl}/svc/users/${userId}/link-telegram`,
          { telegram_id: telegramId, telegram_username: telegramUsername ?? null },
          { headers: this.headers(requestId), timeout: 5000 },
        ),
      );
      return data;
    }, `linkTelegram(${userId})`);
  }

  // PATCH /svc/users/{id}/telegram — telegram-profile attributes owned by the
  // bot's domain knowledge (support-chat membership, current @username).
  async patchTelegram(
    userId: string,
    patch: { telegramUsername?: string | null; inChat?: boolean },
    requestId?: string,
  ): Promise<AuthUserResponse> {
    return this.withRetry(async () => {
      const body: Record<string, unknown> = {};
      if (patch.telegramUsername !== undefined) body.telegram_username = patch.telegramUsername;
      if (patch.inChat !== undefined) body.in_chat = patch.inChat;
      const { data } = await lastValueFrom(
        this.httpService.patch<AuthUserResponse>(`${this.baseUrl}/svc/users/${userId}/telegram`, body, {
          headers: this.headers(requestId),
          timeout: 5000,
        }),
      );
      return data;
    }, `patchTelegram(${userId})`);
  }

  // POST /svc/telegram/confirm — the Telegram user opened `/start <token>`.
  // 404/410 (unknown/expired token) surface as AuthApiError; the facade maps
  // them to TelegramAuthTokenExpiredError.
  async confirmTelegram(
    token: string,
    telegramId: number,
    telegramUsername?: string,
    requestId?: string,
  ): Promise<AuthTelegramConfirmResponse> {
    return this.withRetry(async () => {
      const { data } = await lastValueFrom(
        this.httpService.post<AuthTelegramConfirmResponse>(
          `${this.baseUrl}/svc/telegram/confirm`,
          { token, telegram_id: telegramId, telegram_username: telegramUsername ?? null },
          { headers: this.headers(requestId), timeout: 5000 },
        ),
      );
      return data;
    }, `confirmTelegram(${telegramId})`);
  }
}
