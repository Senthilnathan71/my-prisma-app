import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {
    async onModuleInit() {
        await this.$connect()

        this.$use(async(params,next)=>{
            if(['findMany', 'findFirst','findUnique'].includes(params.action)){
                if(params.args?.where?.__includeDeleted){
                    delete params.args.where.__includeDeleted
                    return next(params)
                }

                if(params.args?.where){
                    params.args.where = {
                        ...params.args.where,
                        deletedAt: params.args?.where?.deletedAt ?? null,
                    };
                }else{
                    params.args = {
                        ...params.args,
                        where:{
                            deleted:null
                        }
                    };
                }
            }
            return next(params)
        })
    }
}