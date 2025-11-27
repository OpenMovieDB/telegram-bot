import { Scene, Ctx, Command } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Context } from '../interfaces/context.interface';
import { Injectable } from '@nestjs/common';

@Scene(CommandEnum.ADMIN_MENU)
@Injectable()
export class AdminMenuScene extends AbstractScene {
  @Command('admin')
  async onAdminCommand(@Ctx() ctx: Context) {
    await ctx.scene.enter(CommandEnum.ADMIN_MENU);
  }
}
