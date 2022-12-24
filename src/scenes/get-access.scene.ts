import { Scene } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { UserService } from '../user/user.service';

@Scene(CommandEnum.GET_ACCESS)
export class GetAccessScene extends AbstractScene {
  constructor(private readonly userService: UserService) {
    super();
  }
}
