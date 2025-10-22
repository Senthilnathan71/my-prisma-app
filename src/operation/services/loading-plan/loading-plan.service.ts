import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';
import { GlobalConfigService } from 'src/common/config/master-config.service';

@Injectable()
export class LoadingPlanService {
    constructor(
        private _db: DatabaseService,
        private globalConfigService: GlobalConfigService,
    ) { }

    async getAllAvailableBookings(payload :LoadingPlanDTO) {
        try {
            const dept = await this._db.departmentMaster.findUnique({
                where : {
                    DepartmentMasterSid : payload.DepartmentMasterSid
                }
            });
            if(!dept) throw new Error('Department not found');

            const isLCLExport = dept.FCLLCL === 'LCL' && dept.departmentType === "Sea" && dept.ExportImport === "Export";

            let whereClause : Prisma.BookingHeaderWhereInput = {};
            whereClause = {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                DepartmentMasterSid: payload.DepartmentMasterSid,
                POL: payload.POL,
                POD: payload.POD,
                MBLNo: null,
                MasterNoSid: null,
                status: 'A'
            }
            if(payload.VesselName){
                whereClause['VesselName'] = payload.VesselName;
            }
            if(payload.VoyageNo){
                whereClause['VoyageNo'] = payload.VoyageNo;
            }

            if(isLCLExport){
                whereClause['BookingStatus'] = "Cargo Received";
            } else {
                whereClause['BookingStatus'] = "Booked";
            }


            const availableBookings = await this._db.bookingHeader.findMany({
                where : whereClause,
                include : {
                    bookingCargo : true,
                    departmentMaster : {select : {departmentName : true}},
                    bookingRates : { where : {Status : 'A'}}
                },
                orderBy : {
                    BookingHeaderSid : 'desc'
                }
            })
            const enrichedBookings = await Promise.all(
                availableBookings.map(async booking => {
                    const salesman = booking.SalesmanSid ? await this.globalConfigService.getMasterData('user_master', booking.SalesmanSid) : {
                        UserMasterSid : null,
                        userName : ''
                    };
                    const totalCost = (booking.bookingRates || []).reduce((acc, curr) => {
                        const amount = curr.CostLocalAmount ? (curr.CostDrCr === "D" ? curr.CostLocalAmount.toNumber() : -curr.CostLocalAmount.toNumber()) : 0;
                        return acc + amount;
                    },0.0);
                    const totalRevenue = (booking.bookingRates || []).reduce((acc, curr) => {
                        const amount = curr.RevenueLocalAmount ? (curr.RevenueDrCr === "C" ? curr.RevenueLocalAmount.toNumber() : -curr.RevenueLocalAmount.toNumber()) : 0;
                        return acc + amount;
                    },0.0);


                    return {
                        BookingHeaderSid : booking.BookingHeaderSid,
                        BookingNo: booking.BookingNo,
                        BookingDate : booking.BookingDateTime,
                        DepartmentMasterSid : booking.DepartmentMasterSid,
                        departmentName : booking.departmentMaster?.departmentName,
                        HBLNo : booking.HBLNo,
                        CustomerMasterSid : booking.CustomerMasterSid,
                        CustomerName: booking.CustomerName,
                        CustomerAddress: booking.CustomerAddress,
                        SalesmanName: salesman?.userName,
                        ShipperName: booking.ShipperName,
                        ShipperAddress : booking.ShipperAddress,
                        ConsigneeName: booking.ConsigneeName,
                        ConsigneeAddress : booking.ConsigneeAddress,
                        DestinationAgent : booking.DestinationAgent,
                        MasterNoSid : booking.MasterNoSid,
                        MBLNo : booking.MBLNo,
                        MBLDate : booking.MBLDate,
                        FreightTerms : booking.FreightTerms,
                        POO: booking.POO,
                        POL: booking.POL,
                        POD: booking.POD,
                        FPD: booking.FPD,
                        VesselName : booking.VesselName,
                        VoyageNo : booking.VoyageNo,
                        ETD : booking.ETD,
                        ETA : booking.ETA,
                        VoyageMasterSid : booking.VoyageMasterSid,
                        NoOfPackage: booking.bookingCargo[0]?.NoOfPackage,
                        GrossWeight: booking.bookingCargo[0]?.GrossWeight,
                        NetWeight : booking.bookingCargo[0]?.NetWeight,
                        Volume: booking.bookingCargo[0]?.Volume,
                        CargoType : booking.bookingCargo[0]?.CargoType,
                        BookingStatus : booking.BookingStatus,
                        totalCost: totalCost.toFixed(2),
                        totalRevenue : totalRevenue.toFixed(2),
                    }
                })
            );
            return enrichedBookings;
        } catch (error) {
            throw error;
        }
    }

