import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import ApiKey from 'uuid-apikey';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async create(user: User): Promise<User> {
    return this.userModel.create(user);
  }

  async upsert(user: User): Promise<User> {
    const { userId } = user;
    const existUser = await this.findOneByUserId(userId);
    if (existUser) {
      await this.userModel.updateOne({ userId }, user);
      return this.findOneByUserId(userId);
    } else {
      return this.create(user);
    }
  }

  async findOneByUserId(userId: number): Promise<User> {
    return this.userModel.findOne({ userId }).populate('tariffId');
  }

  async getUserToken(userId: number): Promise<string | null> {
    const user = await this.findOneByUserId(userId);
    if (!user) return null;
    return ApiKey.toAPIKey(user.token);
  }

  async existUser(userId: number): Promise<boolean> {
    const user = await this.findOneByUserId(userId);
    return !!user;
  }
}
