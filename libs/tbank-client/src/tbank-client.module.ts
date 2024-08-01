import { Module } from '@nestjs/common';
import { TBankClient } from './tbank-client.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://securepay.tinkoff.ru/v2',
    }),
  ],
  providers: [TBankClient],
  exports: [TBankClient],
})
export class TBankClientModule {}
