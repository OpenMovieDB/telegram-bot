import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AccountClient } from './account.client';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [AccountClient],
  exports: [AccountClient],
})
export class AccountModule {}
