import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Logger, NotAcceptableException, NotFoundException, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse, ApiBody } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { ShortcutService } from './shortcut.service';
import { ShortcutDto, ShortCutUpdateDto } from './shortcutCreate.dto';
import { TokenPayload } from 'src/common/decorators/token-payload.decorator';
import { Prisma, PrismaClient } from '@prisma/client';

@Controller('shortcut')
@Auth()
export class ShortcutController {
    constructor(private shortCutService: ShortcutService, private logger: Logger) { }
    
        @ApiOperation({ summary: 'shortcut Creation' })
        @ApiCreatedResponse({
            description: 'shortcut Creation',
            type: ResponseData
        })
        @ApiBody({type: Prisma['ShortCutCreateInput']})
        @HttpCode(HttpStatus.CREATED)
        @Post('create')
        async createShortcut(@Body() body:ShortcutDto, @TokenPayload() token) {
            this.logger.log(`createShortcutdata: ${JSON.stringify(body)}`)
            if(!token) throw new ForbiddenException('No token provided')
            console.log(token)
            if(!Object.keys(token).includes('id')) throw new BadRequestException('Token payload does not have id')

            let output = new ResponseData

            const payload :Prisma.ShortCutCreateInput = {
                ...body,
                userMaster:{
                    connect:{
                        UserMasterSid:token.id
                    }
                }
            }
            try {
                let existShortCut = await this.shortCutService.findOne({
                    where:{
                        label: body.label,
                        userId: token.id
                    }
                })

                if(existShortCut){
                    output.message = "Shortcut Already Exists"
                }

                let shortcut = await this.shortCutService.createShortCut(payload);
                if (!shortcut) {
                    this.logger.warn(`createShortcut!!: ${JSON.stringify(shortcut)}`)
                    throw 'Something went wrong'
                }
                output.data = shortcut
                output.message = 'shortcut Created Successfully'
                return output
            } catch (error) {
                throw error
            }
        }
    



        @ApiOperation({ summary: 'shortcut Creation' })
        @ApiCreatedResponse({
            description: 'shortcut Creation',
            type: ResponseData
        })
        @ApiBody({type: Prisma['ShortCutCreateManyInput']})
        @HttpCode(HttpStatus.CREATED)
        @Post('bulk-create')
        async bulkCreateShortcut(@Body() body:ShortcutDto[], @TokenPayload() token) {
            this.logger.log(`createShortcutdata: ${JSON.stringify(body)}`)
            if(!token) throw new ForbiddenException('No token provided')
            
            if(!Object.keys(token).includes('id')) throw new BadRequestException('Token payload does not have id')

            let output = new ResponseData

            let mappedDto: Prisma.ShortCutCreateManyInput[]

            if(body instanceof Array)
                mappedDto = body.map((item:ShortcutDto)=>({...item, userId:token.id}))
            else{
                output.message = "Body payload Should be an array"
                throw new BadRequestException(output.message)
            }

            try {
                for(let shortcut of mappedDto){
                    let existShortCut = await this.shortCutService.findOne({
                        where:{
                            label: shortcut['label'],
                            userId: shortcut['userId']
                        }
                    })
    
                    if(existShortCut){
                        output.message = `${shortcut['label']} Shortcut Already Exists`
                        throw new NotAcceptableException(output.message)
                    }
                }

                let shortcut = await this.shortCutService.createShortCut(mappedDto);
                if (!shortcut) {
                    this.logger.warn(`createShortcut!!: ${JSON.stringify(shortcut)}`)
                    throw 'Something went wrong'
                }
                output.data = shortcut
                output.message = 'shortcut Created Successfully'
                return output
            } catch (error) {
                throw error
            }
        }
    
        @ApiOperation({ summary: 'Get All Shortcut' })
        @ApiCreatedResponse({
            description: 'Get All Shortcuts',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Get()
        async getAllShortcuts(@TokenPayload() token) {
            if(!token) throw new ForbiddenException('No token provided')
            
            if(!Object.keys(token).includes('id')) throw new BadRequestException('Token payload does not have id')
            let output = new ResponseData;
            try {
                let shortcutData = await this.shortCutService.getAllShortCuts({
                    where:{
                        userId: token.id
                    }
                });
                this.logger.log(`getAllShortcuts: ${JSON.stringify(shortcutData)}`)

                if(shortcutData && (shortcutData instanceof Array) && (shortcutData.length ==0)){
                    output.message = "No ShortCuts Yet."
                    throw new NotFoundException(output.message)
                }
                output.data = shortcutData;
                return output
            } catch (error) {
                throw error
            }
        }
    
    
    
    
        @ApiOperation({ summary: 'Update ShortCut By Id' })
        @ApiCreatedResponse({
            description: 'Update ShortCut By Id',
            type: ResponseData
        })
        @ApiBody({type: Prisma['ShortCutUpdateInput']})
        @HttpCode(HttpStatus.OK)
        @Patch('update/:id')
        async editShortCut(@Param('id', ParseIntPipe) id: number, @Body() body: ShortCutUpdateDto, @TokenPayload() token) {
            if(!token) throw new ForbiddenException('No token provided')
            
            if(!Object.keys(token).includes('id')) throw new BadRequestException('Token payload does not have id')
            let output = new ResponseData;
            try {
                let existShortcut = await this.shortCutService.findUniqueShortcut(id)
                if(!existShortcut){
                    output.message = `Shortcut with id ${id} not found.`
                    throw new NotFoundException(output.message)
                }

                if(existShortcut.label != body.label){
                    let data = await this.shortCutService.findOne({
                        where:{
                            label: body.label,
                            userId: token.id
                        }
                    })
                    if(data){
                        output.message = "Shortcut already exists"
                        throw new NotAcceptableException(output.message)
                    }
                }

                const query: Prisma.ShortCutWhereUniqueInput = {
                    shortCutId:Number(id)
                }

                const shortcut = await this.shortCutService.updateShortcut(query, body)

                output.data = shortcut;
                output.message = 'shortcut Updated Successfully'
                return output
            } catch (error) {
                this.logger.error(`editshortcutmessage: ${output.message}`)
                throw error
            }
        }
    
    
    
        @ApiOperation({ summary: 'Delete Shortcut By Id' })
        @ApiCreatedResponse({
            description: 'Delete Shortcut By Id',
            type: ResponseData
        })
        @HttpCode(HttpStatus.ACCEPTED)
        @Delete('delete/:id')
        async softDelete(@Param('id', ParseIntPipe) id: number) {
            const output = new ResponseData()
            try {
                let existShortCut = await this.shortCutService.findUniqueShortcut(id)

                if(!existShortCut){
                    output.message = `Shortcut with id ${id} not found.`
                    throw new NotFoundException(output.message)
                }

                const data = await this.shortCutService.deleteShortcut({where:{shortCutId: +id}})
                output.message = "Delete Success"
                output.data = data
                return output
            } catch (error) {
                throw error   
            }
        }
}
