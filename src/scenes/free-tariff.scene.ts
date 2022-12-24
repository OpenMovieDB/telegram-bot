import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { UserService } from '../user/user.service';
import { Action, Scene } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { replyOrEdit } from '../utils/reply-or-edit.util';
import { Markup } from 'telegraf';

@Scene(CommandEnum.FREE_TARIFF)
export class FreeTariffScene extends AbstractScene {
  constructor(private readonly userService: UserService) {
    super();
  }

  @Action(CommandEnum.CONFIRM_JOIN_CHAT)
  async confirmJoinChat(ctx) {
    const scene = SCENES[ctx.scene.session.current];
    const action = scene.actions[CommandEnum.CONFIRM_JOIN_CHAT];

    const existUser = await this.userService.existUserInChat(ctx.from.id);
    if (existUser) {
      const token = await this.userService.getUserToken(ctx.from.id);
      await replyOrEdit(
        ctx,
        action.success(token).text,
        Markup.inlineKeyboard(action.success(token).buttons),
      );
    } else {
      await replyOrEdit(
        ctx,
        action.error().text || null,
        Markup.inlineKeyboard(action.error().buttons),
      );
    }
  }
}
