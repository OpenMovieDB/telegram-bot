import { Controller, Get } from '@nestjs/common';

@Controller('')
export class BotController {
  @Get()
  ping() {
    return { data: 'pong' };
  }
}
