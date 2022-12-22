import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, ObjectId } from 'mongoose';
import { Tariff } from './tariff.schema';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({
    required: true,
    unique: true,
  })
  userId: number;

  @Prop({
    required: true,
    unique: true,
  })
  token: string;

  @Prop({
    required: true,
    unique: true,
  })
  username: string;

  @Prop({
    default: () => 0,
  })
  requestUsed: number;

  @Prop({
    default: () => '6016bed198ebf72bc112edae',
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tariff' }],
  })
  tariffId: ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);
