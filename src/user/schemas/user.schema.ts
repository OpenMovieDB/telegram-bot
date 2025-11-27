import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

import { Tariff } from 'src/tariff/schemas/tariff.schema';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({
    required: false,
    sparse: true,
    unique: true,
  })
  userId?: number;

  @Prop()
  chatId?: number;

  @Prop({ default: false })
  isExternalUser?: boolean;

  @Prop()
  sendWarnNotification?: boolean;

  @Prop({
    required: true,
    unique: true,
  })
  token?: string;

  @Prop({
    required: false,
    sparse: true,
    unique: true,
  })
  username?: string;

  @Prop()
  password?: string;

  @Prop({
    required: false,
    sparse: true,
    unique: true,
  })
  email?: string;

  @Prop({
    default: () => 0,
  })
  requestsUsed?: number;

  @Prop({
    default: () => '6016bed198ebf72bc112edae',
    type: mongoose.Schema.Types.ObjectId,
    ref: Tariff.name,
  })
  tariffId?: Types.ObjectId;

  @Prop({
    default: () => false,
  })
  inChat?: boolean;

  @Prop({ isOptional: true })
  isSubscribed?: boolean;

  @Prop({ isOptional: true, type: Date })
  subscriptionStartDate?: Date;

  @Prop({ isOptional: true, type: Date })
  subscriptionEndDate?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
