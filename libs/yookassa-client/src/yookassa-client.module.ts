import { Module } from '@nestjs/common';
import { YookassaClient } from '@app/yookassa-client/yookassa-client.service';

@Module({
  providers: [YookassaClient],
  exports: [YookassaClient],
})
export class YookassaClientModule {}
