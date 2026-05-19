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
import { TokenCleanupService } from './auth/token-cleanup.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MastersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if(!secret){
          throw new Error('❌ JWT_SECRET is not defined in environment variables');
        }
        return {
          secret,
          signOptions: {
            expiresIn: '3h',
          },
        };
      },
      inject: [ConfigService],
    }),
    EmailModule
  ],
  controllers: [AuthController],
  providers: [AuthService, UserService, JwtStrategy, Logger, SessionCleanupService, TokenCleanupService]
})
export class AuthModule { }
