import { Module } from '@nestjs/common';
import { WalletClient } from './wallet-client.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://pay.wallet.tg/wpay/store-api/v1',
    }),
  ],
  providers: [WalletClient],
  exports: [WalletClient],
})
export class WalletClientModule {}
