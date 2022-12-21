import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import * as process from 'process';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      botName: process.env.BOT_NAME,
      useFactory: () => ({
        token: process.env.BOT_TOKEN,
        middlewares: [session()],
        include: [AppModule],
      }),
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
