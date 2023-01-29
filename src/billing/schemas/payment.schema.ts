import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema()
export class Payment {
  @Prop({ default: () => uuidv4 })
  orderId: string;

  @Prop({ default: () => PaymentStatusEnum.PENDING })
  status: string;

  @Prop()
  system: PaymentSystemEnum;

  @Prop()
  userId: number;

  @Prop()
  chatId: number;

  @Prop()
  tariffId: string;

  @Prop()
  amount: number;

  @Prop()
  paymentAmount: number;

  @Prop()
  currency: string;

  @Prop()
  paymentCurrency: string;

  @Prop()
  description: string;

  @Prop()
  url: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
