// Wire shapes returned by auth-service /svc/* endpoints. The auth-service
// contract is canonical (frozen, see docs/auth-service/api-contract.md +
// docs/account-redesign-2026-06-30/); these mirror it 1:1. AuthClient returns
// these verbatim — AccountClient composes them with account-service entitlement
// into the stable AccountResponseDto the scenes/services consume.

// UserResponse — identity source-of-truth. account-service no longer carries
// username / telegram_username / in_chat / is_external; they live here now.
export interface AuthUserResponse {
  id: string;
  email: string | null;
  email_verified: boolean;
  username: string | null;
  telegram_id: number | null;
  telegram_username: string | null;
  role: string;
  status: string;
  in_chat: boolean;
  is_external: boolean;
  created_at: string;
}

// GET /svc/users envelope — offset pagination, page is 1-based.
export interface AuthUserListResponse {
  items: AuthUserResponse[];
  total: number;
}

// POST /svc/telegram/confirm result. flow is "login" for a dashboard-login
// token, "link" for a telegram-link token.
export interface AuthTelegramConfirmResponse {
  success: boolean;
  flow: 'login' | 'link';
}

// POST /svc/users body — telegram-only OR username-only ("external") creation.
export interface AuthCreateUserInput {
  email?: string;
  password?: string;
  telegram_id?: number;
  telegram_username?: string;
  username?: string;
}

// GET /svc/users query filter (mirrors the bot-side AccountListFilter).
export interface AuthUserListFilter {
  external?: boolean;
  hasTelegram?: boolean;
  inChat?: boolean;
  username?: string;
  page?: number;
  limit?: number;
}
