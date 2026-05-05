import { Controller, Get, Header, HttpCode, HttpStatus, Logger, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { checkIfFileExists } from 'src/common/helper';
import { ResponseData } from 'src/common/response-data';
import { UserService } from 'src/masters/services/user.service';
import { resourceLimits } from 'worker_threads';
@Auth()
@Controller('user')
export class UserController {

    constructor(private userService: UserService,
        private logger: Logger,
        private configService : ConfigService
    ) { }

    @ApiOperation({ summary: 'Get user Token from data' })
    @ApiCreatedResponse({
        description: 'Get user token from data',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('sign-in-token')
    async getUserByToken(@UserData() user: any): Promise<any> {

        const output = new ResponseData();
        try {
            const result = await this.userService.getUserData(user);
            console.log(result)
            this.logger.debug(`getUserByToken: ${JSON.stringify(result)}`)
            output.data = result
            output.message = "All UserData are successfully fetched";
        } catch (error) {
            this.logger.warn(`getUserByToken: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = typeof error == 'string' ? error : ''
        }
        return output;
    }

    @Get('logo/:logoId')
    @Header('Cache-Control', 'no-store')
    @Header('Content-Disposition', 'inline')
    async getCompanyLogo(
        @Param('logoId') logoId: string,
        @Res({ passthrough: true }) res: any,
    ): Promise<StreamableFile> {
        const uploadPath = this.configService.get<string>('UPLOAD_IMAGE_PATH');
        if (!uploadPath) {
            throw new Error('UPLOAD_IMAGE_PATH not configured');
        }
        const extensions = ['', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
        let filePath: string | null = null;

        for (const ext of extensions) {
            const tryPath = join(uploadPath, logoId + ext);
            if (existsSync(tryPath)) {
                filePath = tryPath;
                break;
            }
        }
        if (!filePath) {
            throw new NotFoundException('Logo not found');
        }
        const ext = filePath.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            webp: 'image/webp',
        };
        res.setHeader('Content-Type', mimeTypes[ext || 'png'] || 'application/octet-stream');
        const fileStream = createReadStream(filePath);
        return new StreamableFile(fileStream);
    }


    @ApiOperation({ summary: 'Get salesperson' })
    @ApiCreatedResponse({
        description: 'Get salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('salesperson')
    async getSalesPerson(@UserData() user: any): Promise<any> {
        const output = new ResponseData();
        try {
            const salesPerson = await this.userService.getSalesPerson();
            this.logger.debug(`getSalesPerson: ${JSON.stringify(salesPerson)}`)
            output.data = salesPerson
            output.message = "All Salesperson are successfully fetched";
        } catch (error) {
            this.logger.debug(`getSalesPerson: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = typeof error == 'string' ? error : ''
        }
        return output
    }
}
