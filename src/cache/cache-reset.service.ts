import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import * as ApiKey from 'uuid-apikey';

interface CachedUser {
  _id: string;
  token: string;
  userId: number;
  username?: string;
  password?: string;
  email?: string;
  requestsUsed?: number;
  inChat?: boolean;
  isSubscribed?: boolean;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  tariffName: string;
  requestsLimit: number;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class CacheResetService {
  private readonly logger = new Logger(CacheResetService.name);
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  async resetUserCacheAndLimits(userId: number, userToken: string, newRequestsLimit: number): Promise<void> {
    try {
      // @ts-ignore
      const tokenUuid = ApiKey.toUUID(userToken);
      const userCacheKey = `user:${tokenUuid}`;

      await this.redis.del(userCacheKey);
      this.logger.log(`Deleted user cache: ${userCacheKey} for userId: ${userId}`);

      // @ts-ignore
      const apiKey = ApiKey.toAPIKey(userToken);
      await this.redis.set(apiKey, newRequestsLimit);

      this.logger.log(`Set new limit ${newRequestsLimit} for user ${userId} with token: ${apiKey}`);
    } catch (error) {
      this.logger.error(`Failed to reset cache for user ${userId}:`, error);
      throw error;
    }
  }

  async resetUserCacheByUserId(userId: number): Promise<void> {
    try {
      const pattern = 'user:*';
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        this.logger.log(`No user cache found for userId: ${userId}`);
        return;
      }

      const pipeline = this.redis.pipeline();
      keys.forEach((key) => pipeline.get(key));
      const results = await pipeline.exec();

      let deleted = 0;
      for (let i = 0; i < results.length; i++) {
        const [err, data] = results[i];
        if (!err && data) {
          try {
            const cachedUser = JSON.parse(data as string);
            if (cachedUser.userId === userId) {
              await this.redis.del(keys[i]);
              deleted++;
              this.logger.log(`Deleted user cache: ${keys[i]} for userId: ${userId}`);
            }
          } catch (parseError) {
            await this.redis.del(keys[i]);
            this.logger.warn(`Deleted corrupted cache entry: ${keys[i]}`);
          }
        }
      }

      if (deleted === 0) {
        this.logger.log(`No cache entries found for userId: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to reset cache by userId ${userId}:`, error);
      throw error;
    }
  }

  async getUserByUserId(userId: number): Promise<CachedUser | null> {
    try {
      const pattern = 'user:*';
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) return null;

      const pipeline = this.redis.pipeline();
      keys.forEach((key) => pipeline.get(key));
      const results = await pipeline.exec();

      for (let i = 0; i < results.length; i++) {
        const [err, data] = results[i];
        if (!err && data) {
          try {
            const cachedUser = JSON.parse(data as string);
            if (cachedUser.userId === userId) {
              return cachedUser;
            }
          } catch (parseError) {
            await this.redis.del(keys[i]);
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get user by userId ${userId}:`, error);
      return null;
    }
  }

  async setUserLimit(userToken: string, newLimit: number): Promise<void> {
    try {
      // @ts-ignore
      const apiKey = ApiKey.toAPIKey(userToken);
      await this.redis.set(apiKey, newLimit);

      this.logger.log(`Set new limit ${newLimit} for token: ${apiKey}`);
    } catch (error) {
      this.logger.error(`Failed to set limit for token:`, error);
      throw error;
    }
  }

  async getUserStats(
    userId: number,
  ): Promise<{ requestsUsed: number; requestsLeft: number; totalLimit: number } | null> {
    try {
      const cachedUser = await this.getUserByUserId(userId);
      if (!cachedUser) {
        this.logger.log(`User ${userId} not found in cache`);
        return null;
      }

      // @ts-ignore
      const apiKey = ApiKey.toAPIKey(cachedUser.token);
      const remainingLimit = await this.redis.get(apiKey);

      if (remainingLimit === null) {
        this.logger.log(`No limit found for user ${userId}, token: ${apiKey}`);
        return {
          requestsUsed: 0,
          requestsLeft: cachedUser.requestsLimit,
          totalLimit: cachedUser.requestsLimit,
        };
      }

      const requestsLeft = parseInt(remainingLimit as string, 10) || 0;
      const totalLimit = cachedUser.requestsLimit;
      const requestsUsed = Math.max(0, totalLimit - requestsLeft);

      this.logger.log(`Stats for user ${userId}: used=${requestsUsed}, left=${requestsLeft}, total=${totalLimit}`);

      return {
        requestsUsed,
        requestsLeft,
        totalLimit,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for user ${userId}:`, error);
      return null;
    }
  }

  async transferTokenLimits(oldToken: string, newToken: string): Promise<number> {
    try {
      // @ts-ignore
      const oldApiKey = ApiKey.toAPIKey(oldToken);
      // @ts-ignore
      const newApiKey = ApiKey.toAPIKey(newToken);

      const remainingLimit = await this.redis.get(oldApiKey);
      const transferAmount = remainingLimit ? parseInt(remainingLimit, 10) : 0;

      if (transferAmount > 0) {
        await this.redis.set(newApiKey, transferAmount);
        this.logger.log(`Transferred ${transferAmount} requests from ${oldApiKey} to ${newApiKey}`);
      }

      await this.redis.del(oldApiKey);
      this.logger.log(`Deleted old token ${oldApiKey}`);

      return transferAmount;
    } catch (error) {
      this.logger.error(`Failed to transfer token limits from ${oldToken} to ${newToken}:`, error);
      return 0;
    }
  }

  async getTokenLimit(userToken: string): Promise<number> {
    try {
      // @ts-ignore
      const apiKey = ApiKey.toAPIKey(userToken);
      const limit = await this.redis.get(apiKey);
      return limit ? parseInt(limit, 10) : 0;
    } catch (error) {
      this.logger.error(`Failed to get token limit:`, error);
      return 0;
    }
  }
}
