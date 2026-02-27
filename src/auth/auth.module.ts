import { UserService } from './../masters/services/user.service';
import { Logger, Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { MastersModule } from 'src/masters/masters.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/jwt.strategy';
import { EmailModule } from 'src/email/email.module';
import { SessionCleanupService } from './auth/session-cleanup.service';

@Module({
  imports: [
    MastersModule,
    PassportModule,
    JwtModule.register({
      secret: 'ngadmin',
      signOptions: {
        expiresIn: '3h'
      }
    }),
    EmailModule
  ],
  controllers: [AuthController],
  providers: [AuthService, UserService, JwtStrategy, Logger, SessionCleanupService]
})
export class AuthModule { }
