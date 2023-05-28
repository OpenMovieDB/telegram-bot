import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { UserService } from '../user/user.service';
import { Action, Ctx, On, Scene } from 'nestjs-telegraf';
import { Context } from '../interfaces/context.interface';
import { SCENES } from '../constants/scenes.const';
import { UpdateClientService } from '@app/update-client';

@Scene(CommandEnum.UPDATE_MOVIE)
export class UpdateMovieScene extends AbstractScene {
  constructor(private readonly userService: UserService, private readonly updateClient: UpdateClientService) {
    super();
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    if ('text' in ctx.message) {
      const message = ctx.message.text;
      const scene = SCENES[ctx.scene.session.current];

      const isValidIdList = message.length > 2 && /\d+/gm.test(message);
      if (isValidIdList) {
        const ids = message.split(',').map((id) => parseInt(id));

        const { movieStatuses } = await this.updateClient.update(ids);
        const found = movieStatuses
          .filter((movie) => movie.status === 'found')
          .map((s) => s.id)
          .join(', ');

        const notFound = movieStatuses
          .filter((movie) => movie.status === 'not found')
          .map((s) => s.id)
          .join(', ');

        ctx.replyWithHTML(`<b>Добавлены в очередь:</b> ${found}\n<b>Не найдены:</b> ${notFound}
        `);
        ctx.scene.enter(CommandEnum.HOME);
      } else {
        ctx.replyWithHTML(scene.error.text);
        ctx.scene.enter(CommandEnum.HOME);
      }
    }
  }

  @Action(CommandEnum.BACK)
  async back(ctx) {
    await ctx.scene.enter(CommandEnum.HOME);
    return;
  }
}
