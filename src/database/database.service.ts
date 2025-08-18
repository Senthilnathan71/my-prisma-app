import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {

    constructor() {
        super({
            transactionOptions: {
                timeout: 18000,  // 3minutes
                maxWait: 12000  // 2minutes
            }
        })
    }

    async onModuleInit() {
        await this.$connect()

        // this.$use(async(params,next)=>{a
        //     if(['findMany', 'findFirst','findUnique'].includes(params.action)){
        //         if(params.args?.where?.__includeDeleted){
        //             delete params.args.where.__includeDeleted
        //             return next(params)
        //         }

        //         if(params.args?.where){
        //             params.args.where = {
        //                 ...params.args.where,
        //                 deletedAt: params.args?.where?.deletedAt ?? null,
        //             };
        //         }
        //         else{
        //             params.args = {
        //                 ...params.args,
        //                 where:{
        //                     deleted:null
        //                 }
        //             };
        //         }
        //     }
        //     return next(params)
        // }
        // )
    }
}