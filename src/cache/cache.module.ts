import { Module } from '@nestjs/common';
import { CacheResetService } from './cache-reset.service';

@Module({
  providers: [CacheResetService],
  exports: [CacheResetService],
})
export class CacheModule {}
