import { Logger } from '@nestjs/common';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { TariffService } from '../tariff/tariff.service';
import { UserService } from '../user/user.service';

@Scene(CommandEnum.START)
export class StartScene extends AbstractScene {
  public logger = new Logger(StartScene.name);

  constructor(private readonly tariffService: TariffService, private readonly userService: UserService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const freeTariff = await this.tariffService.getFreeTariff();
    await this.userService.create({
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      username: ctx.from.username,
      tariffId: freeTariff?._id,
    } as any);
    const token = await this.userService.getUserToken(ctx.from.id);

    const scene = SCENES[CommandEnum.START];
    await ctx.replyWithHTML(scene.text(token), Markup.inlineKeyboard(scene.buttons));
  }
}
