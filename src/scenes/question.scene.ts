import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Scene } from 'nestjs-telegraf';

@Scene(CommandEnum.QUESTION)
export class QuestionScene extends AbstractScene {}