    async shiftBookingToHouse(allBookingIds: number[],masterJobInfo:any) {
        try {
            if(allBookingIds.length === 0) return [];
            return await this._db.$transaction(async (prisma) => {
            let allHouses: any[] = [];
            for (const bookingId of allBookingIds) {
                let fullHouseData: any;
                const booking = await prisma.bookingHeader.findUnique({
                    where: {
                        BookingHeaderSid: bookingId
                    },
                    include: {
                        bookingCargo: true,
                        bookingProduct: true,
                        bookingOthers: true,
                        bookingConnection: true,
                        bookingRates: true
                    }
                })
                if (!booking) {
                    throw new Error('Booking record your provided is not exists');
                } else {
                    
                    const headerData = booking;
                    const bookingCargo = headerData.bookingCargo[0] || null;
                    const bookingOthers = headerData.bookingOthers[0] || null;
                    const bookingProduct = headerData.bookingProduct || [];
                    const bookingConnection = headerData.bookingConnection || [];

                    console.log(headerData);
                    Object.keys(headerData).forEach(key => {
                        if(typeof headerData[key] ==='string'){
                        console.log(key+ " --> "+ headerData[key].length)
                        }
                    })
                    // const createdHouse = await prisma.houseJob.create({
                    //     data: {
                    //         CreatedBy: headerData.createdBy,
                    //         UpdatedBy: headerData.updatedBy,
                    //         MenuMasterSid: headerData.MenuMasterSid,
                    //         MasterJobSid : masterJobInfo.MasterJobSid,
                    //         CompanyMasterSid: headerData.CompanyMasterSid,
                    //         BranchMasterSid: headerData.BranchMasterSid!,
                    //         QuotationHeaderSid: headerData.QuotationHeaderSid || null,
                    //         DepartmentMasterSid: headerData.DepartmentMasterSid,
                    //         ShipmentNo: headerData.ShipmentNo || '',
                    //         BookingNo: headerData.BookingNo || '',
                    //         HBLNo: headerData.HBLNo || null,
                    //         CustomerMasterSid: headerData.CustomerMasterSid || null,
                    //         CustomerName: headerData.CustomerName || '',
                    //         CustomerAddress: headerData.CustomerAddress || '',
                    //         SalesmanSid: headerData.SalesmanSid,
                    //         // IncoTerms : headerData.IncoTerms!, // TODO: Uncomment this
                    //         FreightPPCC: headerData.FreightTerms || '',
                    //         DestinationAgent : headerData.DestinationAgent,
                    //         AgentName: headerData.AgentName || '',
                    //         AgentAddress: headerData.AgentAddress || '',
                    //         ShipperName: headerData.ShipperName || '',
                    //         ShipperAddress: headerData.ShipperAddress || '',
                    //         ConsigneeName: headerData.ConsigneeName || '',
                    //         ConsigneeAddress: headerData.ConsigneeAddress || '',
                    //         ShipmentType: headerData.ShipmentType || '',
                    //         NominatedBy: headerData.NominatedBy || '',
                    //         VoyageMasterSid: headerData.VoyageMasterSid || null,
                    //         VesselName: headerData.VesselName || '',
                    //         VoyageNo: headerData.VoyageNo || '',
                    //         POO: headerData.POO || '',
                    //         POL: headerData.POL || '',
                    //         POD: headerData.POD || '',
                    //         FPD: headerData.FPD || '',
                    //         TsPortSid: headerData.TsPortSid || null,
                    //         POLTerminal: headerData.POLTerminal || '',
                    //         PODTerminal: headerData.PODTerminal || '',
                    //         ETD: headerData.ETD || null,
                    //         ETA: headerData.ETA || null,
                    //         Coload: headerData.Coload || '',
                    //         CoLoader: bookingOthers.Coloader || '',
                    //         BLLocation: headerData.BLLocation || null,
                    //         ClearanceRequire: headerData.ClearanceRequire || '',
                    //         MovementType: headerData.MovementType || '',
                    //         DoValidity: headerData.DoValid ? new Date(headerData.DoValid) : null,
                    //         IsServiceJob: headerData.IsServiceJob || '',
                    //     }
                    // })
                    // const houseJobCargo = await prisma.houseJobCargo.create({
                    //     data : {
                    //         HouseJobSid : createdHouse.HouseJobSid,
                    //         CreatedBy : bookingCargo.createdBy,
                    //         UpdatedBy : bookingCargo.updatedBy || null,
                    //         Status : 'A',
                    //         CompanyMasterSid : bookingCargo.CompanyMasterSid,
                    //         BranchMasterSid : bookingCargo.BranchMasterSid!,
                    //         CargoType : bookingCargo.CargoType,
                    //         // ContainerType : bookingCargo.ContainerType, // TODO: Uncomment this
                    //         GrossWeight : bookingCargo.GrossWeight || 0,
                    //         NetWeight : bookingCargo.NetWeight || 0,
                    //         Volume : bookingCargo.Volume || 0,
                    //         ChargeableWeight : bookingCargo.ChargeableWeight || 0,
                    //         // PackageType : bookingCargo.pkgType || ,
                    //         NoOfPackage : bookingCargo.NoOfPackage || 0,
                    //         FreightAmount : bookingCargo.FreightAmount || 0,
                    //         WeightUnit : bookingCargo.WeightUnitSid || null,
                    //         ShipmentTerms : bookingCargo.ShipmentTerms || '',
                    //     }
                    // })
                    let houseJobProducts;
                    // if(bookingProduct.length > 0) {
                    //     const allProducts: any[] = (bookingProduct || []).map(product => {
                    //         const productData = {
                    //             HouseJobSid : createdHouse.HouseJobSid,
                    //             ProductName : product.ProductName || '',
                    //             ShippingBillNo : product.ShippingBillNo || '',
                    //             ShippingBillDate : product.ShippingBillDate || '',
                    //             ProductDescription : product.ProductDescription || '',
                    //             // ExternaPkg : product.ExternaPkg || '',
                    //             // ExternlQty : product.ExternlQty || '',
                    //             GrossWeight : product.GrossWeight || 0,
                    //             NetWeight : product.NetWeight || 0,
                    //             Volume : product.Volume || 0,
                    //             CreatedBy : product.createdBy,
                    //             UpdatedBy : product.updatedBy || null,
                    //         }
                    //         return productData;
                    //     })
                    //     houseJobProducts = await prisma.houseJobProduct.createMany({
                    //         data : allProducts
                    //     });
                    // }

                    let houseJobConnections;
                    // if(bookingConnection.length > 0) {
                    //     const allConnections: any[] = (bookingConnection || []).map(connection => {
                    //         const connectionData  = {
                    //             HouseJobSid : createdHouse.HouseJobSid,
                    //             Mode : connection.Mode,
                    //             POL : connection.POL,
                    //             POD : connection.POD,
                    //             VesselName : connection.VesselName,
                    //             VoyageNo : connection.VoyageNo,
                    //             ETD : connection.ETD ? new Date(connection.ETD) : null,
                    //             ETA : connection.ETA ? new Date(connection.ETA) : null,
                    //             Remarks : connection.Remarks || '',
                    //             CreatedBy : connection.createdBy,
                    //             UpdatedBy : connection.updatedBy || null,
                    //         }
                    //         return connectionData;
                    //     })
                    //     houseJobConnections = await prisma.houseJobConnection.createMany({
                    //         data : allConnections
                    //     });
                    // }

                    // const houseJobOthers = await prisma.houseJobOthers.create({
                    //     data : {
                    //         HouseJobSid : createdHouse.HouseJobSid,
                    //         CustomerRefNo : bookingOthers.CustomerRefNo || '',
                    //         OperationUser : bookingOthers.OperationUser || '',
                    //         DocumentationUser : bookingOthers.DocumentationUser || '',
                    //         CustomerServiceuser : bookingOthers.CustomerServiceuser || '',
                    //         NotifyParty : bookingOthers.NotifyParty || '',
                    //         NotifyPartyAddress : bookingOthers.NotifyPartyAddress || '',
                    //         CHAName : bookingOthers.CHAName || '',
                    //         PickupMode : bookingOthers.PickupMode || '',
                    //         YardCFS : bookingOthers.YardCFS || '',
                    //         LocalTransport : bookingOthers.LocalTransport || '',
                    //         OverseasTransport : bookingOthers.OverseasTransport || '',
                    //         OverseasClearance : bookingOthers.OverseasClearance || '',
                    //         PickupPlace : bookingOthers.PickupPlace || '',
                    //         PickupDate : bookingOthers.PickupDate || null,
                    //         PickupAddress : bookingOthers.PickupAddress || '',
                    //         DeliveryPlace : bookingOthers.DeliveryPlace || '',
                    //         DeliveryDate : bookingOthers.DeliveryDate || null,
                    //         DeliveryAddress : bookingOthers.DeliveryAddress || '',
                    //         CargoCurrency : bookingOthers.CargoCurrency || '',
                    //         CargoValue : bookingOthers.CargoValue || 0,
                    //         DeliveryMode : bookingOthers.DeliveryMode || '',
                    //         ExternalRemarks : bookingOthers.ExternalRemarks || '',
                    //         GeneralNote : headerData.GeneralNote || '',
                    //         SwitchBL : bookingOthers.SwitchBL || '',
                    //         TransporterName : bookingOthers.TransporterName || '',
                    //         CreatedBy : bookingOthers.createdBy,
                    //         UpdatedBy : bookingOthers.updatedBy || null,
                    //         Coload : headerData.Coload || '',
                    //         CoLoader : bookingOthers.Coloader || '',
                    //         NominatedBy : headerData.NominatedBy || ''
                    //     }
                    // });

                    const dateString = moment().format('YYYYMMDD')
                    const count = await prisma.houseJob.count({
                        where: {
                            BookingNo: {
                                contains: dateString
                            }
                        }
                    })
                    const hblNo = `HOUSE-${dateString}-${(count + 1).toString().padStart(3, '0')}`
                    const updatedBooking = await prisma.bookingHeader.update({
                        where: { BookingHeaderSid: bookingId },
                        data: {
                            HBLNo : hblNo,
                            MasterNoSid : masterJobInfo.MasterJobSid,
                            MBLNo : masterJobInfo.MBLNo,
                            MBLDate : masterJobInfo.MBLDate,
                            VesselName : masterJobInfo.VesselName,
                            BookingStatus : 'Stuffed'
                        }
                    });

                    fullHouseData = {
                        // ...createdHouse,
                        // houseJobCargo,
                        houseJobProducts,
                        houseJobConnections,
                        // houseJobOthers,
                        updatedBooking
                    }
                }
                allHouses.push(fullHouseData);
            }
            return allHouses;
        });
        } catch (error) {
            throw error;
        }
    }

