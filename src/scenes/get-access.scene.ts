import { Scene } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';

@Scene(CommandEnum.GET_ACCESS)
export class GetAccessScene extends AbstractScene {}
