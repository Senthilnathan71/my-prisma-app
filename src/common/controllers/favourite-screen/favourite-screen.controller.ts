import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { FavouriteScreenService } from 'src/common/services/favourite-screen/favourite-screen.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';


@Controller('favourite-screen')
@Auth()
export class FavouriteScreenController {
    constructor(private favScreenService: FavouriteScreenService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Favourite Screen' })
    @ApiCreatedResponse({
        description: 'Create new Favourite Screen',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewFavouriteScreen(@Body() newData: any, @UserData() user: any) {
        let resp = new ResponseData();
        try {
            let res = await this.favScreenService.createNewFavouriteScreen(newData, user);
            this.logger.log(`New Favourite Screen Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Favourite Screen is successfully created"
        } catch (error) {
            this.logger.warn(`Favourite Screen Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Favourite Screen' })
    @ApiCreatedResponse({
        description: 'Get All Favourite Screen',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllFavouriteScreen(@UserData() user: any) {
        let resp = new ResponseData();
        try {
            let res = await this.favScreenService.getAllFavouriteScreen(user);
            this.logger.log(`All Favourite Screen Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Favourite Screen are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Favourite Screen Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Check if a Path is Favourite' })
    @ApiCreatedResponse({
        description: 'Check if a Path is Favourite',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('check')
    async checkAPathIsFavourite(@Query('path') path: string, @UserData() user: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Checking if it is an favourite Path : ${path}`);
            let res = await this.favScreenService.checkIfPathIsFav(path, user);
            this.logger.debug(`Favourite Path Check Results : ${JSON.stringify(res)}`);
            if(!res){
                resp.status = false;
            }
            resp.data = res;
            resp.message = `
            Path :${path} is found to be user's favourite`;
        } catch (error) {
            this.logger.warn(`Checking Favourite Path Failed : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Delete Favourite Screen by Path' })
    @ApiCreatedResponse({
        description: 'Delete Favourite Screen by Path',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete')
    async deleteFavouriteScreenById(@Query('path') path: string, @UserData() user: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Favourite Screen with path : ${JSON.stringify(path)}`);
            let res = await this.favScreenService.deleteFavouriteScreen(path, user);
            this.logger.debug(`Deleted Favourite Screen : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            FavouriteScreen with path : ${JSON.stringify(path)} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Favourite Screen Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

//  Below methods were not used anywhere

    @ApiOperation({ summary: 'Get Favourite Screen by Id' })
    @ApiCreatedResponse({
        description: 'Get Favourite Screen by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:FavScreenId')
    async getFavouriteScreenById(@Param('FavScreenId', ParseIntPipe) FavScreenId: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Favourite Screen with id : ${FavScreenId}`);
            let res = await this.favScreenService.fetchFavouriteScreenById(FavScreenId);
            this.logger.debug(`Fetched Favourite Screen : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Favourite Screen with id : ${FavScreenId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Favourite Screen by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Favourite Screen by Id' })
    @ApiCreatedResponse({
        description: 'Update Favourite Screen by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:FavScreenId')
    async updateFavouriteScreenById(@Param('FavScreenId', ParseIntPipe) FavScreenId: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Favourite Screen with id : ${FavScreenId}`);
            let res = await this.favScreenService.updateFavouriteScreenById(FavScreenId, payload);
            this.logger.debug(`Updated Favourite Screen : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Favourite Screen with id : ${FavScreenId} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Favourite Screen Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }





    @ApiOperation({ summary: 'Search List of Favourite Screen' })
    @ApiCreatedResponse({
        description: 'Search List of Favourite Screen',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchFavouriteScreen(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.favScreenService.searchFavouriteScreen(searchData);
            this.logger.log(`Favourite Screen Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Favourite Screen Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Favourite Screen Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }
}
