import { Action, Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Logger } from '@nestjs/common';
import { BotService } from '../bot.service';

@Scene(CommandEnum.GET_ACCESS)
export class GetAccessScene {
  private readonly logger = new Logger(GetAccessScene.name);
  constructor(private readonly botService: BotService) {}
  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log('onSceneEnter');
    await this.botService.baseSceneMessage(ctx);
  }

  @Action(CommandEnum.BACK)
  async onBackAction(@Ctx() ctx: Context) {
    this.logger.log('onBackAction');
  }
}
