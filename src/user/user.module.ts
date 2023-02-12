import { Tariff, TariffSchema } from 'src/tariff/schemas/tariff.schema';
import { User, UserSchema } from './schemas/user.schema';

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tariff.name, schema: TariffSchema },
    ]),
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
