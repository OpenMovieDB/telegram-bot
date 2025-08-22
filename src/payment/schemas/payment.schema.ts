import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema()
export class Payment {
  @Prop()
  paymentId: string;

  @Prop()
  orderId: string;

  @Prop({ default: () => PaymentStatusEnum.PENDING })
  status: string;

  @Prop({ type: String, enum: PaymentSystemEnum })
  paymentSystem: PaymentSystemEnum;

  @Prop()
  userId: number;

  @Prop()
  chatId: number;

  @Prop()
  tariffId: string;

  @Prop()
  amount: number;

  @Prop()
  paymentAt: Date;

  @Prop()
  paymentAmount: number;

  @Prop()
  paymentCurrency: string;

  @Prop()
  description?: string;

  @Prop()
  url: string;

  @Prop()
  monthCount: number;

  @Prop()
  transactionId?: string;

  @Prop()
  payerAmount?: string;

  @Prop()
  payerCurrency?: string;

  @Prop()
  network?: string;

  @Prop()
  address?: string;

  @Prop()
  from?: string;

  @Prop()
  txid?: string;

  @Prop()
  form: string;

  @Prop({ default: false })
  isFinal?: boolean;

  @Prop()
  email?: string;

  @Prop()
  discount?: number;

  @Prop()
  originalPrice?: number;

  constructor(payment: Partial<Payment>) {
    Object.assign(this, payment);
  }
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
