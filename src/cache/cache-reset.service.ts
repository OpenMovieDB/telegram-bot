import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import * as ApiKey from 'uuid-apikey';
import { UserService } from '../user/user.service';
import { TariffService } from '../tariff/tariff.service';

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

  constructor(
    private readonly redisService: RedisService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  async resetUserCacheAndLimits(userId: number, userToken: string, newRequestsLimit: number, forceReset = true): Promise<void> {
    try {
      // We don't need to cache user data - it's already in database
      // Only manage API limits in Redis

      // Convert UUID token to API key for Redis limits
      // @ts-ignore
      const apiKey = ApiKey.toAPIKey(userToken);

      const currentLimit = await this.redis.get(apiKey);
      const currentRemaining = parseInt(currentLimit) || 0;

      // If forceReset is true (e.g., when changing tariffs), always set the new tariff's limit
      // If forceReset is false (e.g., when extending same tariff), keep current remaining if it's positive
      const finalLimit = forceReset || currentRemaining <= 0 ? newRequestsLimit : currentRemaining;
      await this.redis.set(apiKey, finalLimit);

      this.logger.log(
        `Updated limit for user ${userId}: current=${currentRemaining}, new=${newRequestsLimit}, final=${finalLimit}, forceReset=${forceReset}`,
      );
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

  // Method removed - we get user data directly from database via UserService

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
      // Get user from database, not cache
      const user = await this.userService.findOneByUserId(userId);
      if (!user) {
        this.logger.log(`User ${userId} not found in database`);
        return null;
      }

      // Get tariff to know the total limit
      const tariff = user.tariffId as any; // Already populated
      const totalLimit = tariff?.requestsLimit || 0;

      // Convert UUID token to API key to check remaining limit in Redis
      // @ts-ignore
      const apiKey = ApiKey.toAPIKey(user.token);
      const remainingLimit = await this.redis.get(apiKey);

      if (remainingLimit === null) {
        this.logger.log(`No limit found for user ${userId}, returning full limit`);
        return {
          requestsUsed: 0,
          requestsLeft: totalLimit,
          totalLimit: totalLimit,
        };
      }

      const requestsLeft = parseInt(remainingLimit as string, 10) || 0;
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

  async transferTokenLimits(oldToken: string, newToken: string): Promise<void> {
    try {
      // oldToken and newToken are UUIDs from database
      // Convert them to API keys for Redis limits
      // @ts-ignore
      const oldApiKey = ApiKey.toAPIKey(oldToken);
      // @ts-ignore
      const newApiKey = ApiKey.toAPIKey(newToken);

      this.logger.log(`Starting token transfer: ${oldApiKey} -> ${newApiKey}`);

      // Get remaining limit from old API key
      const remainingLimit = await this.redis.get(oldApiKey);

      if (remainingLimit) {
        // Transfer remaining requests to new API key
        await this.redis.set(newApiKey, remainingLimit);
        this.logger.log(`Transferred ${remainingLimit} requests from ${oldApiKey} to ${newApiKey}`);
      } else {
        this.logger.log(`No remaining requests to transfer from ${oldApiKey}`);
      }

      // Delete old API key's limit AFTER successful transfer
      // This ensures no data loss if transfer fails
      const deleteResult = await this.redis.del(oldApiKey);
      this.logger.log(`Deleted old API key ${oldApiKey} from Redis: ${deleteResult} keys removed`);

      // Verify old key is really deleted
      const checkOld = await this.redis.get(oldApiKey);
      if (checkOld) {
        this.logger.error(`WARNING: Old API key ${oldApiKey} still exists in Redis with value: ${checkOld}`);
      }
    } catch (error) {
      this.logger.error(`Failed to transfer token limits from ${oldToken} to ${newToken}:`, error);
      throw error; // Re-throw to let caller handle the error
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
