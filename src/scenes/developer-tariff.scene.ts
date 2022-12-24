import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Scene } from 'nestjs-telegraf';

@Scene(CommandEnum.DEVELOPER_TARIFF)
export class DeveloperTariffScene extends AbstractScene {
  constructor() {
    super();
  }
}
