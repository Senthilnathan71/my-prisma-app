import { Injectable } from '@nestjs/common';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class MergeBookingService {
    constructor(
        private _db: DatabaseService,
        private globalConfigService : GlobalConfigService
    ) { }

    async getAllBookings(payload: any){
        try {
            let whereClause = {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                DepartmentMasterSid : payload.DepartmentMasterSid,
                status: 'A'
            };
            if(payload.isFilteringRequired){
                whereClause['BookingStatus'] = "Cargo Received";
            } else {
                whereClause['BookingStatus'] = "Booked";
            }

            const allBookings = await this._db.bookingHeader.findMany({
                where: whereClause,
                include : {
                    bookingProduct: true
                },
                orderBy : {
                    BookingHeaderSid : 'desc'
                }
            })

            const enrichedItems = await Promise.all(
                allBookings.map(async (item) => {
                    const [salesman] = await Promise.all([

                        item.SalesmanSid !== null ?
                            this.globalConfigService.getMasterData('user_master', item.SalesmanSid) :
                            { UserMasterSid: null, userName: '' }
                    ])
                    return {
                        ...item,
                        salesman
                    }
                })
            )
            return enrichedItems;
        } catch (error) {
            throw error;
        }
    }

    async mergeBooking(payload: mergeDTO) {
        try {
            const { fromBookingSid, toBookingSid } = payload;
            const allBookingProducts = await this._db.bookingProduct.findMany({
                where: {
                    BookingHeaderSid: fromBookingSid
                }
            })
            const allProductSids = allBookingProducts.map(product => product.BookingProductSid);


            let allProducts: any[] = [];
            for (const productSid of allProductSids) {
                const ourProduct = await this._db.bookingProduct.findUnique({
                    where: {
                        BookingProductSid: productSid
                    }
                })
                const updatedProduct = await this._db.bookingProduct.update({
                    where: {
                        BookingProductSid: productSid
                    },
                    data: {
                        BookingHeaderSid: toBookingSid
                    }
                })
                allProducts.push(updatedProduct);
            }
            await this._db.bookingHeader.update({
                where: {
                    BookingHeaderSid: fromBookingSid
                },
                data: {
                    status : 'S'
                }
            })
            return allProducts;
        } catch (error) {
            throw error;
        }
    }
}
interface mergeDTO {
    fromBookingSid: number;
    toBookingSid: number;
}