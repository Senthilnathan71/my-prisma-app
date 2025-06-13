import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

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


    async getAllCurrencyEx() {
        try {
            const allCurrencyEx = await this._db.currencyExchange.findMany({
                where: {
                    deletedAt: null
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



    async searchCurrencyExchange(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "EffectiveFrom",
            "FromCurrency",
            "ToCurrency",
            "SellRate",
            "BuyRate",
            "BankName",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        const searchResults = await this._db.currencyExchange.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                },
                deletedAt:null
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${JSON.stringify(err)}`);
        })
        return searchResults;
    }
}
