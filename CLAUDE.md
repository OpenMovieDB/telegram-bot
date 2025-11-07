# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Poiskkino API registration and payment Telegram bot built with NestJS and Telegraf. The bot manages user registration, API token generation, subscription management, and payment processing through multiple gateways.

**Tech Stack:**
- NestJS (Node.js framework)
- Telegraf (Telegram Bot API)
- MongoDB with Mongoose ODM
- Redis for caching
- TypeScript
- Docker & Kubernetes for deployment

## Development Commands

```bash
# Development
npm run start:dev          # Start with hot reload
npm run build              # Build for production
npm run start:prod         # Start production build

# Testing & Quality
npm run test               # Run Jest tests
npm run lint               # Run ESLint
npm run format             # Format code with Prettier
```

## Architecture Overview

### Module Structure
The application follows NestJS modular architecture with clear separation of concerns:

1. **Core Modules** (in `src/`):
   - `BotModule` - Main application module and bot orchestration
   - `UserModule` - User management, token generation, and authentication
   - `PaymentModule` - Payment processing with strategy pattern for multiple gateways
   - `TariffModule` - Subscription plan management

2. **Payment Libraries** (in `libs/`):
   - Each payment gateway has its own NestJS library module
   - Accessible via path aliases: `@app/cryptomus-client`, `@app/tbank-client`, etc.
   - Supported gateways: Cryptomus, TBank, YooKassa, YooMoney, Wallet

3. **Scene-Based Bot Flow** (in `src/scenes/`):
   - Telegram conversations managed through scenes
   - Abstract base class `AbstractScene` provides common functionality
   - 15+ scenes for different user flows (registration, payment, token management)

### Key Architectural Patterns

1. **Strategy Pattern for Payments**: 
   - `PaymentStrategyFactory` creates appropriate payment strategy
   - Each gateway implements `IPaymentStrategy` interface
   - Allows easy addition of new payment methods

2. **Repository Pattern**: 
   - Mongoose schemas define data models
   - Services handle business logic
   - Clear separation between data access and business rules

3. **Scene Pattern for Bot Conversations**:
   - Each scene handles specific conversation flow
   - Scenes stored in constants for easy reference
   - Dynamic navigation between scenes based on user actions

### Database Schema

**User** (`src/user/user.schema.ts`):
- `userId`: Telegram user ID (unique)
- `token`: API token in UUID format
- `tariffId`: Reference to subscription plan
- `requestsUsed`: API usage counter
- `subscriptionEndDate`: Subscription expiry

**Payment** (`src/payment/payment.schema.ts`):
- Tracks all payment transactions
- Links user, tariff, and payment gateway
- Status tracking for async payment validation

**Tariff** (`src/tariff/tariff.schema.ts`):
- Defines subscription tiers
- `requestsLimit`: Daily API request limit
- `price`: Monthly price in rubles

### Critical Business Logic

1. **Token Management**:
   - Tokens generated using `uuid-apikey` library
   - Redis caching for performance (`user:token:{token}` keys)
   - Token validation happens through cache first, then database

2. **Chat Membership Requirement**:
   - Free tier users must be in the Telegram chat
   - Daily cron job verifies membership
   - Automatic blocking if user leaves chat

3. **Payment Flow**:
   - User selects tariff → chooses payment method → payment created in DB
   - Gateway-specific strategy generates payment URL
   - Webhook/polling validates payment completion
   - User subscription activated immediately upon payment

### Environment Configuration

Required environment variables (see `example.env`):
- `BOT_TOKEN`: Telegram bot token
- `MONGO_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection URL
- `CHAT_ID`: Main Telegram chat ID for membership verification
- `ADMIN_CHAT_ID`: Admin notifications chat
- Payment gateway credentials for each provider

### Important Considerations

1. **Scene Navigation**: Always use `ctx.scene.enter(SCENE_NAME)` for navigation. Scene names are in `src/constants/scenes.const.ts`

2. **Payment Gateway Addition**: To add new payment gateway:
   - Create new library in `libs/`
   - Implement `IPaymentStrategy` interface
   - Add to `PaymentStrategyFactory`
   - Update `PaymentSystemEnum`

3. **Token Caching**: When modifying user tokens or tariffs, always clear Redis cache:
   ```typescript
   await this.redis.del(`user:token:${user.token}`);
   ```

4. **Error Handling**: Use `AllExceptionFilter` for global error handling. Bot-specific errors should navigate to error scenes with admin notifications.

5. **Testing Payment**: Use test credentials for payment gateways in development. Each gateway library has its own configuration.

6. **Deployment**: Application runs in Kubernetes. Docker image builds with multi-stage process. Always test builds locally before deploying.