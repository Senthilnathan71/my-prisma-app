import { Injectable } from '@nestjs/common';
import { UserService } from 'src/masters/services/user.service';

@Injectable()
export class AuthService {
    loggedInUserData: any = {};
    constructor(
        private readonly userService : UserService
    ){

    }

    async login(where : any): Promise <any>{
        return await this.userService.findUserById(where)
    }

    async getUser(userId:number){
        try {
            const userData =  await this.userService.getUserById(userId);
            console.log("userData::",userData);
            return userData
        } catch (error) {
            console.log("authSerError",error);
            throw error;
        }
    }
}
