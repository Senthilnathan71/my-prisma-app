import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "./auth.service";
import { UserService } from "src/masters/services/user.service";
import { ConfigService } from "@nestjs/config";

@Injectable()

export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private authService: AuthService,
        private readonly userService: UserService,
        private configService: ConfigService
    ) {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('❌ JWT_SECRET is not defined');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        })
    }

    async validate(payload: any) {
        const user = await this.userService.getUserById(payload.id);
        if (!user) throw new UnauthorizedException('Invalid user');

        // Validate project type matches user type

        const isSalesperson = String(user.isSalesperson) === '1';

        // if (payload.projectType === 'freight-forwarding' && isSalesperson) {
        //     throw new UnauthorizedException('Salesperson not allowed in this app.');
        // }

        if (payload.projectType === 'salesperson' && !isSalesperson) {
            throw new UnauthorizedException('Only salesperson can log in to this app.');
        }

        return user;
    }

}