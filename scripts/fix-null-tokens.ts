import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { BotModule } from '../src/bot.module';
import { UserService } from '../src/user/user.service';

async function run() {
  const logger = new Logger('fix-null-tokens');

  const app = await NestFactory.createApplicationContext(BotModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const userService = app.get(UserService);
    const repaired = await userService.regenerateMissingTokens();

    if (repaired.length === 0) {
      logger.log('No users without token found.');
      return;
    }

    logger.log(`Regenerated tokens for ${repaired.length} users:`);
    for (const u of repaired) {
      logger.log(`  - ${u.username ? '@' + u.username : 'id=' + u.userId}`);
    }
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fix-null-tokens failed:', err);
  process.exit(1);
});
