import { Body, Controller, Get, Post } from '@nestjs/common';
import { BotService } from './bot.service';

@Controller('')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Get()
  ping() {
    return { data: 'pong' };
  }

  @Post('/send_message')
  sendMessageToUsers(@Body() request: { message: string }) {
    return this.botService.sendTextMessageToAllUsers(request.message);
  }
}
