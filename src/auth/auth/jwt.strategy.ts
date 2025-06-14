import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "./auth.service";
import { UserService } from "src/masters/services/user.service";

@Injectable()

export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(
        private authService : AuthService,
        private readonly userService : UserService
    ){
        super({
            jwtFromRequest : ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration:false,
            secretOrKey : 'ngadmin'
        })
    }

   async validate(payload: any) {
    const user = await this.userService.getUserById(payload.id);
    if (!user) throw new UnauthorizedException('Invalid user');

    // Validate project type matches user type
    if (payload.projectType === 'salesperson' && user.isSalesperson !== '1') {
        throw new UnauthorizedException('Token not valid for this app (needs salesperson)');
    }
    if (payload.projectType === 'freight-forwarding' && user.isSalesperson !== null) {
        throw new UnauthorizedException('Token not valid for this app (salesperson not allowed)');
    }

    return user;
}

}