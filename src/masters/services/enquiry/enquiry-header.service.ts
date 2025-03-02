import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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



    // async createEnquiry(payload, user) {
    //     try {
    //         return await this._db.$transaction(async (prisma) => {
    //             const enquiryHeaderPayload: any = {
    //                 CustomerName: payload.CustomerName,
    //                 ShipmentExpectedDate: new Date(payload.ShipmentExpectedDate + "Z"),
    //                 ShipmentType: payload.ShipmentType,
    //                 status: payload.status || "A",
    //                 CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
    //                 BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
    //                 DepartmentMasterSid: payload.DepartmentMasterSid,
    //                 CustomerMasterSid: payload.CustomerMasterSid,
    //                 UserMasterSid: user['userBranchMaster'][0].UserMasterSid
    //             }
    //             const enquiryHeader = await prisma.enquiryHeader.create({
    //                 data: enquiryHeaderPayload
    //             });

    //             const enquiryRoutePayload: any = {
    //                 PORSid: payload.PORSid,
    //                 POLSid: payload.POLSid,
    //                 PODSid: payload.PODSid,
    //                 FDPSid: payload.FDPSid,
    //                 CompanyMasterSid: enquiryHeader.CompanyMasterSid,
    //                 BranchMasterSid: enquiryHeader.BranchMasterSid,
    //                 EnquiryHeaderSid: enquiryHeader.EnquiryHeaderSid
    //             }
    //             const enquiryRoute = await prisma.enquiryRoute.create({
    //                 data: enquiryRoutePayload
    //             });

    //             const enquiryCargoPayload: any = {
    //                 CompanyMasterSid: enquiryRoute.CompanyMasterSid,
    //                 BranchMasterSid: enquiryRoute.BranchMasterSid,
    //                 EnquiryHeaderSid: enquiryRoute.EnquiryHeaderSid,
    //                 EnquiryRouteSid: enquiryRoute.EnquiryRouteSid,
    //                 CargoType: payload.CargoType,
    //                 GrossWeight: payload.GrossWeight,
    //                 Volume: payload.Volume
    //             }

    //             const enquiryCargo = await prisma.enquiryCargo.create({
    //                 data: enquiryCargoPayload
    //             });

    //             return {
    //                 message: 'Enquiry created successfully',
    //                 data: {
    //                     enquiryHeader,
    //                     enquiryRoute,
    //                     enquiryCargo
    //                 }
    //             };
    //         });
    //     } catch (error) {
    //         throw new Error(`Transaction failed: ${error.message}`);
    //     }
    // }


    async createEnquiry(payload, user) {
        console.log(user);
        try {
            return await this._db.$transaction(async (prisma) => {
                // Step 1: Create Enquiry Header
                const enquiryHeaderPayload: any = {
                    CustomerName: payload.customerName,
                    ShipmentExpectedDate: new Date(payload.shipmentDate + "Z"),
                    ShipmentType: payload.Segment,
                    status: payload.status || "A",
                    CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
                    BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
                    UserMasterSid: user['userBranchMaster'][0].UserMasterSid,
                    createdBy: user['userEmail']
                };

                const enquiryHeader = await prisma.enquiryHeader.create({
                    data: enquiryHeaderPayload
                });

                // Step 2: Create Enquiry Routes One by One (to get EnquiryRouteSid)
                const enquiryRoutes = await Promise.all(
                    payload.routes.map(async (route) => {
                        return await prisma.enquiryRoute.create({
                            data: {
                                PORSid: Number(route.POO),
                                POLSid: Number(route.POL),
                                PODSid: Number(route.POD),
                                FDPSid: Number(route.FDC),
                                CompanyMasterSid: enquiryHeader.CompanyMasterSid,
                                BranchMasterSid: enquiryHeader.BranchMasterSid,
                                EnquiryHeaderSid: enquiryHeader.EnquiryHeaderSid,
                                createdBy: user['userEmail']
                            }
                        });
                    })
                );

                // Step 3: Create Enquiry Cargo (Mapping Cargo to Routes)
                const enquiryCargoPayload = enquiryRoutes.flatMap((enquiryRoute, index) =>
                    payload.routes[index].cargo.map(cargo => ({
                        CompanyMasterSid: enquiryHeader.CompanyMasterSid,
                        BranchMasterSid: enquiryHeader.BranchMasterSid,
                        EnquiryHeaderSid: enquiryHeader.EnquiryHeaderSid,
                        EnquiryRouteSid: enquiryRoute.EnquiryRouteSid, // Correctly linked route ID
                        CargoType: cargo.cargoType,
                        ProductName: cargo.product,
                        GrossWeight: new Prisma.Decimal(cargo.Weight),  // Convert to Decimal
                        Volume: new Prisma.Decimal(cargo.cbm),  // Convert to Decimal
                        Qty: new Prisma.Decimal(cargo.Qty),  // Convert to Decimal
                        ContainerType: cargo.contentType,
                        createdBy: user['userEmail']
                    }))
                );

                // Step 4: Bulk Insert Cargo Data
                const enquiryCargos = await prisma.enquiryCargo.createMany({
                    data: enquiryCargoPayload
                });

                // Return Success Response
                return {
                    message: 'Enquiry created successfully',
                    data: {
                        enquiryHeader,
                        enquiryRoutes,
                        enquiryCargos
                    }
                };
            });
        } catch (error) {
            throw new Error(`Transaction failed: ${error.stack}`);
        }
    }



    async getAllEnquiries() {
        try {
            const enquiries = await this._db.enquiryHeader.findMany({
                include: {
                    enquiryRoute: {
                        include: {
                            enquiryCargo: true
                        }
                    }
                }
            });
            return enquiries;
        } catch (error) {
            console.log("cutomerError", error)
        }
    }


    async findOne(enquiryId: any) {
        try {
            return await this._db.enquiryHeader.findUnique({
                where: {
                    EnquiryHeaderSid: enquiryId
                },
                include: {
                    enquiryRoute: {
                        include: {
                            enquiryCargo: true
                        }
                    }
                }
            });
        } catch (error) {
            throw error;
        }
    }


    // async editEnquiry(id,payload, user) {
    //     try {
    //         return await this._db.$transaction(async (prisma) => {
    //             const enquiryHeaderPayload: any = {
    //                 CustomerName: payload.CustomerName,
    //                 ShipmentExpectedDate: new Date(payload.ShipmentExpectedDate + "Z"),
    //                 ShipmentType: payload.ShipmentType,
    //                 status: payload.status || "A",
    //                 CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
    //                 BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
    //                 DepartmentMasterSid: payload.DepartmentMasterSid,
    //                 CustomerMasterSid: payload.CustomerMasterSid,
    //                 UserMasterSid: user['userBranchMaster'][0].UserMasterSid
    //             };

    //             const enquiryHeader = await prisma.enquiryHeader.create({
    //                 data: enquiryHeaderPayload
    //             });

    //             // enquiryRoute Payload (Single or Multiple)
    //             const enquiryRoutePayload = payload.EnquiryRoutes.map(route => ({
    //                 PORSid: route.PORSid,
    //                 POLSid: route.POLSid,
    //                 PODSid: route.PODSid,
    //                 FDPSid: route.FDPSid,
    //                 CompanyMasterSid: enquiryHeader.CompanyMasterSid,
    //                 BranchMasterSid: enquiryHeader.BranchMasterSid,
    //                 EnquiryHeaderSid: enquiryHeader.EnquiryHeaderSid
    //             }));

    //             const enquiryRoutes = await prisma.enquiryRoute.createMany({
    //                 data: enquiryRoutePayload,
    //             });

    //             // enquiryCargo Payload (Single or Multiple)
    //             const enquiryCargoPayload = payload.EnquiryCargos.map(cargo => ({
    //                 CompanyMasterSid: enquiryHeader.CompanyMasterSid,
    //                 BranchMasterSid: enquiryHeader.BranchMasterSid,
    //                 EnquiryHeaderSid: enquiryHeader.EnquiryHeaderSid,
    //                 CargoType: cargo.CargoType,
    //                 GrossWeight: cargo.GrossWeight,
    //                 Volume: cargo.Volume
    //             }));

    //             const enquiryCargos = await prisma.enquiryCargo.createMany({
    //                 data: enquiryCargoPayload,
    //             });

    //             return {
    //                 message: 'Enquiry created successfully',
    //                 data: {
    //                     enquiryHeader,
    //                     enquiryRoutes,
    //                     enquiryCargos
    //                 }
    //             };
    //         });
    //     } catch (error) {
    //         throw new Error(`Transaction failed: ${error.message}`);
    //     }
    // }


    async softDelete(id: number) {
        // Check if the enquiry exists and is not already deleted
        const existingEnquiry = await this._db.enquiryHeader.findUnique({
            where: { EnquiryHeaderSid: id }
        });

        if (!existingEnquiry) {
            throw new NotFoundException(`Enquiry with ID ${id} not found`);
        }

        if (existingEnquiry.deletedAt) {
            throw new Error(`Enquiry with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.enquiryHeader.update({
            where: { EnquiryHeaderSid: id },
            data: { deletedAt: new Date() }
        });
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