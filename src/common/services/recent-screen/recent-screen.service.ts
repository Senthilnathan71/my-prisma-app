import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class RecentScreenService {
    constructor(private _db:DatabaseService){}

    async createNewRecentScreen(payload: { path: string; screenName: string }, user: any) {
        const userId = user.UserMasterSid;

        // Check for existing record with the same path
        const existingRecord = await this._db.recentScreen.findFirst({
            where: { path: payload.path, userId },
        });

        if (existingRecord) {
            // Update createdOn time for the existing record
            return await this._db.recentScreen.update({
                where: { RecentScreenId: existingRecord.RecentScreenId }, 
                data: { createdOn: new Date() },
            });
        }

        // Get current recent screens for this user
        const currentRecords = await this._db.recentScreen.findMany({
            where: { userId },
            orderBy: { createdOn: 'asc' },
        });

        // If 10 or more records exist, delete the oldest
        if (currentRecords.length >= 10) {
            await this._db.recentScreen.delete({
                where: { RecentScreenId: currentRecords[0].RecentScreenId },
            });
        }

        // Create new recent screen
        const createdRecord = await this._db.recentScreen.create({
            data: {
                ...payload,
                userId,
                createdBy: user.userEmail,
                createdOn: new Date(),
            },
        });

        return createdRecord;
    }

  async getAllRecentScreen(user: any) {
    try {
      const allRecentScreens = await this._db.recentScreen.findMany({
        where: { userId: user.UserMasterSid },
        orderBy: { createdOn: 'desc' },
      });
      return allRecentScreens;
    } catch (error) {
      throw error;
    }
  }

  // Below Methods were not used anywhere

    async fetchRecentScreenById(RecentScreenId:number){
        try {
            const ourRecentScreen =await this._db.recentScreen.findUnique({
                where : {
                    RecentScreenId:RecentScreenId
                }
            })
            if(!ourRecentScreen){
                throw new BadRequestException(`Recent Screen with Id : ${RecentScreenId} not exists`);
            }
            return ourRecentScreen;
        } catch (error) {
            throw error;
        }
    }

    async updateRecentScreenById(RecentScreenId:number,payload){
        try {
             const exist =await this._db.recentScreen.findUnique({
                where : {
                    RecentScreenId:RecentScreenId
                }
            })
            if(!exist){
                throw new BadRequestException(`Recent Screen with Id : ${RecentScreenId} not exists`);
            }
            const updatedRecentScreen = this._db.recentScreen.update({
                where : {
                    RecentScreenId : RecentScreenId
                },
                data : payload
            })
            return updatedRecentScreen;
        } catch (error) {
            throw error;
        }
    }


    async deleteRecentScreen(RecentScreenId:number){
        try {
            const exist = await this._db.recentScreen.findUnique({
                where: {
                    RecentScreenId: RecentScreenId
                }
            })
            if (!exist) {
                throw new BadRequestException(`Recent Screen with Id : ${RecentScreenId} not exists`);
            }
            const deletedRecentScreen = this._db.recentScreen.delete({
                where: {
                    RecentScreenId: RecentScreenId
                }
            })
            return deletedRecentScreen;
        } catch(error) {
            throw error;
        }
    }


    async searchRecentScreen(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            ''
        ];
        const stringFields = [
            'path',
            'screenName'
        ];
        const acceptedType = [...intFields,...stringFields];
        if(!acceptedType.includes(searchType)){
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause:any ={}

        if(stringFields.includes(searchType)){
            whereClause[searchType]={
                contains:filterValue,
                mode:'insensitive'
            }
        } else if(intFields.includes(searchType)){
            const numberValue=parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType]=numberValue;
        }

        const searchResults = await this._db.recentScreen.findMany({
            where : {
                ...whereClause,
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}
