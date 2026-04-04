import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { DatabaseService } from 'src/database/database.service';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';

@Injectable()
export class EnquiryHeaderService {
    constructor(
        private _db: DatabaseService,
        private numberSeriesService: NumberSeriesService,
    ) { }

    async createEnquiry(payload, user) {
        try {
            const CompanyMasterSid = user['userBranchMaster'][0].CompanyMasterSid;
            const BranchMasterSid = user['userBranchMaster'][0].BranchMasterSid;
            const DepartmentMasterSid = Number(payload.DepartmentMasterSid);

            // Get MenuMasterSid for Enquiry (look up by code or use provided value)
            let MenuMasterSid = payload.MenuMasterSid;
            if (!MenuMasterSid) {
                const enquiryMenu = await this._db.menuMaster.findFirst({
                    where: {
                        OR: [
                            { MenuCode: 'RAT' },
                            { MenuName: { contains: 'enquiry', mode: 'insensitive' } }
                        ],
                        status: 'A'
                    }
                });
                MenuMasterSid = enquiryMenu?.MenuMasterSid;
            }

            // Generate enquiry number using NumberSeriesService
            // let enquiryNumber: string | null = null;
            // if (MenuMasterSid) {
            //     enquiryNumber = await this.numberSeriesService.generateNextNumber(
            //         CompanyMasterSid,
            //         BranchMasterSid,
            //         MenuMasterSid,
            //         DepartmentMasterSid,
            //         undefined,
            //     );
            // }

            return await this._db.$transaction(async (prisma) => {
                // Step 1: Create Enquiry Header
                const enquiryHeaderPayload: any = {
                    CustomerName: payload.CustomerName,
                    DepartmentMasterSid: DepartmentMasterSid,
                    CustomerMasterSid: Number(payload.CustomerMasterSid),
                    ShipmentExpectedDate: payload.shipmentDate,
                    ShipmentType: payload.Segment,
                    IncoTerms: payload.IncoTerms,
                    CustomerRef: payload.CustomerRef,
                    status: payload.status || "A",
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    UserMasterSid: user['userBranchMaster'][0].UserMasterSid,
                    createdBy: user['userEmail'],
                    // EnquiryNumber: enquiryNumber,
                    EnquiryDate: new Date(),
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
                        GrossWeight: Number(cargo.Weight),  // Convert to Decimal
                        Volume: Number(cargo.cbm),  // Convert to Decimal
                        Qty: Number(cargo.Qty),  // Convert to Decimal
                        ContainerType: cargo.contentType,
                        length : Number(cargo.length),
                        width : Number(cargo.width),
                        height : Number(cargo.height),
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
                },
                orderBy: {
                    EnquiryHeaderSid: 'desc'  // Sorting by 'EnquiryHeaderSid' in descending order
                }
            });
            return enquiries;
        } catch (error) {
            throw error
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
                        where : {
                            status : 'A'
                        },
                        include: {
                            enquiryCargo: {
                                where : {
                                    status : 'A'
                                }
                            }
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
            // Step 1: Update Enquiry Header
            const statusUpdate = payload.status === "A" ? "A" : "S";
            const updatedEnquiryHeader = await this._db.enquiryHeader.update({
                where: { EnquiryHeaderSid: enquiryHeaderSid },
                data: {
                    CustomerName: payload.CustomerName,
                    ShipmentExpectedDate: payload.shipmentDate,
                    ShipmentType: payload.Segment,
                    IncoTerms: payload.IncoTerms,
                    CustomerRef: payload.CustomerRef,
                    status: statusUpdate,
                    updatedBy: user['userEmail'],
                    updatedOn: new Date()
                }
            });

            let finalRouteData: any = [];
            let finalCargoData: any = [];

            // Step 2: Update or create routes
            for (const route of payload.routes) {
                let updateData, createData;

                if (route.EnquiryRouteSid) {
                    updateData = await this._db.enquiryRoute.update({
                        where: { EnquiryRouteSid: route.EnquiryRouteSid },
                        data: {
                            PORSid: Number(route.POO),
                            POLSid: Number(route.POL),
                            PODSid: Number(route.POD),
                            FDPSid: Number(route.FDC),
                            updatedBy: user['userEmail'],
                            updatedOn: new Date(),
                        }
                    });
                } else {
                    createData = await this._db.enquiryRoute.create({
                        data: {
                            PORSid: Number(route.POO),
                            POLSid: Number(route.POL),
                            PODSid: Number(route.POD),
                            FDPSid: Number(route.FDC),
                            CompanyMasterSid: updatedEnquiryHeader.CompanyMasterSid,
                            BranchMasterSid: updatedEnquiryHeader.BranchMasterSid,
                            EnquiryHeaderSid: enquiryHeaderSid,
                            createdBy: user['userEmail'],
                        }
                    });
                }

                const routeData = updateData || createData;
                finalRouteData.push(routeData);

                // Step 3: Update or create cargo for each route
                if (route.cargo && route.cargo.length > 0) {
                    for (const cargoItem of route.cargo) {
                        let updateCargoData;
                        let createCargoData;

                        if (cargoItem.EnquiryCargoSid) {
                            updateCargoData = await this._db.enquiryCargo.update({
                                where: { EnquiryCargoSid: cargoItem.EnquiryCargoSid },
                                data: {
                                    CargoType: cargoItem.cargoType,
                                    ContainerType: cargoItem.contentType,
                                    ProductName: cargoItem.product,
                                    Qty: Number(cargoItem.Qty),
                                    GrossWeight: Number(cargoItem.Weight),
                                    Volume: Number(cargoItem.cbm),
                                    length : Number(cargoItem.length),
                                    width : Number(cargoItem.width),
                                    height : Number(cargoItem.height),
                                    updatedBy: user['userEmail'],
                                    updatedOn: new Date(),
                                }
                            });
                        } else {
                            createCargoData = await this._db.enquiryCargo.create({
                                data: {
                                    CargoType: cargoItem.cargoType,
                                    ContainerType: cargoItem.contentType,
                                    ProductName: cargoItem.product,
                                    Qty: Number(cargoItem.Qty),
                                    GrossWeight: Number(cargoItem.Weight),
                                    Volume: Number(cargoItem.cbm),
                                    EnquiryHeaderSid: enquiryHeaderSid,
                                    EnquiryRouteSid: routeData.EnquiryRouteSid, // Link to the correct route
                                    length: Number(cargoItem.length),
                                    width: Number(cargoItem.width),
                                    height: Number(cargoItem.height),
                                    createdBy: user['userEmail'],
                                    CompanyMasterSid: updatedEnquiryHeader.CompanyMasterSid,
                                    BranchMasterSid: updatedEnquiryHeader.BranchMasterSid,
                                }
                            });
                        }

                        finalCargoData.push(updateCargoData || createCargoData);
                    }
                }
            }

            return {
                status: true,
                message: 'Enquiry updated successfully',
                data: {
                    updatedEnquiryHeader: updatedEnquiryHeader,
                    finalRouteData: finalRouteData, // Now an array
                    finalCargoData: finalCargoData  // Now an array
                }
            };
        } catch (error) {
            throw new Error(`Error updating enquiry: ${error.message}`);
        }
    }

    async softDeleteRoute(EnquiryRouteSid: number) {

        const existingEnquiryRoute = await this._db.enquiryRoute.findUnique({
            where: { EnquiryRouteSid: EnquiryRouteSid }
        });

        if (!existingEnquiryRoute) {
            throw new NotFoundException(`Enquiry Route with ID ${EnquiryRouteSid} not found`);
        }

        if (existingEnquiryRoute.status==='D') {
            throw new Error(`Enquiry Route with ID ${EnquiryRouteSid} is already deleted`);
        }

        return this._db.enquiryRoute.update({
            where: { EnquiryRouteSid: EnquiryRouteSid },
            data: { status:'D' }
        });
    }

    async softDeleteCargo(EnquiryCargoSid: number) {
        const existingEnquiryCargo = await this._db.enquiryCargo.findUnique({
            where: { EnquiryCargoSid: EnquiryCargoSid }
        });

        if (!existingEnquiryCargo) {
            throw new NotFoundException(`Enquiry Route with ID ${EnquiryCargoSid} not found`);
        }

        if (existingEnquiryCargo.status === 'D') {
            throw new Error(`Enquiry Route with ID ${EnquiryCargoSid} is already deleted`);
        }

        return this._db.enquiryCargo.update({
            where: { EnquiryCargoSid: EnquiryCargoSid },
            data: { status : 'D'}
        });
    }
    async softDelete(id: number) {
        // Check if the enquiry exists and is not already deleted
        const existingEnquiry = await this._db.enquiryHeader.findUnique({
            where: { EnquiryHeaderSid: id }
        });

        if (!existingEnquiry) {
            throw new NotFoundException(`Enquiry with ID ${id} not found`);
        }

        if (existingEnquiry.status === 'D') {
            throw new Error(`Enquiry with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.enquiryHeader.update({
            where: { EnquiryHeaderSid: id },
            data: { status: 'D' }
        });
    }



    async getAllDepartment() {
        try {
            const customer = await this._db.departmentMaster.findMany({
                where : {
                    Status : 'A'
                }
            });
            return customer;
        } catch (error) {
            throw error
        }
    }


    async getAllCargoTypes() {
        try {
            const customer = await this._db.packageTypeMaster.findMany({
                where : {
                    status: 'A'
                }
            });
            return customer;
        } catch (error) {
            throw error
        }
    }


    async getAllContainerTypes() {
        try {
            const container = await this._db.containerTypeMaster.findMany({
                where : {
                    status: 'A'
                }
            });
            return container;
        } catch (error) {
            throw error
        }
    }

}
