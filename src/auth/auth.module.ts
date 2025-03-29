import { Logger, Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { MastersModule } from 'src/masters/masters.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/jwt.strategy';
import { EmailModule } from 'src/email/email.module';

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
  providers: [AuthService, JwtStrategy, Logger]
})
export class AuthModule { }
