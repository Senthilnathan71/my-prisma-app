import { Injectable } from "@nestjs/common";
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

    async validate(payload: any){
        const id = payload.id ? payload.id : 0;
        if(this.authService.loggedInUserData[id]){  //this block need to re-verify
            return this.authService.loggedInUserData[id]
        }else{
            if(id){
                let user = await this.userService.getUserById(id);
                return user;
            }
        }
    }
}