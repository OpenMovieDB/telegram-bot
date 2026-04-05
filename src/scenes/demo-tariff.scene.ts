import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { UserService } from '../user/user.service';
import { TariffService } from '../tariff/tariff.service';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';
import { Context } from '../interfaces/context.interface';

@Scene(CommandEnum.DEMO_TARIFF)
export class DemoTariffScene extends AbstractScene {
  constructor(private readonly userService: UserService, private readonly tariffService: TariffService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const scene = SCENES[CommandEnum.DEMO_TARIFF];
    try {
      const freeTariff = await this.tariffService.getFreeTariff();

      let token = await this.userService.getUserToken(ctx.from.id);
      if (!token) {
        const existingUser = await this.userService.findOneByUserId(ctx.from.id);
        if (existingUser) {
          token = existingUser.token;
        } else {
          await this.userService.create({
            userId: ctx.from.id,
            chatId: ctx.chat.id,
            username: ctx.from.username,
            tariffId: freeTariff?._id,
          } as any);
          token = await this.userService.getUserToken(ctx.from.id);
        }
      }

      await ctx.replyWithHTML(scene.text(token), Markup.keyboard(scene.navigateButtons).resize());
    } catch (e) {
      this.logger.error('DemoTariffScene.onSceneEnter', e);
      await ctx.replyWithHTML(
        'Произошла ошибка при получении токена. Попробуйте позже.',
        Markup.keyboard(scene.navigateButtons).resize(),
      );
    }
  }
}
