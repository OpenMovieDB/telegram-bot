import { ConfigModule, ConfigService } from '@nestjs/config';

import { APP_FILTER } from '@nestjs/core';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { BOT_NAME } from './constants/bot-name.const';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { ChangeTokenScene } from './scenes/change-token.scene';
import { DeveloperTariffScene } from './scenes/developer-tariff.scene';
import { FreeTariffScene } from './scenes/free-tariff.scene';
import { GetAccessScene } from './scenes/get-access.scene';
import { GetMyTokenScene } from './scenes/get-my-token.scene';
import { GetRequestStatsScene } from './scenes/get-request-stats.scene';
import { HomeScene } from './scenes/home.scene';
import { IHaveTokenScene } from './scenes/i-have-token.scene';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentModule } from './payment/payment.module';
import { PaymentScene } from './scenes/payment.scene';
import { QuestionScene } from './scenes/question.scene';
import { ScheduleModule } from '@nestjs/schedule';
import { SetImdbRelationScene } from './scenes/set-imdb-relation.scene';
import { StartScene } from './scenes/start.scene';
import { StudentTariffScene } from './scenes/student-tariff.scene';
import { TariffModule } from './tariff/tariff.module';
import { TelegrafModule } from 'nestjs-telegraf';
import { UnlimitedTariffScene } from './scenes/unlimited-tariff.scene';
import { UpdateClientModule } from '@app/update-client';
import { UpdateMovieScene } from './scenes/update-movie.scene';
import { UpdateTariffScene } from './scenes/update-tariff.scene';
import { UserModule } from './user/user.module';
import { session } from 'telegraf';
import { commandArgs } from './middlewares/command-args.middleware';
import { SelectMonthsScene } from './scenes/select-months.scene';

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
        middlewares: [session(), commandArgs()],
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
    ScheduleModule.forRoot(),
    UserModule,
    UpdateClientModule,
    PaymentModule,
    TariffModule,
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
    UpdateMovieScene,
    SetImdbRelationScene,
    UpdateTariffScene,
    PaymentScene,
    DeveloperTariffScene,
    StudentTariffScene,
    SelectMonthsScene,
  ],
  exports: [BotService],
})
export class BotModule {}
