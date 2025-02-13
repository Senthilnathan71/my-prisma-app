import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MastersModule } from './masters/masters.module';
import { AuthModule } from './auth/auth.module';
import { SalesModule } from './sales/sales.module';

@Module({
  imports: [DatabaseModule, MastersModule, AuthModule, SalesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
