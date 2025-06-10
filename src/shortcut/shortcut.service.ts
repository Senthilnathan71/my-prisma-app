import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ShortcutService {
    constructor(private _db: DatabaseService, private logger: Logger) { }
    
    
        async createShortCut(payload: Prisma.ShortCutCreateInput | Prisma.ShortCutCreateManyInput[]) {    
            if(payload instanceof Array){
                //Bulk Create
                try {
                    const shortcut = await this._db.shortCut.createMany({
                        data: payload
                    });
                    this.logger.debug(`ShortcutService: createShortCut ${JSON.stringify(shortcut)}`)
                    return shortcut;
                } catch (error) {
                    this.logger.debug(`ShortcutService: createShortCut ${JSON.stringify(error)}`)
                    throw new InternalServerErrorException(`Error creating shortcut: ${error.message}`);
                }
            }else{
                //single create
                 try {
                    const shortcut = await this._db.shortCut.create({
                        data: payload
                    });
                    this.logger.debug(`ShortcutService: createShortCut ${JSON.stringify(shortcut)}`)
                    return shortcut;
                } catch (error) {
                    this.logger.debug(`ShortcutService: createShortCut ${JSON.stringify(error)}`)
                    throw new InternalServerErrorException(`Error creating shortcut: ${error.message}`);
                }
            }
    
        }
    
    
        async getAllShortCuts(query?) {
            try {
                const shortcutList = await this._db.shortCut.findMany(query)
                return shortcutList;
            } catch (error) {
                throw new InternalServerErrorException(`Error getAllShortCuts: ${error.message}`);
            }
        }
    
    
    
        async findUniqueShortcut(query) {
            try {
                const shortcut = await this._db.shortCut.findUnique(query)
                return shortcut
            } catch (error) {
                throw new InternalServerErrorException(`Error findUniqueShortcut: ${error.message}`);
            }
        }

        async findOne(query) {
            try {
                const shortcut = await this._db.shortCut.findFirst(query)
                return shortcut
            } catch (error) {
                throw new InternalServerErrorException(`Error findOne: ${error.message}`);
            }
        }
    
    
        async updateShortcut(query: Prisma.ShortCutWhereUniqueInput, ShortCutUpdateDto: Prisma.ShortCutUpdateInput) {
            try {
                const shortcut = await this._db.shortCut.update({
                    where:query, data: ShortCutUpdateDto
                });
                return shortcut;
            } catch (error) {
                throw new InternalServerErrorException(`Error updateShortcut: ${error.message}`);
            }
        }
    
    
    
    
        async deleteShortcut(query: Prisma.ShortCutDeleteArgs) {
           try {
            const data = await this._db.shortCut.delete(query)
            return data
           } catch (error) {
                throw new InternalServerErrorException(`Error deleteShortcut: ${error.message}`);
           }
        }

        async deleteManyShortcut(query: Prisma.ShortCutDeleteManyArgs) {
           try {
            const data = await this._db.shortCut.deleteMany(query)
            return data
           } catch (error) {
                throw new InternalServerErrorException(`Error deleteManyShortcut: ${error.message}`);
           }
        }
}
