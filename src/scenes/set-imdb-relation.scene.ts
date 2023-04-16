import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { UserService } from '../user/user.service';
import { Action, Ctx, On, Scene } from 'nestjs-telegraf';
import { Context } from '../interfaces/context.interface';
import { SCENES } from '../constants/scenes.const';
import { UpdateClientService } from '@app/update-client';

@Scene(CommandEnum.SET_IMDB_RELATION)
export class SetImdbRelationScene extends AbstractScene {
  constructor(private readonly userService: UserService, private readonly updateClient: UpdateClientService) {
    super();
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    if ('text' in ctx.message) {
      const message = ctx.message.text;
      const scene = SCENES[ctx.scene.session.current];

      const isValidIdList = message.length > 5 && /(\d+:tt\d+)+/gm.test(message);
      if (isValidIdList) {
        const relations = message.split(',').map((relation) => relation.split(':'));
        for (const [kinopoiskId, imdbId] of relations) {
          this.updateClient.setImdbRelation(parseInt(kinopoiskId), imdbId).catch((e) => {
            console.log(e);
          });
        }
        await ctx.replyWithHTML(scene.success.text);
        await ctx.scene.enter(CommandEnum.HOME);
      } else {
        await ctx.replyWithHTML(scene.error.text);
        await ctx.scene.enter(CommandEnum.HOME);
      }
    }
  }

  @Action(CommandEnum.BACK)
  async back(ctx) {
    await ctx.scene.enter(CommandEnum.HOME);
    return;
  }
}
