import { Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, Prisma } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import * as moment from 'moment-timezone';
import { NumberSeriesService } from "src/settings/services/number-series/number-series.service";

@Injectable()
export class QuotationService {
    constructor(
        private _db: DatabaseService,
        private numberSeriesService: NumberSeriesService,
    ) { }

    async createQuotation(payload, user) {
        try {
            const CompanyMasterSid = user['userBranchMaster'][0].CompanyMasterSid;
            const BranchMasterSid = user['userBranchMaster'][0].BranchMasterSid;
            const SalesmanSid =
                user?.['UserMasterSid']
                ?? user?.['userBranchMaster']?.[0]?.UserMasterSid
                ?? user?.['userCompanyMaster']?.[0]?.UserMasterSid
                ?? null;
            // Get DepartmentMasterSid from the first route (if available)
            const DepartmentMasterSid = payload.routes?.[0]?.DepartmentMasterSid
                ? Number(payload.routes[0].DepartmentMasterSid)
                : null;

            // Get MenuMasterSid for Quotation (look up by code or use provided value)
            let MenuMasterSid = payload.MenuMasterSid;
            if (!MenuMasterSid) {
                const quotationMenu = await this._db.menuMaster.findFirst({
                    where: {
                        OR: [
                            { MenuCode: 'QUA' },
                            { MenuCode: 'QT' },
                            { MenuName: { contains: 'Quotation', mode: 'insensitive' } }
                        ],
                        status: 'A'
                    }
                });
                MenuMasterSid = quotationMenu?.MenuMasterSid;
            }

            // Generate quote number using NumberSeriesService
            let quoteNumber: string | null = null;
            if (MenuMasterSid) {
                quoteNumber = await this.numberSeriesService.generateNextNumber(
                    CompanyMasterSid,
                    BranchMasterSid,
                    MenuMasterSid,
                    DepartmentMasterSid ?? undefined,
                    payload.quoteDate ? new Date(payload.quoteDate) : undefined,
                );
            }

            return await this._db.$transaction(async (prisma) => {
                // Step 1: Create Quote Header
                const quoteDate = payload.quoteDate ? new Date(payload.quoteDate) : new Date();
                const quoteHeaderPayload: any = {
                    CustomerName: payload.CustomerName,
                    CustomerMasterSid: Number(payload.CustomerMasterSid),
                    QuoteDate: quoteDate,
                    CustomerRef: payload.CustomerRef,
                    SalesmanSid: SalesmanSid,
                    AgreedRate: payload.AgreedRate || "N",
                    IsContract: payload.IsContract || "N",
                    CustomerAddress: payload.CustomerAddress,
                    status: payload.status || "A",
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
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
                                ServiceLevel: route.ServiceLevel || null,
                                segmentType: route.segmentType,
                                effDate: new Date(route.effDate),
                                expdate: new Date(route.expDate),
                                twentyft: Number(route.twentyft) || null,
                                fortyft: Number(route.fortyft) || null,
                                createdBy: user['userEmail'],
                                cargoType: route.cargoType,
                                TransitDays: route.transit || null
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
                                ApprovalStatus: ApprovalStatus.Approved,
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
                        UOMMasterSid: Number(cargo.unit),
                        perUnit: cargo.perUnit,
                        costUnit: cargo.costUnit ? String(cargo.costUnit) : null,
                        costCurrency: cargo.costCurrency ? String(cargo.costCurrency) : null,
                        costPerUnit: cargo.costPerUnit,
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
                            status : 'A'
                        },
                        include: {
                            quoteCharge: {
                                where: {
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

    async updateQuote(QuoteHeaderSid: number, payload, user) {
        try {
            // Step 1: Update Enquiry Header
            const statusUpdate = payload.status === 'Active' ? 'A' : (payload.status === 'Suspend' ? 'S' : undefined);
            const quoteDate = payload.quoteDate ? new Date(payload.quoteDate) : new Date();
            const SalesmanSid =
                user?.['UserMasterSid']
                ?? user?.['userBranchMaster']?.[0]?.UserMasterSid
                ?? user?.['userCompanyMaster']?.[0]?.UserMasterSid
                ?? null;

            const updatedQuoteHeader = await this._db.quoteHeader.update({
                where: { QuoteHeaderSid: QuoteHeaderSid },
                data: {
                    CustomerName: payload.CustomerName,
                    CustomerMasterSid: payload.CustomerMasterSid ? Number(payload.CustomerMasterSid) : null,
                    CustomerAddress: payload.CustomerAddress,
                    QuoteDate: quoteDate,
                    CustomerRef: payload.CustomerRef,
                    SalesmanSid: SalesmanSid,
                    AgreedRate: payload.AgreedRate || "N",
                    IsContract: payload.IsContract || "N",
                    ...(statusUpdate ? { status: statusUpdate } : {}),
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
                            ServiceLevel: route.ServiceLevel || null,
                            effDate: new Date(route.effDate),
                            expdate: new Date(route.expDate),
                            twentyft: Number(route.twentyft) || null,
                            fortyft: Number(route.fortyft) || null,
                            updatedBy: user['userEmail'],
                            updatedOn: new Date(),
                            cargoType: route.cargoType,
                            TransitDays: Number(route.transit) || null
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
                            ServiceLevel: route.ServiceLevel || null,
                            effDate: new Date(route.effDate),
                            expdate: new Date(route.expDate),
                            twentyft: Number(route.twentyft) || null,
                            fortyft: Number(route.fortyft) || null,
                            cargoType: route.cargoType,
                            TransitDays: Number(route.transit) || null,
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
                                    UOMMasterSid: Number(cargoItem.unit),
                                    perUnit: cargoItem.perUnit,
                                    costUnit: cargoItem.costUnit ? String(cargoItem.costUnit) : null,
                                    costCurrency: cargoItem.costCurrency ? String(cargoItem.costCurrency) : null,
                                    costPerUnit: cargoItem.costPerUnit,
                                    updatedBy: user['userEmail'],
                                    updatedOn: new Date(),
                                }
                            });
                        } else {
                            createCargoData = await this._db.quoteCharge.create({
                                data: {
                                    ChargeDisplayName: cargoItem.charge,
                                    CurrencyMasterSid: Number(cargoItem.currency),
                                    UOMMasterSid: Number(cargoItem.unit),
                                    perUnit: cargoItem.perUnit,
                                    costUnit: cargoItem.costUnit ? String(cargoItem.costUnit) : null,
                                    costCurrency: cargoItem.costCurrency ? String(cargoItem.costCurrency) : null,
                                    costPerUnit: cargoItem.costPerUnit,
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
                message: 'Quotation updated successfully',
                data: {
                    updatedQuoteHeader: updatedQuoteHeader,
                    finalRouteData: finalRouteData, // Now an array
                    finalCargoData: finalCargoData  // Now an array
                }
            };
        } catch (error) {
            throw new Error(`Error updating quotation: ${error.message}`);
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

        if (existingQuote.status === 'D') {
            throw new Error(`Quote with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.quoteHeader.update({
            where: { QuoteHeaderSid: id },
            data: { status : 'D' }
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

        if (existingQuote.status === 'D') {
            throw new Error(`Quote with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.quoteRoute.update({
            where: { QuoteRouteSid: id },
            data: { status : 'D' }
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

        if (existingQuote.status === 'D') {
            throw new Error(`Quote with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.quoteCharge.update({
            where: { QuoteChargeSid: id },
            data: { status : 'D' }
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
            const customers = await this._db.customerMaster.findMany({
                where : {
                    CustomerType: {
                        path: ['carrier'],
                        equals: 'isTrue'
                    },
                    status : 'A'
                }
            });


            return customers;
        } catch (error) {
            throw error
        }
    }



}

