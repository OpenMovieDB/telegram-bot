import { Module } from '@nestjs/common';
import { CacheResetService } from './cache-reset.service';
import { UserModule } from '../user/user.module';
import { TariffModule } from '../tariff/tariff.module';

@Module({
  imports: [UserModule, TariffModule],
  providers: [CacheResetService],
  exports: [CacheResetService],
})
export class CacheModule {}
