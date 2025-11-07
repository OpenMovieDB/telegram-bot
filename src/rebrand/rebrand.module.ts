import { Module } from '@nestjs/common';
import { RebrandUpdate } from './rebrand.update';

@Module({
  providers: [RebrandUpdate],
})
export class RebrandModule {}
