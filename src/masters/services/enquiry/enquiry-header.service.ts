import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EnquiryHeaderService {
    constructor(
        // @InjectModel(CityMaster)
        // private readonly cityMaster : typeof CityMaster
        private _db: DatabaseService
    ) { }

    async createEnquiry(payload, user) {
        try {
            return await this._db.$transaction(async (prisma) => {
                const dateString = moment().format('YYYYMMDD')
                const count = await this._db.enquiryHeader.count({
                    where: {
                        CustomerName: {
                            contains: dateString
                        }
                    }
                })
                const enquiryNumber = `enquiry-${dateString}-${(count + 1).toString().padStart(3, '0')}`
                // Step 1: Create Enquiry Header
                const enquiryHeaderPayload: any = {
                    CustomerName: payload.customerName,
                    ShipmentExpectedDate: new Date(payload.shipmentDate + "Z"),
                    ShipmentType: payload.Segment,
                    status: payload.status || "A",
                    CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
                    BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
                    UserMasterSid: user['userBranchMaster'][0].UserMasterSid,
                    createdBy: user['userEmail'],
                    EnquiryNumber: enquiryNumber
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
                select: {
                    EnquiryHeaderSid: true,
                    EnquiryNumber: true,
                    CustomerName: true,
                    ShipmentExpectedDate: true,
                    ShipmentType: true
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


    async updateEnquiry(enquiryHeaderSid: number, payload, user) {
        try {
            return await this._db.$transaction(async (prisma) => {
                // Step 1: Update Enquiry Header
                const updatedEnquiryHeader = await prisma.enquiryHeader.update({
                    where: { EnquiryHeaderSid: enquiryHeaderSid },
                    data: {
                        CustomerName: payload.customerName,
                        ShipmentExpectedDate: new Date(payload.shipmentDate + "Z"),
                        ShipmentType: payload.Segment,
                        status: payload.status || "A",
                        updatedBy: user['userEmail'],
                        updatedOn: new Date()
                    }
                });

                // Step 2: Fetch Existing Routes & Cargo
                const existingRoutes = await prisma.enquiryRoute.findMany({
                    where: { EnquiryHeaderSid: enquiryHeaderSid },
                    include: { enquiryCargo: true }
                });

                // Step 3: Process Routes (Update Existing & Add New)
                const updateRoutesPayload: any = [];
                const createRoutesPayload: any = [];

                payload.routes.forEach((route) => {
                    const existingRoute = existingRoutes.find(r =>
                        r.PORSid === Number(route.POO) &&
                        r.POLSid === Number(route.POL) &&
                        r.PODSid === Number(route.POD) &&
                        r.FDPSid === Number(route.FDC)
                    );

                    if (existingRoute) {
                        updateRoutesPayload.push({
                            where: { EnquiryRouteSid: existingRoute.EnquiryRouteSid },
                            data: {
                                PORSid: Number(route.POO),
                                POLSid: Number(route.POL),
                                PODSid: Number(route.POD),
                                FDPSid: Number(route.FDC),
                                updatedBy: user['userEmail'],
                                updatedAt: new Date()
                            }
                        });
                    } else {
                        createRoutesPayload.push({
                            PORSid: Number(route.POO),
                            POLSid: Number(route.POL),
                            PODSid: Number(route.POD),
                            FDPSid: Number(route.FDC),
                            CompanyMasterSid: updatedEnquiryHeader.CompanyMasterSid,
                            BranchMasterSid: updatedEnquiryHeader.BranchMasterSid,
                            EnquiryHeaderSid: enquiryHeaderSid,
                            createdBy: user['userEmail']
                        });
                    }
                });

                // Step 4: Execute Bulk Updates & Inserts for Routes
                if (updateRoutesPayload.length > 0) {
                    await Promise.all(updateRoutesPayload.map(route =>
                        prisma.enquiryRoute.update({
                            where: route.where,
                            data: route.data
                        })
                    ));
                }

                if (createRoutesPayload.length > 0) {
                    await prisma.enquiryRoute.createMany({
                        data: createRoutesPayload
                    });
                }

                // Step 5: Fetch Updated Routes for Cargo Processing
                const updatedRoutes = await prisma.enquiryRoute.findMany({
                    where: { EnquiryHeaderSid: enquiryHeaderSid }
                });

                // Step 6: Process Cargo (Update Existing & Add New)
                const updateCargoPayload: any = [];
                const createCargoPayload: any = [];

                payload.routes.forEach((route, index) => {
                    const enquiryRouteSid = updatedRoutes[index].EnquiryRouteSid;
                    const existingCargos = existingRoutes[index]?.enquiryCargo || [];

                    route.cargo.forEach((cargo) => {
                        const existingCargo = existingCargos.find(c =>
                            c.CargoType === cargo.cargoType &&
                            c.ProductName === cargo.product
                        );

                        if (existingCargo) {
                            updateCargoPayload.push({
                                where: { EnquiryCargoSid: existingCargo.EnquiryCargoSid },
                                data: {
                                    CargoType: cargo.cargoType,
                                    ProductName: cargo.product,
                                    GrossWeight: new Prisma.Decimal(cargo.Weight),
                                    Volume: new Prisma.Decimal(cargo.cbm),
                                    Qty: new Prisma.Decimal(cargo.Qty),
                                    ContainerType: cargo.contentType,
                                    updatedBy: user['userEmail'],
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            createCargoPayload.push({
                                CompanyMasterSid: updatedEnquiryHeader.CompanyMasterSid,
                                BranchMasterSid: updatedEnquiryHeader.BranchMasterSid,
                                EnquiryHeaderSid: enquiryHeaderSid,
                                EnquiryRouteSid: enquiryRouteSid,
                                CargoType: cargo.cargoType,
                                ProductName: cargo.product,
                                GrossWeight: new Prisma.Decimal(cargo.Weight),
                                Volume: new Prisma.Decimal(cargo.cbm),
                                Qty: new Prisma.Decimal(cargo.Qty),
                                ContainerType: cargo.contentType,
                                createdBy: user['userEmail']
                            });
                        }
                    });
                });

                // Step 7: Execute Bulk Updates & Inserts for Cargo
                if (updateCargoPayload.length > 0) {
                    await Promise.all(updateCargoPayload.map(cargo =>
                        prisma.enquiryCargo.update({
                            where: cargo.where,
                            data: cargo.data
                        })
                    ));
                }

                if (createCargoPayload.length > 0) {
                    await prisma.enquiryCargo.createMany({
                        data: createCargoPayload
                    });
                }

                return {
                    message: 'Enquiry updated successfully',
                    data: {
                        updatedEnquiryHeader,
                        updatedRoutes,
                        updatedCargos: [...updateCargoPayload, ...createCargoPayload]
                    }
                };
            });
        } catch (error) {
            throw new Error(`Transaction failed: ${error.stack}`);
        }
    }



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