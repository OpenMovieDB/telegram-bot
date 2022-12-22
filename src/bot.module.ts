import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { BotService } from './bot.service';
import { BOT_NAME } from './constants/bot-name.const';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TelegrafModule.forRootAsync({
      botName: BOT_NAME,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get('BOT_TOKEN'),
        middlewares: [session()],
        include: [BotModule],
      }),
    }),
  ],
  controllers: [],
  providers: [BotService],
})
export class BotModule {}
