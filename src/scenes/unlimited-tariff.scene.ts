import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Scene } from 'nestjs-telegraf';

@Scene(CommandEnum.UNLIMITED_TARIFF)
export class UnlimitedTariffScene extends AbstractScene {
  constructor() {
    super();
  }
}
