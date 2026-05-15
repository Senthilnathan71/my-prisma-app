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

    private toNullableDate(value: any): Date | null {
        if (!value) {
            return null;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    private toNullableNumber(value: any): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const numericValue = Number(value);
        if (Number.isNaN(numericValue) || numericValue <= 0) {
            return null;
        }
        return numericValue;
    }

    private toRequiredNumber(value: any, fallback: number = 0): number {
        const numericValue = Number(value);
        if (Number.isNaN(numericValue) || numericValue <= 0) {
            return fallback;
        }
        return numericValue;
    }

    private getRoutesFromPayload(payload: any): any[] {
        if (Array.isArray(payload?.quoteRoutes)) return payload.quoteRoutes;
        if (Array.isArray(payload?.routes)) return payload.routes;
        return [];
    }

    private getRouteValue(route: any, keys: string[], fallback: any = null): any {
        for (const key of keys) {
            if (route?.[key] !== undefined && route?.[key] !== null) return route[key];
        }
        return fallback;
    }

    async createQuotation(payload, user) {
        try {
            const CompanyMasterSid = Number(payload.CompanyMasterSid || 0);
            const BranchMasterSid = Number(payload.BranchMasterSid || 0);
            const SalesmanSid =
                user?.['UserMasterSid']
                ?? user?.['userBranchMaster']?.[0]?.UserMasterSid
                ?? user?.['userCompanyMaster']?.[0]?.UserMasterSid
                ?? null;
            if (!CompanyMasterSid || !BranchMasterSid) {
                throw new Error('CompanyMasterSid and BranchMasterSid are required');
            }
            // Get DepartmentMasterSid from the first route (if available)
            const routes = this.getRoutesFromPayload(payload);
            const DepartmentMasterSid = routes?.[0]?.DepartmentMasterSid
                ? Number(routes[0].DepartmentMasterSid)
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
                    (payload.quoteDate || payload.QuoteDate) ? new Date(payload.quoteDate || payload.QuoteDate) : undefined,
                );
            }

            return await this._db.$transaction(async (prisma) => {
                // Step 1: Create Quote Header
                const quoteDate = (payload.quoteDate || payload.QuoteDate) ? new Date(payload.quoteDate || payload.QuoteDate) : new Date();
                const quoteHeaderPayload: any = {
                    CustomerName: payload.CustomerName,
                    CustomerMasterSid: this.toNullableNumber(payload.CustomerMasterSid),
                    PreCustomerMasterSid: this.toNullableNumber(payload.PreCustomerMasterSid),
                    LeadOrCustomer: payload.LeadOrCustomer || (payload.PreCustomerMasterSid ? 'L' : 'C'),
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
                    routes.map(async (route) => {
                        const createdQuoteRoute = await prisma.quoteRoute.create({
                            data: {
                                PORSid: this.toRequiredNumber(this.getRouteValue(route, ['POR', 'PORSid'])),
                                POLSid: this.toRequiredNumber(this.getRouteValue(route, ['POL', 'POLSid'])),
                                PODSid: this.toRequiredNumber(this.getRouteValue(route, ['POD', 'PODSid'])),
                                FDPSid: this.toRequiredNumber(this.getRouteValue(route, ['FPOD', 'FPODSid', 'FDPSid'])),
                                DepartmentMasterSid: this.toRequiredNumber(route.DepartmentMasterSid),
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                CarrierName: this.getRouteValue(route, ['Carrier', 'CarrierName'], ''),
                                CarrierMasterSid: this.toNullableNumber(this.getRouteValue(route, ['CarrierMasterSid'])),
                                ServiceLevel: this.getRouteValue(route, ['ServiceLevel', 'ShipmentTerms', 'IncoTerms'], null),
                                segmentType: route.segmentType,
                                effDate: this.toNullableDate(route.effDate),
                                expdate: this.toNullableDate(route.expDate),
                                twentyft: Number(route.twentyft) || null,
                                fortyft: Number(route.fortyft) || null,
                                createdBy: user['userEmail'],
                                cargoType: this.getRouteValue(route, ['cargoType', 'CargoType'], ''),
                                TransitDays: this.toNullableNumber(this.getRouteValue(route, ['transit', 'TransitDays']))
                            },
                        });

                        const createdQuoteCarrier = await prisma.quoteCarrier.create({
                            data: {
                                QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                CarrierMasterSid: this.toNullableNumber(this.getRouteValue(route, ['CarrierMasterSid'])),
                                CarrierName: this.getRouteValue(route, ['Carrier', 'CarrierName'], ''),
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                ApprovalStatus: ApprovalStatus.Approved,
                                createdBy: user['userEmail'],
                            },
                        });

                        const routeCargoItems = Array.isArray(route.quoteCargo) && route.quoteCargo.length > 0
                            ? route.quoteCargo
                            : [{
                                CargoType: this.getRouteValue(route, ['cargoType', 'CargoType'], ''),
                                GrossWeight: this.getRouteValue(route, ['GrossWeight']),
                                NetWeight: this.getRouteValue(route, ['NetWeight']),
                                Volume: this.getRouteValue(route, ['Volume', 'CBM']),
                                ContainerType: this.getRouteValue(route, ['ContainerType'], ''),
                                Qty: this.getRouteValue(route, ['Qty', 'NoofContainers', 'NoOfContainers']),
                                ShipmentTerms: this.getRouteValue(route, ['ShipmentTerms', 'ServiceLevel'], ''),
                            }];

                        const createdQuoteCargo = await Promise.all(
                            routeCargoItems.map((cargoItem: any) =>
                                prisma.quoteCargo.create({
                                    data: {
                                        CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                        BranchMasterSid: quoteHeader.BranchMasterSid,
                                        QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                        QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                                        CreatedBy: user['userEmail'],
                                        Status: "A",
                                        CargoType: cargoItem.CargoType || '',
                                        GrossWeight: Number(cargoItem.GrossWeight) || 0,
                                        NetWeight: Number(cargoItem.NetWeight) || 0,
                                        Volume: Number(cargoItem.Volume) || 0,
                                        ContainerType: cargoItem.ContainerType || '',
                                        Qty: Number(cargoItem.Qty) || 0,
                                        ShipmentTerms: cargoItem.ShipmentTerms || route.ServiceLevel || '',
                                    },
                                })
                            )
                        );

                        return { createdQuoteRoute, createdQuoteCarrier, createdQuoteCargo };
                    })
                );

                // Step 3: Create Quote Charges
                const quoteCargoPayload = quoteRoutes.flatMap((quoteRoute, index) =>
                    (Array.isArray(routes[index]?.cargo) ? routes[index].cargo : (Array.isArray(routes[index]?.quoteCharges) ? routes[index].quoteCharges : [])).map(cargo => ({
                        CompanyMasterSid: quoteHeader.CompanyMasterSid,
                        BranchMasterSid: quoteHeader.BranchMasterSid,
                        QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                        QuoteRouteSid: quoteRoute.createdQuoteRoute.QuoteRouteSid, // Fixed reference
                        CustomerMasterSid: quoteHeader.CustomerMasterSid,
                        ChargeUomSid: this.toNullableNumber(cargo.ChargeUomSid),
                        ChargeDisplayName: cargo.charge ?? cargo.ChargeDisplayName ?? '',
                        CurrencyMasterSid: this.toNullableNumber(cargo.currency ?? cargo.CurrencyMasterSid),
                        UOMMasterSid: this.toNullableNumber(cargo.unit ?? cargo.UOMMasterSid ?? cargo.RevenueChargeUomSid),
                        RevenueChargeUomSid: this.toNullableNumber(cargo.unit ?? cargo.RevenueChargeUomSid ?? cargo.UOMMasterSid),
                        perUnit: cargo.perUnit ?? cargo.RevenueRate ?? null,
                        RevenueRate: cargo.RevenueRate ?? cargo.perUnit ?? null,
                        RevenueAmount: cargo.revenueAmount ?? cargo.RevenueAmount ?? null,
                        RevenueLocalAmount: cargo.revenueLocalAmount ?? cargo.RevenueLocalAmount ?? null,
                        CostChargeUomSid: this.toNullableNumber(cargo.costUnit ?? cargo.CostChargeUomSid),
                        CostCurrencyMasterSid: this.toNullableNumber(cargo.costCurrency ?? cargo.CostCurrencyMasterSid),
                        costUnit: (cargo.costUnit ?? cargo.CostChargeUomSid) ? String(cargo.costUnit ?? cargo.CostChargeUomSid) : null,
                        costCurrency: (cargo.costCurrency ?? cargo.CostCurrencyMasterSid) ? String(cargo.costCurrency ?? cargo.CostCurrencyMasterSid) : null,
                        costPerUnit: cargo.costPerUnit ?? cargo.CostRate ?? null,
                        CostRate: cargo.CostRate ?? cargo.costPerUnit ?? null,
                        CostAmount: cargo.costAmount ?? cargo.CostAmount ?? null,
                        CostLocalAmount: cargo.costLocalAmount ?? cargo.CostLocalAmount ?? null,
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




    async getAllQuotations(user: any) {
        try {
            const companyEntry = user?.userCompanyMaster?.find((company: any) => company?.IsDefault === 'Y' && company?.status === 'A')
                || user?.userCompanyMaster?.[0];
            const companyMaster = companyEntry?.companyMaster;
            const branchEntry = companyMaster?.userBranchMaster?.find((branch: any) => branch?.IsDefault === 'Y' && branch?.status === 'A')
                || companyMaster?.userBranchMaster?.[0];

            const CompanyMasterSid = Number(companyEntry?.CompanyMasterSid || companyMaster?.CompanyMasterSid || 0);
            const BranchMasterSid = Number(branchEntry?.BranchMasterSid || branchEntry?.branchMaster?.BranchMasterSid || 0);

            if (!CompanyMasterSid || !BranchMasterSid) {
                return [];
            }

            const quotations = await this._db.quoteHeader.findMany({
                where: {
                    CompanyMasterSid,
                    BranchMasterSid
                },
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

    async searchQuotations(payload: any) {
        try {
            const CompanyMasterSid = Number(payload?.CompanyMasterSid || 0);
            const BranchMasterSid = Number(payload?.BranchMasterSid || 0);

            if (!CompanyMasterSid || !BranchMasterSid) {
                throw new Error('CompanyMasterSid and BranchMasterSid are required');
            }

            const quotations = await this._db.quoteHeader.findMany({
                where: {
                    CompanyMasterSid,
                    BranchMasterSid,
                    status: { not: 'D' }
                },
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
            throw error;
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
                            quoteCargo: {
                                where: {
                                    Status: 'A'
                                }
                            },
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
            const quoteDate = (payload.quoteDate || payload.QuoteDate) ? new Date(payload.quoteDate || payload.QuoteDate) : new Date();
            const CompanyMasterSid = Number(payload.CompanyMasterSid || 0);
            const BranchMasterSid = Number(payload.BranchMasterSid || 0);
            const routes = this.getRoutesFromPayload(payload);
            const SalesmanSid =
                user?.['UserMasterSid']
                ?? user?.['userBranchMaster']?.[0]?.UserMasterSid
                ?? user?.['userCompanyMaster']?.[0]?.UserMasterSid
                ?? null;

            if (!CompanyMasterSid || !BranchMasterSid) {
                throw new Error('CompanyMasterSid and BranchMasterSid are required');
            }

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
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    ...(statusUpdate ? { status: statusUpdate } : {}),
                    updatedBy: user['userEmail'],
                    updatedOn: new Date()
                }
            });

            let finalRouteData: any = [];
            let finalCargoData: any = [];

            // Step 2: Update or create routes
            for (const route of routes) {
                let updateData, createData;

                if (route.QuoteRouteSid) {
                    updateData = await this._db.quoteRoute.update({
                        where: { QuoteRouteSid: route.QuoteRouteSid },
                        data: {
                            PORSid: this.toNullableNumber(this.getRouteValue(route, ['POR', 'PORSid'])) ?? undefined,
                            POLSid: this.toNullableNumber(this.getRouteValue(route, ['POL', 'POLSid'])) ?? undefined,
                            PODSid: this.toNullableNumber(this.getRouteValue(route, ['POD', 'PODSid'])) ?? undefined,
                            FDPSid: this.toNullableNumber(this.getRouteValue(route, ['FPOD', 'FPODSid', 'FDPSid'])) ?? undefined,
                            CarrierName: this.getRouteValue(route, ['Carrier', 'CarrierName'], ''),
                            CarrierMasterSid: this.toNullableNumber(this.getRouteValue(route, ['CarrierMasterSid'])),
                            ServiceLevel: this.getRouteValue(route, ['ServiceLevel', 'ShipmentTerms', 'IncoTerms'], null),
                            effDate: this.toNullableDate(route.effDate),
                            expdate: this.toNullableDate(route.expDate),
                            twentyft: Number(route.twentyft) || null,
                            fortyft: Number(route.fortyft) || null,
                            updatedBy: user['userEmail'],
                            updatedOn: new Date(),
                            cargoType: this.getRouteValue(route, ['cargoType', 'CargoType'], ''),
                            TransitDays: this.toNullableNumber(this.getRouteValue(route, ['transit', 'TransitDays']))
                        }
                    });
                } else {
                    createData = await this._db.quoteRoute.create({
                        data: {
                            PORSid: this.toRequiredNumber(this.getRouteValue(route, ['POR', 'PORSid'])),
                            POLSid: this.toRequiredNumber(this.getRouteValue(route, ['POL', 'POLSid'])),
                            PODSid: this.toRequiredNumber(this.getRouteValue(route, ['POD', 'PODSid'])),
                            FDPSid: this.toRequiredNumber(this.getRouteValue(route, ['FPOD', 'FPODSid', 'FDPSid'])),
                            CarrierName: this.getRouteValue(route, ['Carrier', 'CarrierName'], ''),
                            CarrierMasterSid: this.toNullableNumber(this.getRouteValue(route, ['CarrierMasterSid'])),
                            ServiceLevel: this.getRouteValue(route, ['ServiceLevel', 'ShipmentTerms', 'IncoTerms'], null),
                            effDate: this.toNullableDate(route.effDate),
                            expdate: this.toNullableDate(route.expDate),
                            twentyft: Number(route.twentyft) || null,
                            fortyft: Number(route.fortyft) || null,
                            cargoType: this.getRouteValue(route, ['cargoType', 'CargoType'], ''),
                            TransitDays: this.toNullableNumber(this.getRouteValue(route, ['transit', 'TransitDays'])),
                            DepartmentMasterSid: this.toRequiredNumber(route.DepartmentMasterSid),
                            CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                            BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                            QuoteHeaderSid: QuoteHeaderSid,
                            createdBy: user['userEmail'],
                        }
                    });
                }

                const routeData = updateData || createData;
                finalRouteData.push(routeData);

                const routeCargoItems = Array.isArray(route.quoteCargo) && route.quoteCargo.length > 0
                    ? route.quoteCargo
                    : [{
                        CargoType: this.getRouteValue(route, ['cargoType', 'CargoType'], ''),
                        GrossWeight: this.getRouteValue(route, ['GrossWeight']),
                        NetWeight: this.getRouteValue(route, ['NetWeight']),
                        Volume: this.getRouteValue(route, ['Volume', 'CBM']),
                        ContainerType: this.getRouteValue(route, ['ContainerType'], ''),
                        Qty: this.getRouteValue(route, ['Qty', 'NoofContainers', 'NoOfContainers']),
                        ShipmentTerms: this.getRouteValue(route, ['ShipmentTerms', 'ServiceLevel'], ''),
                    }];

                const incomingCargoIds = routeCargoItems
                    .map((item: any) => Number(item.QuoteCargoSid))
                    .filter((id: number) => !!id);

                await this._db.quoteCargo.updateMany({
                    where: {
                        QuoteRouteSid: routeData.QuoteRouteSid,
                        Status: 'A',
                        ...(incomingCargoIds.length ? { QuoteCargoSid: { notIn: incomingCargoIds } } : {})
                    },
                    data: {
                        Status: 'D',
                        UpdatedBy: user['userEmail'],
                        UpdatedOn: new Date()
                    }
                });

                for (const cargoItem of routeCargoItems) {
                    const quoteCargoSid = Number(cargoItem.QuoteCargoSid || 0);
                    const cargoPayload = {
                        CargoType: cargoItem.CargoType || '',
                        GrossWeight: Number(cargoItem.GrossWeight) || 0,
                        NetWeight: Number(cargoItem.NetWeight) || 0,
                        Volume: Number(cargoItem.Volume) || 0,
                        ContainerType: cargoItem.ContainerType || '',
                        Qty: Number(cargoItem.Qty) || 0,
                        ShipmentTerms: cargoItem.ShipmentTerms || route.ServiceLevel || '',
                    };

                    if (quoteCargoSid) {
                        await this._db.quoteCargo.update({
                            where: { QuoteCargoSid: quoteCargoSid },
                            data: {
                                ...cargoPayload,
                                Status: 'A',
                                UpdatedBy: user['userEmail'],
                                UpdatedOn: new Date()
                            }
                        });
                    } else {
                        await this._db.quoteCargo.create({
                            data: {
                                CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                                BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                                QuoteHeaderSid: QuoteHeaderSid,
                                QuoteRouteSid: routeData.QuoteRouteSid,
                                CreatedBy: user['userEmail'],
                                Status: 'A',
                                ...cargoPayload
                            }
                        });
                    }
                }

                // Step 3: Update or create cargo for each route
                const routeCharges = Array.isArray(route.cargo)
                    ? route.cargo
                    : (Array.isArray(route.quoteCharges) ? route.quoteCharges : []);
                if (routeCharges.length > 0) {
                    for (const cargoItem of routeCharges) {
                        let updateCargoData;
                        let createCargoData;

                        if (cargoItem.QuoteChargeSid) {
                            updateCargoData = await this._db.quoteCharge.update({
                                where: { QuoteChargeSid: cargoItem.QuoteChargeSid },
                                data: {
                                    ChargeUomSid: this.toNullableNumber(cargoItem.ChargeUomSid),
                                    ChargeDisplayName: cargoItem.charge ?? cargoItem.ChargeDisplayName ?? '',
                                    CurrencyMasterSid: this.toNullableNumber(cargoItem.currency ?? cargoItem.CurrencyMasterSid),
                                    UOMMasterSid: this.toNullableNumber(cargoItem.unit ?? cargoItem.UOMMasterSid ?? cargoItem.RevenueChargeUomSid),
                                    RevenueChargeUomSid: this.toNullableNumber(cargoItem.unit ?? cargoItem.RevenueChargeUomSid ?? cargoItem.UOMMasterSid),
                                    perUnit: cargoItem.perUnit ?? cargoItem.RevenueRate ?? null,
                                    RevenueRate: cargoItem.RevenueRate ?? cargoItem.perUnit ?? null,
                                    RevenueAmount: cargoItem.revenueAmount ?? cargoItem.RevenueAmount ?? null,
                                    RevenueLocalAmount: cargoItem.revenueLocalAmount ?? cargoItem.RevenueLocalAmount ?? null,
                                    CostChargeUomSid: this.toNullableNumber(cargoItem.costUnit ?? cargoItem.CostChargeUomSid),
                                    CostCurrencyMasterSid: this.toNullableNumber(cargoItem.costCurrency ?? cargoItem.CostCurrencyMasterSid),
                                    costUnit: (cargoItem.costUnit ?? cargoItem.CostChargeUomSid) ? String(cargoItem.costUnit ?? cargoItem.CostChargeUomSid) : null,
                                    costCurrency: (cargoItem.costCurrency ?? cargoItem.CostCurrencyMasterSid) ? String(cargoItem.costCurrency ?? cargoItem.CostCurrencyMasterSid) : null,
                                    costPerUnit: cargoItem.costPerUnit ?? cargoItem.CostRate ?? null,
                                    CostRate: cargoItem.CostRate ?? cargoItem.costPerUnit ?? null,
                                    CostAmount: cargoItem.costAmount ?? cargoItem.CostAmount ?? null,
                                    CostLocalAmount: cargoItem.costLocalAmount ?? cargoItem.CostLocalAmount ?? null,
                                    updatedBy: user['userEmail'],
                                    updatedOn: new Date(),
                                }
                            });
                        } else {
                            createCargoData = await this._db.quoteCharge.create({
                                data: {
                                    ChargeUomSid: this.toNullableNumber(cargoItem.ChargeUomSid),
                                    ChargeDisplayName: cargoItem.charge ?? cargoItem.ChargeDisplayName ?? '',
                                    CurrencyMasterSid: this.toNullableNumber(cargoItem.currency ?? cargoItem.CurrencyMasterSid),
                                    UOMMasterSid: this.toNullableNumber(cargoItem.unit ?? cargoItem.UOMMasterSid ?? cargoItem.RevenueChargeUomSid),
                                    RevenueChargeUomSid: this.toNullableNumber(cargoItem.unit ?? cargoItem.RevenueChargeUomSid ?? cargoItem.UOMMasterSid),
                                    perUnit: cargoItem.perUnit ?? cargoItem.RevenueRate ?? null,
                                    RevenueRate: cargoItem.RevenueRate ?? cargoItem.perUnit ?? null,
                                    RevenueAmount: cargoItem.revenueAmount ?? cargoItem.RevenueAmount ?? null,
                                    RevenueLocalAmount: cargoItem.revenueLocalAmount ?? cargoItem.RevenueLocalAmount ?? null,
                                    CostChargeUomSid: this.toNullableNumber(cargoItem.costUnit ?? cargoItem.CostChargeUomSid),
                                    CostCurrencyMasterSid: this.toNullableNumber(cargoItem.costCurrency ?? cargoItem.CostCurrencyMasterSid),
                                    costUnit: (cargoItem.costUnit ?? cargoItem.CostChargeUomSid) ? String(cargoItem.costUnit ?? cargoItem.CostChargeUomSid) : null,
                                    costCurrency: (cargoItem.costCurrency ?? cargoItem.CostCurrencyMasterSid) ? String(cargoItem.costCurrency ?? cargoItem.CostCurrencyMasterSid) : null,
                                    costPerUnit: cargoItem.costPerUnit ?? cargoItem.CostRate ?? null,
                                    CostRate: cargoItem.CostRate ?? cargoItem.costPerUnit ?? null,
                                    CostAmount: cargoItem.costAmount ?? cargoItem.CostAmount ?? null,
                                    CostLocalAmount: cargoItem.costLocalAmount ?? cargoItem.CostLocalAmount ?? null,
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

            const updatedQuotation = await this._db.quoteHeader.findUnique({
                where: { QuoteHeaderSid: QuoteHeaderSid },
                include: {
                    quoteRoute: {
                        where: { status: 'A' },
                        include: {
                            quoteCargo: {
                                where: { Status: 'A' }
                            },
                            quoteCharge: {
                                where: { status: 'A' }
                            }
                        }
                    }
                }
            });

            return {
                status: true,
                message: 'Quotation updated successfully',
                data: {
                    updatedQuoteHeader: updatedQuoteHeader,
                    finalRouteData: finalRouteData, // Now an array
                    finalCargoData: finalCargoData,  // Now an array
                    updatedQuotation
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

