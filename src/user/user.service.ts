import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async create(user: User): Promise<User> {
    return this.userModel.create(user);
  }

  async findOneByUserId(userId: string): Promise<User> {
    return this.userModel.findOne({ userId }).populate('tariffId');
  }
}
