// What the bot's confirm of a dashboard link did (auth POST /svc/telegram/confirm).
// flow is "login" when the bot confirmed a /auth/telegram/init token,
// "link" when it confirmed a /auth/telegram/link token; merged — the link made
// the dashboard account and the account of this Telegram one account.
export interface ConfirmTelegramAuthResponseDto {
  success: boolean;
  flow: 'login' | 'link';
  merged: boolean;
}
