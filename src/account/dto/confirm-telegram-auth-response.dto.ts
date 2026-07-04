// Mirror of account-service ConfirmTelegramAuthResponse.
// Source of truth: account/internal/handler/rest/response/auth.go.
// flow is "login" when the bot confirmed a /auth/telegram/init token,
// "link" when it confirmed a /auth/telegram/link token.
export interface ConfirmTelegramAuthResponseDto {
  success: boolean;
  flow: 'login' | 'link';
}
