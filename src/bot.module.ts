import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { BotService } from './bot.service';
import { BOT_NAME } from './constants/bot-name.const';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotUpdate } from './bot.update';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { GetAccessScene } from './scenes/get-access.scene';
import { HomeScene } from './scenes/home.scene';

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
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    BotService,
    BotUpdate,
    HomeScene,
    GetAccessScene,
  ],
})
export class BotModule {}
