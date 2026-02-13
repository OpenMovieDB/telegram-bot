import { ConfigModule, ConfigService } from '@nestjs/config';

import { APP_FILTER } from '@nestjs/core';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { BOT_NAME } from './constants/bot-name.const';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { BotConfigService } from './bot-config.service';
import { DeveloperTariffScene } from './scenes/developer-tariff.scene';
import { FreeTariffScene } from './scenes/free-tariff.scene';
import { DemoTariffScene } from './scenes/demo-tariff.scene';
import { BasicTariffScene } from './scenes/basic-tariff.scene';
import { NolimitTariffScene } from './scenes/nolimit-tariff.scene';
import { GetAccessScene } from './scenes/get-access.scene';
import { GetMyTokenScene } from './scenes/get-my-token.scene';
import { GetRequestStatsScene } from './scenes/get-request-stats.scene';
import { HomeScene } from './scenes/home.scene';
import { ChangeTokenScene } from './scenes/change-token.scene';
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
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { CacheModule } from './cache/cache.module';
import { ModerationModule } from './moderation/moderation.module';
import { SessionModule } from './session/session.module';
import { AdminMenuScene } from './scenes/admin-menu.scene';
import { CreateUserScene } from './scenes/create-user.scene';
import { CreateInvoiceScene } from './scenes/create-invoice.scene';
import { ListUsersScene } from './scenes/list-users.scene';
import { ExpiringSubscriptionsScene } from './scenes/expiring-subscriptions.scene';
import { UserDetailsScene } from './scenes/user-details.scene';
import { UpdateUserSubscriptionScene } from './scenes/update-user-subscription.scene';
import { rebrandBlocker } from './middlewares/rebrand-blocker.middleware';

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
        middlewares: [rebrandBlocker(), session(), commandArgs()],
        include: [BotModule],
        launchOptions: false,
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
    CacheModule,
    SessionModule,
    ModerationModule,
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        config: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
    }),
  ],
  controllers: [BotController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    BotService,
    BotConfigService,
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
    AdminMenuScene,
    CreateUserScene,
    CreateInvoiceScene,
    ListUsersScene,
    ExpiringSubscriptionsScene,
    UserDetailsScene,
    UpdateUserSubscriptionScene,
    DemoTariffScene,
    BasicTariffScene,
    NolimitTariffScene,
  ],
  exports: [BotService],
})
export class BotModule {}
