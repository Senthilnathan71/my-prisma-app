import { Injectable, Logger } from '@nestjs/common';
import { getClientIp } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { UserService } from 'src/masters/services/user.service';

@Injectable()
export class AuthService {
    loggedInUserData: any = {};
    constructor(
        private readonly userService: UserService,
        private readonly db: DatabaseService
    ) {

    }

    async login(where: any): Promise<any> {
        return await this.userService.findUserById(where)
    }

    async getUser(userId: number) {
        try {
            const userData = await this.userService.getUserById(userId);

            return userData
        } catch (error) {
            throw error;
        }
    }



    async userHistory(user, loginData, req) {
  let ipAddress = getClientIp(req);

  if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
    // Fetch public IP for local dev
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      ipAddress = data.ip;
    } catch (err) {
        throw err
    }
  }

  await this.db.userLoginHistory.create({
    data: {
      userId: user.UserMasterSid,
      ipAddress: ipAddress,
      location: loginData.location || 'Unknown',
      createdOn: new Date()
    }
  });
}




}


