import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { FetchExchangeRate } from 'src/masters/DTO/currency-exchange.dto';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

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
                    status: 'A',
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
            if (existing.status === 'D') {
                throw new BadRequestException(`Currency Exchange with id : ${CurrencyExchangeSid} is already deleted`);
            }
            const deletedCurrencyEx = await this._db.currencyExchange.update({
                where: {
                    CurrencyExchangeSid: CurrencyExchangeSid
                },
                data: {
                    status: 'D'
                }
            })
            return deletedCurrencyEx;
        } catch (error) {
            throw error;
        }
    }



    async searchCurrencyExchange(params: filterDto) {

        const {
            search = '',
            page = 1,
            pageSize = 15,
            activeCompanyId,
            activeBranchId,
            dateFrom,
            DateFrom,
            dateTo,
            DateTo,
            dateField,
            DateField,
            FromCurrency,
            fromCurrency,
            ToCurrency,
            toCurrency
        } = params as any;
        const skip = (page - 1) * pageSize;
        const resolvedDateFrom = dateFrom ?? DateFrom;
        const resolvedDateTo = dateTo ?? DateTo;
        const rawDateField = (dateField ?? DateField ?? '').toString();
        const allowedDateFields = ['EffectiveFrom'];
        const selectedDateField = allowedDateFields.includes(rawDateField) ? rawDateField : 'EffectiveFrom';
        const parsedDateFrom = resolvedDateFrom ? new Date(resolvedDateFrom) : null;
        const parsedDateTo = resolvedDateTo ? new Date(resolvedDateTo) : null;
        const normalizedDateFrom = parsedDateFrom && !Number.isNaN(parsedDateFrom.getTime()) ? parsedDateFrom : null;
        const normalizedDateTo = parsedDateTo && !Number.isNaN(parsedDateTo.getTime()) ? parsedDateTo : null;
        const normalizedFromCurrency = (FromCurrency ?? fromCurrency ?? '').toString().trim();
        const normalizedToCurrency = (ToCurrency ?? toCurrency ?? '').toString().trim();

        const where: Prisma.CurrencyExchangeWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(normalizedFromCurrency && { FromCurrency: normalizedFromCurrency }),
            ...(normalizedToCurrency && { ToCurrency: normalizedToCurrency }),
            ...((normalizedDateFrom || normalizedDateTo) && {
                [selectedDateField]: {
                    ...(normalizedDateFrom && { gte: normalizedDateFrom }),
                    ...(normalizedDateTo && { lte: normalizedDateTo })
                }
            }),
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
                orderBy: { EffectiveFrom: 'desc' },
            }),
            this._db.currencyExchange.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }

    async getExchangeRate(payload: FetchExchangeRate) {

        try {
            const whereClause : Prisma.CurrencyExchangeWhereInput = {
                CompanyMasterSid : payload.CompanyMasterSid,
                BranchMasterSid : payload.BranchMasterSid,
                FromCurrency: payload.fromCurrencyCode,
                ToCurrency: payload.toCurrencyCode,
                status: 'A'
            }

            // Build a UTC midnight date to avoid timezone shifts when comparing against DATE columns.
            // e.g., IST 3:00 AM on Feb 20 → new Date() → Feb 19 21:30 UTC → misses Feb 20 records.
            const effectiveDate = payload.EffectiveFrom ? new Date(payload.EffectiveFrom) : new Date();
            const utcDateOnly = new Date(Date.UTC(effectiveDate.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate()));
            whereClause.EffectiveFrom = { lte: utcDateOnly };

            const exchangeRate = await this._db.currencyExchange.findFirst({
                where: whereClause,
                orderBy: [
                    { EffectiveFrom: 'desc' },
                    { CurrencyExchangeSid: 'desc' }
                ]
            })

            if(!exchangeRate){
                console.error('Exchange rate not found');
                return null;
            }

            if(payload.segment === 'cost'){
                return exchangeRate?.BuyRate || null;
            }
            else{
                return exchangeRate?.SellRate || null;
            }
            
        } catch (error) {
            throw error;
        }


    }
}
