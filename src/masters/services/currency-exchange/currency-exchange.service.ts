import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CurrencyExchangeService {
    constructor(private _db: DatabaseService) { }

    async createNewCurrencyEx(newData: any) {
        try {
            const newlyCreatedCurrencyEx = await this._db.currencyExchange.create({
                data: {
                    ...newData,
                }
            })
            return newlyCreatedCurrencyEx;
        } catch (error) {
            throw error;
        }
    }


    async getAllCurrencyEx(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const allCurrencyEx = await this._db.currencyExchange.findMany({
                where: {
                    deletedAt: null,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                }
            })
            return allCurrencyEx;
        } catch (error) {
            throw error;
        }
    }


    async getCurrencyExById(CurrencyExchangeSid: number) {
        try {
            const ourCurrencyEx = await this._db.currencyExchange.findUnique({
                where: {
                    CurrencyExchangeSid: CurrencyExchangeSid
                }
            })
            if (!ourCurrencyEx) {
                throw new BadRequestException(`Currency Exchange with id : ${CurrencyExchangeSid} not exists`);
            }
            return ourCurrencyEx;
        } catch (error) {
            throw error;
        }
    }


    async updateCurrencyExById(CurrencyExchangeSid: number, updateData: any) {
        try {
            const existing = await this._db.currencyExchange.findUnique({
                where: {
                    CurrencyExchangeSid: CurrencyExchangeSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Currency Exchange with id : ${CurrencyExchangeSid} not exists`);
            }
            const updatedCurrencyEx = await this._db.currencyExchange.update({
                where: {
                    CurrencyExchangeSid: CurrencyExchangeSid
                },
                data: updateData
            })
            return updatedCurrencyEx;
        } catch (error) {
            throw error;
        }
    }


    async deleteCurrencyExById(CurrencyExchangeSid: number) {
        try {
            const existing = await this._db.currencyExchange.findUnique({
                where: {
                    CurrencyExchangeSid: CurrencyExchangeSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Currency Exchange with id : ${CurrencyExchangeSid} not exists`);
            }
            if (existing.deletedAt) {
                throw new BadRequestException(`Currency Exchange with id : ${CurrencyExchangeSid} is already deleted`);
            }
            const deletedCurrencyEx = await this._db.currencyExchange.update({
                where: {
                    CurrencyExchangeSid: CurrencyExchangeSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedCurrencyEx;
        } catch (error) {
            throw error;
        }
    }



    async searchCurrencyExchange(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 ,activeCompanyId,activeBranchId} = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CurrencyExchangeWhereInput = {
        deletedAt: null,
        status: 'A',
        CompanyMasterSid : activeCompanyId,
        BranchMasterSid: activeBranchId,
        ...(search
            ? {
                OR: [
                    // { EffectiveFrom: { contains: search, mode: 'insensitive' } },
                    { FromCurrency: { contains: search, mode: 'insensitive' } },
                    { ToCurrency: { contains: search, mode: 'insensitive' } },
                    // { SellRate: { contains: search, mode: 'insensitive' } },
                    // { BuyRate: { contains: search, mode: 'insensitive' } },
                    { BankName: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.currencyExchange.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { CurrencyExchangeSid: 'desc' },
        }),
        this._db.currencyExchange.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}

    async getExchangeRate(payload: any) {

        try {
            const fromCurrency = payload.fromCurrencyCode;
            const toCurrency = payload.toCurrencyCode;

            const directRecord = await this._db.currencyExchange.findFirst({
                where : {
                    FromCurrency : fromCurrency,
                    ToCurrency : toCurrency,
                    deletedAt : null,
                    status : 'A'
                }
            })
            if(directRecord){
                return directRecord.BuyRate;
            }
            
            const inverseRecord = await this._db.currencyExchange.findFirst({
                where : {
                    FromCurrency : toCurrency,
                    ToCurrency : fromCurrency,
                    deletedAt : null,
                    status : 'A'
                }
            })
            if(inverseRecord){
                return inverseRecord.SellRate;
            }

            return null;

        } catch (error) {
            throw error;
        }


    }
}
