import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}