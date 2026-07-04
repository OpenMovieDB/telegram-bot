import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import {
  AccountResponseDto,
  RotateTokenResponseDto,
  AccountEntitlementWire,
  AccountTariffDto,
  TokenWire,
  AccountListDto,
  AccountListFilter,
  AccountByTokenWire,
  AccountUsageDto,
} from './dto/account-response.dto';
import { ConfirmTelegramAuthResponseDto } from './dto/confirm-telegram-auth-response.dto';
import { AuthApiError, AuthClient } from '../auth/auth.client';
import { AuthUserResponse } from '../auth/dto/auth-user-response.dto';

export class TelegramAuthTokenExpiredError extends Error {
  constructor(public readonly token: string) {
    super(`telegram auth token expired or unknown: ${token.slice(0, 8)}…`);
    this.name = 'TelegramAuthTokenExpiredError';
  }
}

// AccountApiError mirrors account-service's `{error, message}` envelope so
// callers branch on the machine-readable code (`username_taken`,
// `telegram_already_linked`, …) instead of HTTP status or message text. Identity
// errors raised by auth-service are re-wrapped into this type at the facade
// boundary so the existing scene contract (which catches AccountApiError) holds.
export class AccountApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = 'AccountApiError';
  }
}

function toAccountError(error: unknown): unknown {
  const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
  const response = axiosErr?.response;
  if (response) {
    const data = response.data ?? {};
    return new AccountApiError(data.error ?? 'account_error', response.status, data.message ?? axiosErr.message);
  }
  return error;
}

function isNotFound(error: unknown): boolean {
  return error instanceof AccountApiError && error.status === 404;
}

