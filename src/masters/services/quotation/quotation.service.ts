import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import * as moment from 'moment-timezone';

@Injectable()
export class QuotationService {
    constructor(
        private _db: DatabaseService
    ) { }

    async createQuotation(payload, user) {
        try {
            return await this._db.$transaction(async (prisma) => {
                const dateString = moment().format('YYYYMMDD')
                const count = await this._db.quoteHeader.count({
                    where: {
                        CustomerName: {
                            contains: dateString
                        }
                    }
                })
                const quoteNumber = `quotation-${dateString}-${(count + 1).toString().padStart(3, '0')}`
                // Step 1: Create Enquiry Header
                const enquiryHeaderPayload: any = {
                    CustomerName: payload.CustomerName,
                    DepartmentMasterSid: Number(payload.DepartmentMasterSid),
                    CustomerMasterSid: Number(payload.CustomerMasterSid),
                    ShipmentExpectedDate: new Date(payload.shipmentDate + "Z"),
                    ShipmentType: payload.Segment,
                    status: payload.status || "A",
                    CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
                    BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
                    UserMasterSid: user['userBranchMaster'][0].UserMasterSid,
                    createdBy: user['userEmail'],
                    // EnquiryNumber: enquiryNumber,
                    EnquiryDate: new Date()
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
                    ShipmentType: true,
                    status: true
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
            // Step 1: Update Enquiry Header
            const statusUpdate = payload.status === "Active" ? "A" : "IA";
            const updatedEnquiryHeader = await this._db.enquiryHeader.update({
                where: { EnquiryHeaderSid: enquiryHeaderSid },
                data: {
                    CustomerName: payload.customerName,
                    ShipmentExpectedDate: new Date(payload.shipmentDate + "Z"),
                    ShipmentType: payload.Segment,
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
}