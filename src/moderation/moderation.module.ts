import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { UserModule } from '../user/user.module';
import { TariffModule } from '../tariff/tariff.module';

@Module({
  imports: [UserModule, TariffModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
