import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tariff, TariffDocument } from './schemas/tariff.schema';

@Injectable()
export class TariffService {
  constructor(@InjectModel(Tariff.name) private readonly tariffModel: Model<TariffDocument>) {}

  async getOneById(_id: string): Promise<Tariff> {
    return this.tariffModel.findById(_id);
  }

  async getAllTariffs(): Promise<Tariff[]> {
    return await this.tariffModel.find();
  }
}
