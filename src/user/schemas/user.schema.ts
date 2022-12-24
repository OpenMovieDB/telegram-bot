import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, ObjectId } from 'mongoose';
import * as ApiKey from 'uuid-apikey';

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
    // @ts-ignore
    default: () => ApiKey.create().uuid,
  })
  token?: string;

  @Prop({
    required: true,
  })
  username: string;

  @Prop({
    required: true,
    unique: true,
    default() {
      return this.username;
    },
  })
  email?: string;

  @Prop({
    default: () => 0,
  })
  requestUsed?: number;

  @Prop({
    default: () => '6016bed198ebf72bc112edae',
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: User.name }],
  })
  tariffId?: ObjectId;

  @Prop({
    default: () => false,
  })
  inChat?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
