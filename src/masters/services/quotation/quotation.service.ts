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
                const dateString = moment().format('YYYYMMDD');
                const count = await this._db.quoteHeader.count({
                    where: { QuoteNumber: { contains: dateString } }
                });
                const quoteNumber = `quotation-${dateString}-${(count + 1).toString().padStart(3, '0')}`;

                // Step 1: Create Quote Header
                const quoteDate = payload.quoteDate ? new Date(payload.quoteDate) : new Date();
                const quoteHeaderPayload: any = {
                    CustomerName: payload.CustomerName,
                    CustomerMasterSid: Number(payload.CustomerMasterSid),
                    QuoteDate: quoteDate,
                    CustomerAddress: payload.CustomerAddress,
                    status: payload.status || "A",
                    CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
                    BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
                    QuoteNumber: quoteNumber,
                    createdBy: user['userEmail'],
                };

                const quoteHeader = await prisma.quoteHeader.create({ data: quoteHeaderPayload });

                // Step 2: Create Quote Routes & Quote Carriers
                const quoteRoutes = await Promise.all(
                    payload.routes.map(async (route) => {
                        const createdQuoteRoute = await prisma.quoteRoute.create({
                            data: {
                                PORSid: Number(route.POR),
                                POLSid: Number(route.POL),
                                PODSid: Number(route.POD),
                                FDPSid: Number(route.FPOD),
                                DepartmentMasterSid: Number(route.DepartmentMasterSid),
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                CarrierName: route.Carrier,
                                CarrierMasterSid: route.CarrierMasterSid,
                                segmentType: route.segmentType,
                                effDate: new Date(route.effDate),
                                expdate: new Date(route.expDate),
                                twentyft: Number(route.twentyft) || null,
                                fortyft: Number(route.fortyft) || null,
                                createdBy: user['userEmail'],
                            },
                        });

                        const createdQuoteCarrier = await prisma.quoteCarrier.create({
                            data: {
                                QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                CarrierMasterSid: route.CarrierMasterSid,
                                CarrierName: route.Carrier,
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                ApprovalStatus: "A",
                                createdBy: user['userEmail'],
                            },
                        });

                        return { createdQuoteRoute, createdQuoteCarrier };
                    })
                );

                // Step 3: Create Quote Charges
                const quoteCargoPayload = quoteRoutes.flatMap((quoteRoute, index) =>
                    payload.routes[index].cargo.map(cargo => ({
                        CompanyMasterSid: quoteHeader.CompanyMasterSid,
                        BranchMasterSid: quoteHeader.BranchMasterSid,
                        QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                        QuoteRouteSid: quoteRoute.createdQuoteRoute.QuoteRouteSid, // Fixed reference
                        CustomerMasterSid: quoteHeader.CustomerMasterSid,
                        ChargeDisplayName: cargo.charge,
                        CurrencyMasterSid: Number(cargo.currency),
                        UnitMasterSid: Number(cargo.unit),
                        twentyft: cargo.twentyft,
                        fortyft: cargo.fortyft,
                        createdBy: user['userEmail']
                    }))
                );

                // Step 4: Bulk Insert Quote Charges
                const quoteCharge = await prisma.quoteCharge.createMany({
                    data: quoteCargoPayload
                });

                // Return Success Response
                return {
                    message: 'Quote created successfully',
                    data: {
                        quoteHeader,
                        quoteRoutes,
                        quoteCharge
                    }
                };
            });
        } catch (error) {
            throw new Error(`Transaction failed: ${error.stack}`);
        }
    }




    async getAllQuotations() {
        try {
            const quotations = await this._db.quoteHeader.findMany({
                select: {
                    QuoteHeaderSid: true,
                    QuoteNumber: true,
                    CustomerName: true,
                    CustomerAddress: true,
                    QuoteDate: true,
                    status: true
                },
                orderBy: {
                    QuoteHeaderSid: 'desc'
                }
            });
            return quotations;
        } catch (error) {
            console.log("cutomerError", error)
        }
    }


    async findOne(quoteId: any) {
        try {
            return await this._db.quoteHeader.findUnique({
                where: {
                    QuoteHeaderSid: quoteId
                },
                include: {
                    quoteRoute: {
                        where: {
                            deletedAt: null
                        },
                        include: {
                            quoteCharge: {
                                where: {
                                    deletedAt: null
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

    async updateQuote(QuoteHeaderSid: number, payload, user) {
        try {
            // Step 1: Update Enquiry Header
            const statusUpdate = payload.status === "Active" ? "A" : "S";
            const quoteDate = payload.quoteDate ? new Date(payload.quoteDate) : new Date();

            const updatedQuoteHeader = await this._db.quoteHeader.update({
                where: { QuoteHeaderSid: QuoteHeaderSid },
                data: {
                    CustomerName: payload.CustomerName,
                    QuoteDate: quoteDate,
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

                if (route.QuoteRouteSid) {
                    updateData = await this._db.quoteRoute.update({
                        where: { QuoteRouteSid: route.QuoteRouteSid },
                        data: {
                            PORSid: Number(route.POR),
                            POLSid: Number(route.POL),
                            PODSid: Number(route.POD),
                            FDPSid: Number(route.FPOD),
                            CarrierName: route.Carrier,
                            CarrierMasterSid: route.CarrierMasterSid,
                            effDate: new Date(route.effDate),
                            expdate: new Date(route.expDate),
                            twentyft: Number(route.twentyft) || null,
                            fortyft: Number(route.fortyft) || null,
                            updatedBy: user['userEmail'],
                            updatedOn: new Date(),
                        }
                    });
                } else {
                    createData = await this._db.quoteRoute.create({
                        data: {
                            PORSid: Number(route.POR),
                            POLSid: Number(route.POL),
                            PODSid: Number(route.POD),
                            FDPSid: Number(route.FPOD),
                            CarrierName: route.Carrier,
                            CarrierMasterSid: route.CarrierMasterSid,
                            effDate: new Date(route.effDate),
                            expdate: new Date(route.expDate),
                            twentyft: Number(route.twentyft) || null,
                            fortyft: Number(route.fortyft) || null,
                            DepartmentMasterSid: Number(route.DepartmentMasterSid),
                            CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                            BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                            QuoteHeaderSid: QuoteHeaderSid,
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

                        if (cargoItem.QuoteChargeSid) {
                            updateCargoData = await this._db.quoteCharge.update({
                                where: { QuoteChargeSid: cargoItem.QuoteChargeSid },
                                data: {
                                    ChargeDisplayName: cargoItem.charge,
                                    CurrencyMasterSid: Number(cargoItem.currency),
                                    UnitMasterSid: Number(cargoItem.unit),
                                    twentyft: cargoItem.twentyft,  // Convert to Decimal
                                    fortyft: cargoItem.fortyft,  // Convert to Decimal 
                                    updatedBy: user['userEmail'],
                                    updatedOn: new Date(),
                                }
                            });
                        } else {
                            createCargoData = await this._db.quoteCharge.create({
                                data: {
                                    ChargeDisplayName: cargoItem.charge,
                                    CurrencyMasterSid: Number(cargoItem.currency),
                                    UnitMasterSid: Number(cargoItem.unit),
                                    twentyft: cargoItem.twentyft,  // Convert to Decimal
                                    fortyft: cargoItem.fortyft,
                                    QuoteHeaderSid: QuoteHeaderSid,
                                    QuoteRouteSid: routeData.QuoteRouteSid, // Link to the correct route
                                    createdBy: user['userEmail'],
                                    CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                                    BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                                    CustomerMasterSid: updatedQuoteHeader.CustomerMasterSid,
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
                    updatedEnquiryHeader: updatedQuoteHeader,
                    finalRouteData: finalRouteData, // Now an array
                    finalCargoData: finalCargoData  // Now an array
                }
            };
        } catch (error) {
            throw new Error(`Error updating enquiry: ${error.message}`);
        }
    }

    async softDelete(id: number) {
        // Check if the quote exists and is not already deleted
        const existingQuote = await this._db.quoteHeader.findUnique({
            where: { QuoteHeaderSid: id }
        });

        if (!existingQuote) {
            throw new NotFoundException(`Quote with ID ${id} not found`);
        }

        if (existingQuote.deletedAt) {
            throw new Error(`Quote with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.quoteHeader.update({
            where: { QuoteHeaderSid: id },
            data: { deletedAt: new Date() }
        });
    }


    async deleteRoute(id: number) {
        // Check if the quote exists and is not already deleted
        const existingQuote = await this._db.quoteRoute.findUnique({
            where: { QuoteRouteSid: id }
        });

        if (!existingQuote) {
            throw new NotFoundException(`Quote with ID ${id} not found`);
        }

        if (existingQuote.deletedAt) {
            throw new Error(`Quote with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.quoteRoute.update({
            where: { QuoteRouteSid: id },
            data: { deletedAt: new Date() }
        });
    }

    async deleteCharge(id: number) {
        // Check if the quote exists and is not already deleted
        const existingQuote = await this._db.quoteCharge.findUnique({
            where: { QuoteChargeSid: id }
        });

        if (!existingQuote) {
            throw new NotFoundException(`Quote with ID ${id} not found`);
        }

        if (existingQuote.deletedAt) {
            throw new Error(`Quote with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.quoteCharge.update({
            where: { QuoteChargeSid: id },
            data: { deletedAt: new Date() }
        });
    }

    async getAllMasters() {
        try {
            const [charges, units, currencies] = await this._db.$transaction([
                this._db.chargeMaster.findMany(),
                this._db.unitMaster.findMany(),
                this._db.currencyMaster.findMany(),
            ]);

            return { charges, units, currencies };
        } catch (error) {
            console.error("Error fetching masters:", error);
            throw new Error("Failed to fetch master data.");
        }
    }



    async getAllCustomer() {
        try {
            const customers = await this._db.customerMaster.findMany();

            const filteredCustomers = customers.filter(customer =>
                customer.CompanyType &&
                Object.values(customer.CompanyType).includes("isTrue")
            );

            return filteredCustomers;
        } catch (error) {
            console.log("customerError", error);
        }
    }



}