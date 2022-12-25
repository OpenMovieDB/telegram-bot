import { Ctx, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Context } from '../interfaces/context.interface';
import { SCENES } from '../constants/scenes.const';
import { UserService } from '../user/user.service';

@Scene(CommandEnum.I_HAVE_TOKEN)
export class IHaveTokenScene extends AbstractScene {
  constructor(private readonly userService: UserService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const existUser = await this.userService.findOneByUserId(ctx.from.id);
    if (existUser) {
      await ctx.scene.enter(CommandEnum.HOME);
      return;
    }
    const scene = SCENES[ctx.scene.session.current];
    await ctx.replyWithHTML(scene.text);
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    if ('text' in ctx.message) {
      const token = ctx.message.text;
      const scene = SCENES[ctx.scene.session.current];
      const action = scene.actions[CommandEnum.BIND_TOKEN];
      this.logger.log(token);

      const user = await this.userService.findUserByToken(token);

      if (user?.userId) {
        await ctx.replyWithHTML(action.error.text);
        await ctx.scene.enter(CommandEnum.START);
        return;
      }

      if (user) {
        await this.userService.updateUserByToken(token, {
          userId: ctx.from.id,
          username: ctx.from.username || null,
        });
        await ctx.replyWithHTML(action.success.text);
        await ctx.scene.enter(CommandEnum.HOME);
        return;
      } else {
        await ctx.replyWithHTML(action.error.text);
        await ctx.scene.enter(CommandEnum.START);
        return;
      }
    }
  }
}
