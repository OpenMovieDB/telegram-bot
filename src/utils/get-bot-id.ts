import { Telegraf } from 'telegraf';

export async function getBotId(botToken: string): Promise<number> {
  try {
    const bot = new Telegraf(botToken);
    const botInfo = await bot.telegram.getMe();
    return botInfo.id;
  } catch (error) {
    console.error('Failed to get bot ID:', error);
    throw error;
  }
}
