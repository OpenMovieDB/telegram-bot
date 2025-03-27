import { CryptomusClient } from './cryptomus-client.service';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://api.heleket.com/v1',
    }),
  ],
  providers: [CryptomusClient],
  exports: [CryptomusClient],
})
export class CryptomusClientModule {}
