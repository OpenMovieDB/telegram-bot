import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthClient } from './auth.client';

@Module({
  imports: [HttpModule],
  providers: [AuthClient],
  exports: [AuthClient],
})
export class AuthModule {}
