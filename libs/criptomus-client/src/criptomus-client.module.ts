import { Module } from '@nestjs/common';
import { CriptomusClientService } from './criptomus-client.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://api.cryptomus.com/v1',
    }),
  ],
  providers: [CriptomusClientService],
  exports: [CriptomusClientService],
})
export class CriptomusClientModule {}
