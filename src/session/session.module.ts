import { Module } from '@nestjs/common';
import { SessionStateService } from './session-state.service';

@Module({
  providers: [SessionStateService],
  exports: [SessionStateService],
})
export class SessionModule {}