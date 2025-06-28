import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class FavouriteScreenService {
  constructor(private _db: DatabaseService) {}

  async getAllFavouriteScreen(user) {
    try {
      const allFavouriteScreen = await this._db.favouriteScreen.findMany({
        where: {
          userId: user.UserMasterSid,
        },
      });
      const sortedData = allFavouriteScreen.sort(
        (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime() // Sort newest first
      );
      return sortedData;
    } catch (error) {
      throw error;
    }
  }

  async createNewFavouriteScreen(payload: { path: string; screenName: string }, user) {
    try {
      // Check if exists
      const existingFavourite = await this._db.favouriteScreen.findFirst({
        where: {
          path: payload.path,
          userId: user.UserMasterSid,
        },
      });

      if (existingFavourite) {
        throw new BadRequestException(`A favourite screen with path '${payload.path}' already exists for this user.`);
      }

      const createdFavouriteScreen = await this._db.favouriteScreen.create({
        data: {
          ...payload,
          userId: user.UserMasterSid,
          createdBy: user.userEmail,
          createdOn: new Date(),
        },
      });
      return createdFavouriteScreen;
    } catch (error) {
      throw error;
    }
  }

  async checkIfPathIsFav(path,user){
    try {
      const exist = await this._db.favouriteScreen.findFirst({
        where: {
          path : path,
          userId : user.UserMasterSid
        },
      });
      if (!exist) {
        throw new BadRequestException(`Path :${path} is not user's Favourite`);
      }
      return exist;
    } catch (error) {
      throw error;
    }
  }

  async deleteFavouriteScreen(path:string, user: any) {
    try {
      const existingFavourite = await this._db.favouriteScreen.findFirst({
        where: {
          path: path,
          userId: user.UserMasterSid,
        },
      });
      if (!existingFavourite) {
        throw new BadRequestException(`Favourite Screen with path '${path}' and UserMasterSid ${user.UserMasterSid} not found.`);
      }
      const deletedFavouriteScreen = await this._db.favouriteScreen.delete({
        where: {
          FavScreenId: existingFavourite.FavScreenId,
        },
      });
      return deletedFavouriteScreen;
    } catch (error) {
      throw error;
    }
  }


//  Below methods weren't used

  async fetchFavouriteScreenById(FavScreenId: number) {
    try {
      const ourFavouriteScreen = await this._db.favouriteScreen.findUnique({
        where: {
          FavScreenId: FavScreenId,
        },
      });
      if (!ourFavouriteScreen) {
        throw new BadRequestException(`Favourite Screen with Id : ${FavScreenId} not exists`);
      }
      return ourFavouriteScreen;
    } catch (error) {
      throw error;
    }
  }

  async updateFavouriteScreenById(FavScreenId: number, payload) {
    try {
      const exist = await this._db.favouriteScreen.findUnique({
        where: {
          FavScreenId: FavScreenId,
        },
      });
      if (!exist) {
        throw new BadRequestException(`Favourite Screen with Id : ${FavScreenId} not exists`);
      }
      const updatedFavouriteScreen = await this._db.favouriteScreen.update({
        where: {
          FavScreenId: FavScreenId,
        },
        data: payload,
      });
      return updatedFavouriteScreen;
    } catch (error) {
      throw error;
    }
  }


  async searchFavouriteScreen(data: SearchListDto) {
    const { searchType, filterValue } = data;
    const intFields = [''];
    const stringFields = ['path', 'screenName'];
    const acceptedType = [...intFields, ...stringFields];
    if (!acceptedType.includes(searchType)) {
      throw new BadRequestException('Invalid Search Type');
    }

    const whereClause: any = {};

    if (stringFields.includes(searchType)) {
      whereClause[searchType] = {
        contains: filterValue,
        mode: 'insensitive',
      };
    } else if (intFields.includes(searchType)) {
      const numberValue = parseInt(filterValue);
      if (isNaN(numberValue)) {
        throw new BadRequestException(`${searchType} must be a valid number`);
      }
      whereClause[searchType] = numberValue;
    }

    const searchResults = await this._db.favouriteScreen.findMany({
      where: {
        ...whereClause,
      },
    }).catch((err) => {
      throw new Error(`Error Occurred : ${JSON.stringify(err), err}`);
    });

    return searchResults;
  }
}