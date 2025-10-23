import { Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as ApiKey from 'uuid-apikey';
import { v4 as uuidv4 } from 'uuid';
import { Tariff } from 'src/tariff/schemas/tariff.schema';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async create(user: User): Promise<User> {
    const token = uuidv4();
    return this.userModel.create({ ...user, token });
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

  async update(userId: number, user: Partial<User>): Promise<User> {
    await this.userModel.updateOne({ userId }, user);
    return this.findOneByUserId(user.userId);
  }

  async findOneByUserId(userId: number): Promise<User & { tariffId: Tariff }> {
    return this.userModel.findOne({ userId }).populate('tariffId').lean();
  }

  async findUsersInChat(): Promise<(User & { tariffId: Tariff })[]> {
    return this.userModel.find({ inChat: true }).populate('tariffId').lean();
  }

  async getUserToken(userId: number): Promise<string | null> {
    const user = await this.findOneByUserId(userId);
    if (!user?.token) return null;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return ApiKey.toAPIKey(user.token);
  }

  async existUserInChat(userId: number): Promise<boolean> {
    const user = await this.findOneByUserId(userId);
    return !!user?.inChat;
  }

  async blockUser(userId: number, inChat: boolean): Promise<User> {
    const user = await this.findOneByUserId(userId);
    if (!user) return null;
    return this.update(userId, {
      inChat,
    });
  }

  async findUserByToken(token: string): Promise<User> {
    try {
      const user = await this.userModel
        .findOne({
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          token: ApiKey.toUUID(token),
        })
        .lean();
      return user;
    } catch (e) {
      this.logger.error(e);
      return null;
    }
  }

  async updateUserByToken(token: string, user: Partial<User>): Promise<User> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.userModel.updateOne({ token: ApiKey.toUUID(token) }, user);
  }

  async changeToken(userId: number): Promise<string | null> {
    const user = await this.findOneByUserId(userId);
    if (!user) return null;

    // Generate new UUID token
    const newToken = uuidv4();

    await this.userModel.updateOne({ userId }, { token: newToken });

    return newToken;
  }

  async getUsersWithExpiredSubscription(expirationDate: Date, tariffIds: string[]): Promise<User[]> {
    const expiredUsers = await this.userModel
      .find({
        subscriptionEndDate: { $lte: expirationDate },
        tariffId: { $in: tariffIds },
      })
      .populate('tariffId')
      .exec();

    return expiredUsers.filter((user) => this.isSubscriptionExpired(user.subscriptionEndDate, expirationDate));
  }

  async getAllUserTgIDs(): Promise<number[]> {
    const users = await this.userModel.find({}).exec();

    return users.filter((u) => u?.userId).map((u) => u.userId);
  }

  private isSubscriptionExpired(expirationDate: Date, now: Date): boolean {
    return expirationDate && now >= expirationDate;
  }
}
