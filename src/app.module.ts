import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MastersModule } from './masters/masters.module';
import { AuthModule } from './auth/auth.module';
import { SalesModule } from './sales/sales.module';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './email/email.module';
import { CrmModule } from './crm/crm.module';
import { ShortcutModule } from './shortcut/shortcut.module';
import { CommonModule } from './common/common.module';
import { AccountsModule } from './accounts/accounts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    MastersModule,
    AuthModule,
    SalesModule,
    CrmModule,
    ShortcutModule,
    CommonModule,
    AccountsModule,
  ],
  controllers: [AppController],
  providers: [AppService, Logger],
})
export class AppModule {}
