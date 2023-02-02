import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { UserService } from '../user/user.service';
import { Action, Scene } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';
import { ConfigService } from '@nestjs/config';

@Scene(CommandEnum.FREE_TARIFF)
export class FreeTariffScene extends AbstractScene {
  private readonly chatId: string;
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.chatId = configService.get('CHAT_ID');
  }

  @Action(CommandEnum.CONFIRM_JOIN_CHAT)
  async confirmJoinChat(ctx) {
    const scene = SCENES[ctx.scene.session.current];

    const action = scene.actions[CommandEnum.CONFIRM_JOIN_CHAT];
    const user = await this.userService.findOneByUserId(ctx.from.id);
    try {
      const { status } = await ctx.telegram.getChatMember(
        this.chatId,
        user.userId,
      );
      if (status === 'member') {
        let token = await this.userService.getUserToken(ctx.from.id);
        if (!token) token = await this.userService.changeToken(ctx.from.id);

        await ctx.replyWithHTML(
          action.success(token).navigateText,
          Markup.keyboard(action.success(token).navigateButtons).resize(),
        );
      } else {
        await ctx.replyWithHTML(
          action.error().navigateText,
          Markup.keyboard(action.error().navigateButtons).resize(),
        );
        await ctx.replyWithHTML(
          action.error().text,
          Markup.inlineKeyboard(action.error().buttons),
        );
      }
    } catch (e) {
      this.logger.error('CommandEnum.CONFIRM_JOIN_CHAT', e);
      await ctx.replyWithHTML(
        action.error().navigateText,
        Markup.keyboard(action.error().navigateButtons).resize(),
      );
      await ctx.replyWithHTML(
        action.error().text,
        Markup.inlineKeyboard(action.error().buttons),
      );
    }
  }
}