    async getAllVesselWithVoyage(payload: VesselVoyageDTO) {
        const { POL, POD } = payload;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // First find voyages that have both POL and POD
        const voyagesWithBothPorts = await this._db.voyageMasterHeader.findMany({
            where: {
                status: 'A',
                ETD : { gte : today },
                VoyageType: 'Sea',
                AND: [
                    { POLSid :  POL },
                    { PODSid :  POD }
                ]
            },
            include: {
                vesselMaster : { select : {VesselName : true}}
            }
        });

        const validVoyages = voyagesWithBothPorts.map(voy => {
            return {
                VoyageMasterSid : voy.VoyageMasterHeaderSid,
                VesselName: voy.vesselMaster?.VesselName,
                VoyageNo: voy.VoyageNo,
                POL: voy.POLSid,
                POD: voy.POLSid,
                PortCutoff : voy.PortCutoff,
                ETD: voy.ETD,
                ETA: voy.ETA
            }
        });

        return validVoyages;
    }


}
interface LoadingPlanDTO {
    CompanyMasterSid : number,
    BranchMasterSid : number,
    DepartmentMasterSid : number,
    POL : string,
    POD : string,
    VesselName : string,
    VoyageNo : string,
}
interface VesselVoyageDTO {
    POL : number,
    POD : number,
    segment : 'Sea' | 'Air' | 'Road'
}