import { Module } from '@nestjs/common';
import { YookassaClientService } from './yookassa-client.service';

@Module({
  providers: [YookassaClientService],
  exports: [YookassaClientService],
})
export class YookassaClientModule {}
