import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EnquiryHeaderService {
    constructor(
        // @InjectModel(CityMaster)
        // private readonly cityMaster : typeof CityMaster
        private _db: DatabaseService
    ) { }


    // async createEnquiry(payload, user) {
    //     try {
    //         const enquiryHeaderPayload: any = {
    //             CustomerName: payload.CustomerName,
    //             ShipmentExpectedDate: payload.ShipmentExpectedDate,
    //             ShipmentType: payload.ShipmentType,
    //             status: payload.status || "A",
    //             CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
    //             BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
    //             DepartmentMasterSid: payload.DepartmentMasterSid,
    //             CustomerMasterSid: payload.CustomerMasterSid,
    //             UserMasterSid: user['userBranchMaster'][0].UserMasterSid
    //         }
    //         const enquiryHeader = await this._db.enquiryHeader.create({
    //             data: enquiryHeaderPayload
    //         })

    //         const enquiryRoutePayload: any = {
    //             PORSid: payload.PORSid,
    //             POLSid: payload.POLSid,
    //             PODSid: payload.PODSid,
    //             FDPSid: payload.FDPSid,
    //             CompanyMasterSid: enquiryHeader.CompanyMasterSid,
    //             BranchMasterSid: enquiryHeader.BranchMasterSid,
    //             EnquiryHeaderSid: enquiryHeader.EnquiryHeaderSid
    //         }

    //         const enquiryRoute = await this._db.enquiryRoute.create({
    //             data: enquiryRoutePayload
    //         })

    //         const enquiryCargoPayload: any = {
    //             CompanyMasterSid: enquiryRoute.CompanyMasterSid,
    //             BranchMasterSid: enquiryRoute.BranchMasterSid,
    //             EnquiryHeaderSid: enquiryRoute.EnquiryHeaderSid,
    //             EnquiryRouteSid: enquiryRoute.EnquiryRouteSid,
    //             CargoType: payload.CargoType,
    //             GrossWeight: payload.GrossWeight,
    //             Volume: payload.Volume
    //         }

    //         const enquiryCargo = await this._db.enquiryCargo.create({
    //             data: enquiryCargoPayload
    //         })
    //         return { message: 'Enquiry created successfully', data: { enquiryHeader: enquiryHeader, enquiryRoute: enquiryRoute, enquiryCargo: enquiryCargo } }
    //     } catch (error) {
    //         throw error
    //     }
    // }



    async createEnquiry(payload, user) {
        try {
            return await this._db.$transaction(async (prisma) => {
                const enquiryHeaderPayload: any = {
                    CustomerName: payload.CustomerName,
                    ShipmentExpectedDate: payload.ShipmentExpectedDate,
                    ShipmentType: payload.ShipmentType,
                    status: payload.status || "A",
                    CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
                    BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
                    DepartmentMasterSid: payload.DepartmentMasterSid,
                    CustomerMasterSid: payload.CustomerMasterSid,
                    UserMasterSid: user['userBranchMaster'][0].UserMasterSid
                }
                const enquiryHeader = await prisma.enquiryHeader.create({
                    data: enquiryHeaderPayload
                });

                const enquiryRoutePayload: any = {
                    PORSid: payload.PORSid,
                    POLSid: payload.POLSid,
                    PODSid: payload.PODSid,
                    FDPSid: payload.FDPSid,
                    CompanyMasterSid: enquiryHeader.CompanyMasterSid,
                    BranchMasterSid: enquiryHeader.BranchMasterSid,
                    EnquiryHeaderSid: enquiryHeader.EnquiryHeaderSid
                }
                const enquiryRoute = await prisma.enquiryRoute.create({
                    data: enquiryRoutePayload
                });

                const enquiryCargoPayload: any = {
                    CompanyMasterSid: enquiryRoute.CompanyMasterSid,
                    BranchMasterSid: enquiryRoute.BranchMasterSid,
                    EnquiryHeaderSid: enquiryRoute.EnquiryHeaderSid,
                    EnquiryRouteSid: enquiryRoute.EnquiryRouteSid,
                    CargoType: payload.CargoType,
                    GrossWeight: payload.GrossWeight,
                    Volume: payload.Volume
                }

                const enquiryCargo = await prisma.enquiryCargo.create({
                    data: enquiryCargoPayload
                });

                return {
                    message: 'Enquiry created successfully',
                    data: {
                        enquiryHeader,
                        enquiryRoute,
                        enquiryCargo
                    }
                };
            });
        } catch (error) {
            throw new Error(`Transaction failed: ${error.message}`);
        }
    }



    async getAllDepartment() {
        try {
            const customer = await this._db.departmentMaster.findMany({});
            return customer;
        } catch (error) {
            console.log("cutomerError", error)
        }
    }


    async getAllCargoTypes() {
        try {
            const customer = await this._db.packageTypeMaster.findMany({});
            return customer;
        } catch (error) {
            console.log("cutomerError", error)
        }
    }


    async getAllPorts() {
        try {
            const customer = await this._db.portMaster.findMany({});
            return customer;
        } catch (error) {
            console.log("cutomerError", error)
        }
    }


}