import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { AccountModule } from '../account/account.module';

@Module({
  imports: [AccountModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
