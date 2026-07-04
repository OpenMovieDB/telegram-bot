import { Controller, Get } from '@nestjs/common';

// Health endpoint only (Docker HEALTHCHECK / probes). The HTTP server is
// enabled with ENABLE_HTTP_SERVER=true; no admin endpoints live here — the
// unauthenticated broadcast route was removed deliberately.
@Controller('')
export class BotController {
  @Get()
  ping() {
    return { data: 'pong' };
  }
}
