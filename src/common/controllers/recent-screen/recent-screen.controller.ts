import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { RecentScreenService } from 'src/common/services/recent-screen/recent-screen.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';


@Controller('recent-screen')
@Auth()
export class RecentScreenController {
    constructor(private recentScreenService: RecentScreenService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get All Recent Screen' })
    @ApiCreatedResponse({
        description: 'Get All Recent Screen',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllRecentScreen(@UserData() user: any) {
    let resp = new ResponseData();
    try {
      let res = await this.recentScreenService.getAllRecentScreen(user);
      this.logger.log(`All Recent Screen Fetched : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = "All Recent Screen are successfully fetched";
    } catch (error) {
      this.logger.warn(`Get All Recent Screen Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      resp.message = error.message || "Internal Server Error";
    }
    return resp;
  }

    @ApiOperation({ summary: 'Create new Recent Screen' })
    @ApiCreatedResponse({
        description: 'Create new Recent Screen',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createNewRecentScreen(@Body() newData: { path: string; screenName: string }, @UserData() user: any) {
    let resp = new ResponseData();
    try {
      let res = await this.recentScreenService.createNewRecentScreen(newData, user);
      this.logger.log(`New Recent Screen Created : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = "New Recent Screen is successfully created";
    } catch (error) {
      this.logger.warn(`Recent Screen Creation Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      resp.message = error.message || "Internal Server Error";
    }
    return resp;
  }

  // Below methods were not used anywhere

    @ApiOperation({ summary: 'Get Recent Screen by Id' })
    @ApiCreatedResponse({
        description: 'Get Recent Screen by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:RecentScreenId')
    async getRecentScreenById(@Param('RecentScreenId', ParseIntPipe) RecentScreenId: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Recent Screen with id : ${RecentScreenId}`);
            let res = await this.recentScreenService.fetchRecentScreenById(RecentScreenId);
            this.logger.debug(`Fetched Recent Screen : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Recent Screen with id : ${RecentScreenId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Recent Screen by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Recent Screen by Id' })
    @ApiCreatedResponse({
        description: 'Update Recent Screen by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:RecentScreenId')
    async updateRecentScreenById(@Param('RecentScreenId', ParseIntPipe) RecentScreenId: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Recent Screen with id : ${RecentScreenId}`);
            let res = await this.recentScreenService.updateRecentScreenById(RecentScreenId, payload);
            this.logger.debug(`Updated Recent Screen : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Recent Screen with id : ${RecentScreenId} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Recent Screen Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Recent Screen by Id' })
    @ApiCreatedResponse({
        description: 'Delete Recent Screen by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:RecentScreenId')
    async deleteRecentScreenById(@Param('RecentScreenId', ParseIntPipe) RecentScreenId: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Recent Screen with id : ${RecentScreenId}`);
            let res = await this.recentScreenService.deleteRecentScreen(RecentScreenId);
            this.logger.debug(`Deleted Recent Screen : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            Recent Screen with id : ${RecentScreenId} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Recent Screen Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Recent Screen' })
    @ApiCreatedResponse({
        description: 'Search List of Recent Screen',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchRecentScreen(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.recentScreenService.searchRecentScreen(searchData);
            this.logger.log(`Recent Screen Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Recent Screen Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Recent Screen Search Error : ${JSON.stringify(error), error}`);
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
