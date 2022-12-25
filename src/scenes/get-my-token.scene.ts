import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';
import { UserService } from '../user/user.service';

@Scene(CommandEnum.GET_MY_TOKEN)
export class GetMyTokenScene extends AbstractScene {
  constructor(private readonly userService: UserService) {
    super();
  }
  @SceneEnter()
  async enterScene(ctx) {
    const scene = SCENES[ctx.scene.session.current];

    const existUser = await this.userService.findOneByUserId(ctx.from.id);
    if (existUser) {
      const token = await this.userService.getUserToken(ctx.from.id);
      await ctx.replyWithHTML(scene.success(token).text);
    } else {
      await ctx.replyWithHTML(
        scene.error().text,
        Markup.inlineKeyboard(scene.error().buttons),
      );
    }
  }
}
