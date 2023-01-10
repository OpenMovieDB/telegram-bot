import { Module } from '@nestjs/common';
import { UpdateClientService } from './update-client.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get('UPDATE_API_BASE_URL'),
      }),
    }),
  ],
  providers: [UpdateClientService],
  exports: [UpdateClientService],
})
export class UpdateClientModule {}
