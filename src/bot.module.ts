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
import { StartScene } from './scenes/start.scene';
import { UserModule } from './user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { FreeTariffScene } from './scenes/free-tariff.scene';
import { DeveloperTariffScene } from './scenes/developer-tariff.scene';
import { UnlimitedTariffScene } from './scenes/unlimited-tariff.scene';
import { QuestionScene } from './scenes/question.scene';
import { GetRequestStatsScene } from './scenes/get-request-stats.scene';
import { IHaveTokenScene } from './scenes/i-have-token.scene';
import { GetMyTokenScene } from './scenes/get-my-token.scene';
import { ChangeTokenScene } from './scenes/change-token.scene';
import { BotController } from './bot.controller';

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
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('MONGO_URI'),
      }),
    }),
    UserModule,
  ],
  controllers: [BotController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    BotService,
    BotUpdate,
    StartScene,
    HomeScene,
    GetAccessScene,
    FreeTariffScene,
    DeveloperTariffScene,
    UnlimitedTariffScene,
    QuestionScene,
    GetRequestStatsScene,
    IHaveTokenScene,
    GetMyTokenScene,
    ChangeTokenScene,
  ],
})
export class BotModule {}
