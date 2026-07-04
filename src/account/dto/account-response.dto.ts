// Wire shapes returned by account-service /svc/* endpoints. Do NOT consume these
// directly in scenes/services — AccountClient normalizes them into the flat,
// stable shapes below. The account-service contract is canonical (frozen, see
// docs/account-redesign-2026-06-30/); these mirror it 1:1. Identity attributes
// (username, telegram_username, in_chat, is_external) live in auth-service now —
// AccountClient composes them in from AuthClient.

export interface AccountTariffDto {
  id: string;
  name: string;
  display_name?: string;
  requests_limit: number;
}

export interface AccountSubscriptionWire {
  active: boolean;
  started_at?: string | null;
  ends_at?: string | null;
}

// AccountResponse — GET /svc/accounts/:id. Entitlement only (tariff +
// subscription + api_key). Lazy-provisions the account+token when missing, so a
// freshly auth-created user resolves immediately (no polling).
export interface AccountEntitlementWire {
  user_id: string;
  email?: string | null;
  telegram_id?: number | null;
  tariff?: AccountTariffDto;
  subscription?: AccountSubscriptionWire;
  api_key?: string;
  created_at?: string;
}

// GET /svc/accounts/by-token response (flat, token-centric).
export interface AccountByTokenWire {
  user_id: string;
  token: string;
  api_key: string;
  tariff_id: string;
  tariff_name?: string;
  requests_limit?: number;
  is_subscribed: boolean;
  subscription_end?: string | null;
  status: string;
}

// TokenResponse — the rotate result. The API key lives in `token` (not
// `api_key`).
export interface TokenWire {
  token: string;
  uuid: string;
  masked_token: string;
  created_at: string;
  status: string;
}

// ---- Normalized, client-facing shapes (stable for scenes/services) ----

export interface AccountResponseDto {
  id: string;
  api_key: string;
  email?: string | null;
  username?: string | null;
  is_external?: boolean;
  in_chat?: boolean;
  telegram_id?: number | null;
  telegram_username?: string | null;
  tariff: AccountTariffDto;
  subscription_end?: string | null;
}

export interface AccountListDto {
  items: AccountResponseDto[];
  total: number;
}

export interface AccountListFilter {
  external?: boolean;
  hasTelegram?: boolean;
  inChat?: boolean;
  username?: string;
  page?: number;
  limit?: number;
  // When true, listAccounts fetches per-row entitlement (tariff + subscription)
  // from account-service, bounded by the page limit. Off by default so the
  // broadcast / chat-membership sweep stays identity-only (no N+1 account hop).
  withEntitlement?: boolean;
}

export interface RotateTokenResponseDto {
  api_key: string;
}

export interface AccountUsageDto {
  used: number;
  limit: number;
}
