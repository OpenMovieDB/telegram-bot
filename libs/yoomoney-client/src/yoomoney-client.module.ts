import { Module } from '@nestjs/common';
import { YooMoneyClient } from './yoomoney-client.service';

@Module({
  providers: [YooMoneyClient],
  exports: [YooMoneyClient],
})
export class YooMoneyClientModule {}
