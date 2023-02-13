import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { UserService } from '../user/user.service';
import { Action, Scene } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';
import { replyOrEdit } from '../utils/reply-or-edit.util';

@Scene(CommandEnum.CHANGE_TOKEN)
export class ChangeTokenScene extends AbstractScene {
  constructor(private readonly userService: UserService) {
    super();
  }

  @Action(CommandEnum.YES)
  async confirmChangeToken(ctx) {
    const scene = SCENES[ctx.scene.session.current];
    const action = scene.actions[CommandEnum.YES];

    const newToken = await this.userService.changeToken(ctx.from.id);
    if (newToken) {
      await ctx.replyWithHTML(action.success(newToken).text);
      await ctx.scene.enter(CommandEnum.HOME);
      return;
    } else {
      await replyOrEdit(ctx, action.error().text, Markup.inlineKeyboard(action.error().buttons));
      return;
    }
  }

  @Action(CommandEnum.NO)
  async cancelChangeToken(ctx) {
    const scene = SCENES[ctx.scene.session.current];
    const action = scene.actions[CommandEnum.NO];

    await ctx.replyWithHTML(action.text);
    await ctx.scene.enter(CommandEnum.HOME);
    return;
  }
}
