import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TariffDocument = HydratedDocument<Tariff>;

@Schema()
export class Tariff {
  @Prop({
    required: true,
    unique: true,
  })
  name: string;

  @Prop({
    type: Number,
    required: true,
    index: true,
  })
  requestsLimit: number;

  @Prop({
    type: Number,
    required: true,
    index: true,
  })
  price: number;

  @Prop({
    type: Boolean,
    default: false,
  })
  isHidden: boolean;
}

export const TariffSchema = SchemaFactory.createForClass(Tariff);
