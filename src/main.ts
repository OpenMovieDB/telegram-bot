import { NestFactory } from '@nestjs/core';
import { BotModule } from './bot.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(BotModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Enable graceful shutdown
    app.enableShutdownHooks();

    // Check if HTTP server is needed (for webhooks, etc.)
    const enableHttpServer = process.env.ENABLE_HTTP_SERVER === 'true';
    
    if (enableHttpServer) {
      const port = process.env.PORT || 3000;
      await app.listen(port);
      logger.log(`HTTP Server running on port ${port}`);
    } else {
      // Initialize the app without listening on a port
      await app.init();
      logger.log('Telegram Bot started without HTTP server (webhook mode disabled)');
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
