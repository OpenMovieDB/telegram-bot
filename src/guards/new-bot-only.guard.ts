import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getBotId } from '../utils/get-bot-id';

@Injectable()
export class NewBotOnlyGuard implements CanActivate {
  private static botId: number | null = null;
  private static readonly NEW_BOT_ID = 8252040138;

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Получаем bot ID один раз при первом вызове
    if (NewBotOnlyGuard.botId === null) {
      const botToken = this.configService.get('BOT_TOKEN');
      NewBotOnlyGuard.botId = await getBotId(botToken);
    }

    // Разрешаем выполнение только для нового бота
    return NewBotOnlyGuard.botId === NewBotOnlyGuard.NEW_BOT_ID;
  }
}