// AccountClient is a COMPOSITION FACADE over the v3 service split: identity lives
// in auth-service (AuthClient), entitlement/tokens/usage in account-service
// (this class' own HTTP calls). The public surface and the AccountResponseDto it
// returns are stable for ~15 caller scenes/services — internally each method
// composes a fat DTO from a UserResponse (auth) + an AccountResponse (account).
@Injectable()
export class AccountClient {
  private readonly logger = new Logger(AccountClient.name);
  private readonly serviceToken: string;
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly authClient: AuthClient,
  ) {
    this.serviceToken = this.configService.get<string>('ACCOUNT_SERVICE_TOKEN') ?? '';
    this.baseUrl = this.configService.get<string>('ACCOUNT_SERVICE_URL') ?? '';
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
        lastError = toAccountError(error);
        // 4xx are deterministic (not found / conflict / validation) — retrying
        // only delays the user-facing answer.
        if (lastError instanceof AccountApiError && lastError.status < 500) {
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

  // Resolve-or-create by Telegram id. auth owns identity: look the user up, and
  // register a telegram-only user when absent. account then resolves (and
  // lazy-provisions) the entitlement+token — no polling needed.
  async upsertByTelegramId(
    telegramId: number,
    telegramUsername?: string,
    requestId?: string,
  ): Promise<AccountResponseDto> {
    let user = await this.authClient.getUserByTelegramId(telegramId, requestId);
    if (!user) {
      try {
        user = await this.authClient.createUser(
          { telegram_id: telegramId, telegram_username: telegramUsername ?? undefined },
          requestId,
        );
      } catch (error) {
        // Lost a create race — another request registered this telegram id
        // first. Re-read instead of failing the user's first touch.
        if (error instanceof AuthApiError && error.status === 409) {
          user = await this.authClient.getUserByTelegramId(telegramId, requestId);
        }
        if (!user) throw error;
      }
    }
    const acct = await this.getEntitlement(user.id, requestId);
    return this.compose(user, acct);
  }

  // Resolve a known account by its auth user_id. Reads entitlement (account) and
  // identity (auth) together; if auth no longer knows the user, fall back to the
  // minimal identity account-service still carries.
  async getById(accountId: string, requestId?: string): Promise<AccountResponseDto> {
    const [acct, user] = await Promise.all([
      this.getEntitlement(accountId, requestId),
      // Identity enrichment is best-effort on this read/notify path: account's
      // projected contact fields (telegram_id/email) are the floor, so a
      // transient auth outage degrades to account-only instead of blocking the
      // payment/subscription notification.
      this.authClient.getUserById(accountId, requestId).catch((error) => {
        this.logger.warn(`getById(${accountId}) identity lookup failed: ${(error as Error).message}`);
        return null;
      }),
    ]);
    return user ? this.compose(user, acct) : this.composeAccountOnly(acct);
  }

  // confirmTelegramAuth tells auth-service that the Telegram user just opened
  // `/start <token>` in the bot. auth resolves the pending state (dashboard
  // login or telegram-link) and returns which flow it was. 404/410 are terminal
  // — we throw TelegramAuthTokenExpiredError so the caller shows the right copy
  // instead of retrying. firstName is no longer sent (auth ignores it).
  async confirmTelegramAuth(
    token: string,
    telegramId: number,
    telegramUsername: string,
    firstName: string,
    requestId?: string,
  ): Promise<ConfirmTelegramAuthResponseDto> {
    try {
      const data = await this.authClient.confirmTelegram(token, telegramId, telegramUsername || undefined, requestId);
      return { success: data.success, flow: data.flow };
    } catch (err) {
      if (err instanceof AuthApiError && (err.status === 410 || err.status === 404)) {
        throw new TelegramAuthTokenExpiredError(token);
      }
      throw err;
    }
  }

  // Read-only resolve by Telegram id — never creates a user. Used by moderation
  // ("do we know this user?") and notification paths. The user is already known
  // to auth, so resolving (lazy-provisioning) their entitlement is correct.
  async getByTelegramId(telegramId: number, requestId?: string): Promise<AccountResponseDto | null> {
    const user = await this.authClient.getUserByTelegramId(telegramId, requestId);
    if (!user) return null;
    const acct = await this.getEntitlement(user.id, requestId);
    return this.compose(user, acct);
  }

  async getByUsername(username: string, requestId?: string): Promise<AccountResponseDto | null> {
    const user = await this.authClient.getUserByUsername(username, requestId);
    if (!user) return null;
    const acct = await this.getEntitlement(user.id, requestId);
    return this.compose(user, acct);
  }

  // Resolves the account that owns an API key (accepts both the display API-key
  // form and the raw token UUID). Used by the admin /pay and invoice flows.
  async getByToken(apiKey: string, requestId?: string): Promise<AccountByTokenWire | null> {
    try {
      return await this.withRetry(async () => {
        const { data } = await lastValueFrom(
          this.httpService.get<AccountByTokenWire>(`${this.baseUrl}/svc/accounts/by-token`, {
            headers: { ...this.headers(requestId), 'X-API-Token': apiKey },
            timeout: 5000,
          }),
        );
        return data;
      }, 'getByToken');
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  // Lists users from auth (the identity SoR). Identity-only by default to keep
  // the broadcast / chat-membership sweep free of N+1 account calls; pass
  // filter.withEntitlement to populate per-row tariff/subscription (bounded by
  // the page limit) for screens that display it.
  async listAccounts(filter: AccountListFilter = {}, requestId?: string): Promise<AccountListDto> {
    const { items, total } = await this.authClient.listUsers(filter, requestId);
    if (!filter.withEntitlement) {
      return { items: items.map((user) => this.composeIdentityOnly(user)), total };
    }
    const enriched = await Promise.all(
      items.map(async (user) => this.compose(user, await this.getEntitlement(user.id, requestId))),
    );
    return { items: enriched, total };
  }

  // Creates an "external" account — a client without Telegram whose API key the
  // admin hands over manually. auth mints the username-only user (is_external),
  // account lazy-provisions the token. AuthApiError `username_taken` is
  // re-wrapped so the scene's AccountApiError branch still translates it.
  async createExternal(username: string, requestId?: string): Promise<AccountResponseDto> {
    let user: AuthUserResponse;
    try {
      user = await this.authClient.createUser({ username }, requestId);
    } catch (error) {
      if (error instanceof AuthApiError) {
        throw new AccountApiError(error.code, error.status, error.message);
      }
      throw error;
    }
    const acct = await this.getEntitlement(user.id, requestId);
    return this.compose(user, acct);
  }

  // "I already have a token": resolve the key→owner via account, then bind the
  // Telegram identity to that user in auth. AuthApiError `telegram_already_linked`
  // is re-wrapped so the scene's AccountApiError branch still translates it;
  // `token_not_found` is raised when the key resolves to no account.
  async linkTelegram(
    token: string,
    telegramId: number,
    telegramUsername?: string,
    requestId?: string,
  ): Promise<AccountResponseDto> {
    const owner = await this.getByToken(token, requestId);
    if (!owner) {
      throw new AccountApiError('token_not_found', 404, 'token not found');
    }
    let user: AuthUserResponse;
    try {
      user = await this.authClient.linkTelegram(owner.user_id, telegramId, telegramUsername, requestId);
    } catch (error) {
      if (error instanceof AuthApiError) {
        throw new AccountApiError(error.code, error.status, error.message);
      }
      throw error;
    }
    const acct = await this.getEntitlement(owner.user_id, requestId);
    return this.compose(user, acct);
  }

  // Telegram-profile attributes (support-chat membership, current @username) are
  // bot-domain knowledge but stored on the auth user record.
  async updateTelegramProfile(
    accountId: string,
    patch: { telegramUsername?: string | null; inChat?: boolean },
    requestId?: string,
  ): Promise<void> {
    await this.authClient.patchTelegram(accountId, patch, requestId);
  }

  // Today's spent/limit for an account. account owns the rate-limit counters
  // (store, key shape, debt) — the bot only ever sees this aggregate.
  async getUsage(accountId: string, requestId?: string): Promise<AccountUsageDto> {
    return this.withRetry(async () => {
      const { data } = await lastValueFrom(
        this.httpService.get<AccountUsageDto>(`${this.baseUrl}/svc/accounts/${accountId}/usage`, {
          headers: this.headers(requestId),
          timeout: 5000,
        }),
      );
      return data;
    }, `getUsage(${accountId})`);
  }

  async rotateToken(accountId: string, requestId?: string): Promise<RotateTokenResponseDto> {
    return this.withRetry(async () => {
      const { data } = await lastValueFrom(
        this.httpService.post<TokenWire>(
          `${this.baseUrl}/svc/accounts/${accountId}/token/rotate`,
          {},
          { headers: this.headers(requestId), timeout: 5000 },
        ),
      );
      return { api_key: data.token };
    }, `rotateToken(${accountId})`);
  }

  // GET /svc/accounts/:id — entitlement read (lazy-provisions the account+token
  // when missing). The single account-side dependency of the identity-composed
  // facade methods.
  private async getEntitlement(userId: string, requestId?: string): Promise<AccountEntitlementWire> {
    return this.withRetry(async () => {
      const { data } = await lastValueFrom(
        this.httpService.get<AccountEntitlementWire>(`${this.baseUrl}/svc/accounts/${userId}`, {
          headers: this.headers(requestId),
          timeout: 5000,
        }),
      );
      return data;
    }, `getEntitlement(${userId})`);
  }

  // Identity (auth) + entitlement (account) → the stable fat DTO.
  private compose(user: AuthUserResponse, acct: AccountEntitlementWire): AccountResponseDto {
    return {
      id: user.id,
      api_key: acct.api_key ?? '',
      email: user.email ?? null,
      username: user.username ?? null,
      is_external: user.is_external ?? false,
      in_chat: user.in_chat ?? false,
      telegram_id: user.telegram_id ?? null,
      telegram_username: user.telegram_username ?? null,
      tariff: this.toTariff(acct),
      subscription_end: acct.subscription?.ends_at ?? null,
    };
  }

  // Identity-only row (listAccounts default): entitlement is a zero placeholder.
  private composeIdentityOnly(user: AuthUserResponse): AccountResponseDto {
    return {
      id: user.id,
      api_key: '',
      email: user.email ?? null,
      username: user.username ?? null,
      is_external: user.is_external ?? false,
      in_chat: user.in_chat ?? false,
      telegram_id: user.telegram_id ?? null,
      telegram_username: user.telegram_username ?? null,
      tariff: { id: '', name: '', requests_limit: 0 },
      subscription_end: null,
    };
  }

  // Fallback when auth no longer knows the user — keep the entitlement account
  // still carries, drop the identity fields auth owns.
  private composeAccountOnly(acct: AccountEntitlementWire): AccountResponseDto {
    return {
      id: acct.user_id,
      api_key: acct.api_key ?? '',
      email: acct.email ?? null,
      username: null,
      is_external: false,
      in_chat: false,
      telegram_id: acct.telegram_id ?? null,
      telegram_username: null,
      tariff: this.toTariff(acct),
      subscription_end: acct.subscription?.ends_at ?? null,
    };
  }

  private toTariff(acct: AccountEntitlementWire): AccountTariffDto {
    return acct.tariff
      ? {
          id: acct.tariff.id,
          name: acct.tariff.name,
          display_name: acct.tariff.display_name,
          requests_limit: acct.tariff.requests_limit,
        }
      : { id: '', name: '', requests_limit: 0 };
  }
}
