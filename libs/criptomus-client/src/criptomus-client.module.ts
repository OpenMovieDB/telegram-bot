import { Module } from '@nestjs/common';
import { CriptomusClient } from './criptomus-client.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://api.cryptomus.com/v1',
    }),
  ],
  providers: [CriptomusClient],
  exports: [CriptomusClient],
})
export class CriptomusClientModule {}
