import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import * as moment from 'moment-timezone';
import { SearchListDto } from "src/masters/DTO/search-list.dto";
import { filterDto } from "src/masters/DTO/search-vessel.dto";
import { GlobalConfigService } from "src/common/config/master-config.service";
import { contains } from "class-validator";
import { statusWhereClause } from "src/common/helper";

@Injectable()
export class QuotationService {
    constructor(
        private _db: DatabaseService, private logger: Logger,
        private globalConfigService: GlobalConfigService
    ) { }

    async createQuotation(payload) {
        try {
            return await this._db.$transaction(async (prisma) => {
                const dateString = moment().format('YYYYMMDD');
                const count = await this._db.quoteHeader.count({
                    where: { QuoteNumber: { contains: dateString } }
                });
                const quoteNumber = `quotation-${dateString}-${(count + 1).toString().padStart(3, '0')}`;

                // Step 1: Create Quote Header
                const quoteDate = payload.quoteDate ? new Date(payload.QuoteDate) : new Date();
                const quoteHeaderPayload: any = {
                    CustomerName: payload.CustomerName,
                    CustomerMasterSid: Number(payload.CustomerMasterSid),
                    CustomerBranchSid: payload.CustomerBranchSid,
                    QuoteDate: quoteDate,
                    EnquirySid: payload.EnquirySid ? Number(payload.EnquirySid) : null,
                    CustomerAddress: payload.CustomerAddress,
                    Email: payload.Email,
                    CustomerRef: payload.CustomerRef,
                    IncoTerms: payload.IncoTerms,
                    ClearanceBy: payload.ClearanceBy,
                    TransportBy: payload.TransportBy,
                    SalesmanSid: payload.SalesmanSid,
                    Remarks: payload.Remarks,
                    status: payload.status || "A",
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    LeadOrCustomer: payload.LeadOrCustomer,
                    PreCustomerMasterSid: payload.PreCustomerMasterSid,
                    FreightPPCC: payload.FreightPPCC,
                    // QuoteNumber: quoteNumber,
                    createdBy: payload.createdBy,
                    authorizerStatus: payload.authorizerStatus || 'Pending',
                    AuthorizerRemarks: payload.AuthorizerRemarks || ''
                };

                const quoteHeader = await prisma.quoteHeader.create({ data: quoteHeaderPayload });

                // Step 2: Create Quote Routes & Quote Carriers
                const quoteRoutes = await Promise.all(
                    payload.routes.map(async (route,index) => {
                        const createdQuoteRoute = await prisma.quoteRoute.create({
                            data: {
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                DepartmentMasterSid: Number(route.DepartmentMasterSid),
                                POLFreeDays: Number(route.POLFreeDays),
                                PODFreeDays: Number(route.PODFreeDays),
                                PORSid: Number(route.PORSid),
                                POLSid: Number(route.POLSid),
                                PODSid: Number(route.PODSid),
                                FDPSid: Number(route.FPODSid),
                                Remarks: route.Remarks || '',
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                effDate: new Date(route.effDate),
                                expdate: new Date(route.expDate),
                                createdBy: payload.createdBy,
                                TransitDays: Number(route.TransitDays) || Number(route.transit) || null,
                                segmentType: route.segmentType,
                                ServiceLevel: route.ServiceLevel,

                                // Need to be removed later
                                CarrierName : "hello",
                            },
                        });

                        const createdQuoteCarrier = await prisma.quoteCarrier.create({
                            data: {
                                QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                CarrierMasterSid: route.CarrierMasterSid,
                                CarrierName: route.CarrierName,
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                ApprovalStatus: "P",
                                createdBy: payload.createdBy,
                            },
                        });


                        const cargo = route.cargo;
                        const quoteCargo = await this._db.quoteCargo.create({
                            data : {
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                                CreatedBy : payload.createdBy,
                                Status : "A",
                                CargoType :  route.CargoType,
                                WeightUnitSid : route.WeightUnitSid,
                                GrossWeight : Number(route.GrossWeight) || 0,
                                NetWeight : Number(route.NetWeight) || 0,
                                Volume : Number(route.Volume) || 0,
                                ChargeableWeight : Number(route.ChargeableWeight) || 0,
                                ContainerType : route.ContainerType,
                                Qty : Number(route.Qty) || 0,
                                ShipmentTerms : route.ShipmentTerms,
                                PackageType : route.PackageType,
                                PackageQty : Number(route.PackageQty) || 0,
                                CargoDescription : route.CargoDescription,
                            }
                        })

                        const products = await this._db.quoteProduct.createMany({
                            data: payload.routes[index].products.map((product,index) => ({
                                Sno: index + 1,
                                ProductSid: product.ProductSid,
                                ProductName: product.ProductName,
                                PackageType: product.PackageType,
                                CargoDescription: product.CargoDescription,
                                ProductUnit: product.ProductUnit,
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                QuoteCargoSid: quoteCargo.QuoteCargoSid,
                                CreatedBy: payload.createdBy,
                                Status: "A",
                                ExternalPkg: product.ExternalPkg,
                                ExternalQty: Number(product.ExternalQty) || 0,
                                GrossWeight: Number(product.GrossWeight) || 0,
                                NetWeight: Number(product.NetWeight) || 0,
                                Volume : Number(product.Volume) || 0,
                                Length: Number(product.Length) || 0,
                                Width: Number(product.Width) || 0,
                                Height: Number(product.Height) || 0,
                                ChargeableWeight: Number(product.ChargeableWeight) || 0,
                                IsHaz: product.IsHaz,
                                ImcoClass: product.ImcoClass,
                                PkgGroup: product.PkgGroup,
                                Remarks: product.Remarks
                            }))
                        });
                        
                        const quoteCharge = payload.routes[index].charges || [];
                        const charges = await prisma.quoteCharge.create({
                            data : {
                                QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                                QuoteHeaderSid: payload.QuoteHeaderSid,
                                QuoteCarrierSid: createdQuoteCarrier.QuoteCarrierSid,
                                CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                BranchMasterSid: quoteHeader.BranchMasterSid,
                                createdBy: payload.createdBy,
                                status: "A",
                                ChargeUomSid: quoteCharge.ChargeUomSid,
                                ChargeDisplayName: quoteCharge.ChargeDisplayName,
                                CostChargeUomSid : quoteCharge.CostChargeUomSid,
                                CostPrepaidCollect : quoteCharge.CostPrepaidCollect || "Prepaid" ,
                                CostCurrencyMasterSid : quoteCharge.CostCurrencyMasterSid,
                                CostExchangeRate : Number(quoteCharge.CostExchangeRate) || 0,
                                CostRate : Number(quoteCharge.CostRate) || 0,
                                CostNumberOfUnit : Number(quoteCharge.CostNumberOfUnit) || 0,
                                CostDrCr : quoteCharge.CostDrCr || "D",
                                CostAmount : Number(quoteCharge.CostAmount) || 0,
                                CostLocalAmount : Number(quoteCharge.CostLocalAmount) || 0,
                                CostAgentMasterSid : quoteCharge.CostAgentMasterSid,
                                CostAgentBranchSid : quoteCharge.CostAgentBranchSid,
                                RevenueChargeUomSid : quoteCharge.RevenueChargeUomSid,
                                RevenuePrepaidCollect : quoteCharge.RevenuePrepaidCollect || "Prepaid",
                                RevenueCurrencyMasterSid : quoteCharge.RevenueCurrencyMasterSid,
                                RevenueExchangeRate : Number(quoteCharge.RevenueExchangeRate) || 0,
                                RevenueRate : Number(quoteCharge.RevenueRate) || 0,
                                RevenueNumberOfUnit : Number(quoteCharge.RevenueNumberOfUnit) || 0,
                                RevenueDrCr : quoteCharge.RevenueDrCr || "C",
                                RevenueAmount : Number(quoteCharge.RevenueAmount) || 0,
                                RevenueLocalAmount : Number(quoteCharge.RevenueLocalAmount) || 0,
                                RevenueCustomerMasterSid : quoteCharge.RevenueCustomerMasterSid,
                                RevenueCustomerBranchSid : quoteCharge.RevenueCustomerBranchSid,
                                Remarks : quoteCharge.Remarks,
                            }
                        });

                        if (quoteHeader) {
                            await this._db.preCustomerMaster.update({
                                where: {
                                    PreCustomerMasterSid: payload.PreCustomerMasterSid
                                }, data: {
                                    leadStatus: LeadStatus.QuotationCreated
                                }
                            })
                        }


                        return { createdQuoteRoute, createdQuoteCarrier };
                    })
                );

                return {
                    message: 'Quote created successfully',
                    data: {
                        quoteHeader,
                        quoteRoutes
                    }
                };
            });
        } catch (error) {
            throw new Error(`Transaction failed: ${error.stack}`);
        }
    }




    async getAllQuotations(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const quotations = await this._db.quoteHeader.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                select: {
                    QuoteHeaderSid: true,
                    QuoteNumber: true,
                    CustomerName: true,
                    EnquirySid: true,
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
            throw error
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
                        where: { status: statusWhereClause },
                        include: {
                            quoteCarrier : { where : { status: statusWhereClause } },
                            quoteCargo : {
                                where: { Status: statusWhereClause },
                                include : { 
                                    quoteProduct : { where : { Status: statusWhereClause } },
                                }
                            },
                            quoteCharge : {
                                where: { status: statusWhereClause },
                            }
                        }
                    }
                }
            });
        } catch (error) {
            throw error;
        }
    }

    async updateQuote(QuoteHeaderSid: number, payload) {
        try {
            // Step 1: Update Enquiry Header
            const quoteDate = payload.QuoteDate ? new Date(payload.quoteDate) : new Date();

            let authLogUpdate;
            if (payload.approvalStatusChange) {
                const authorityDetail = await this._db.authorityDetail.findFirst({
                    where: {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        UserMasterSid: payload.UserMasterSid,
                        status: 'A',
                        authorityMaster: {
                            MenuMaster: payload.MenuMaster,
                            status: 'A',
                        },
                    },
                });

                if (!authorityDetail) {
                    throw new NotFoundException('AuthorityDetail not found for this user/menu.');
                }

                authLogUpdate = await this._db.authorityLog.create({
                    data: {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        CreatedBy: payload.updatedBy,
                        UpdatedBy: payload.updatedBy,
                        CreatedOn: new Date(),
                        UpdatedOn: new Date(),
                        Status: 'A',
                        DocumentSid: QuoteHeaderSid,
                        AuthorityDetailSid: authorityDetail.AuthorityDetailSid,
                        ApprovalStatus: payload.authorizerStatus,
                        AuthorisedDate: new Date(),
                        Remarks: payload.AuthorizerRemarks,
                    },
                });

                if (authorityDetail.FinalAuthority === 'Y') {

                    await this._db.quoteHeader.update({
                        where: { QuoteHeaderSid },
                        data: {
                            authorizerStatus: payload.authorizerStatus,
                            AuthorizerRemarks: payload.AuthorizerRemarks,
                        },
                    });
                }
            }



            const updatedQuoteHeader = await this._db.quoteHeader.update({
                where: { QuoteHeaderSid: QuoteHeaderSid },
                data: {
                    CustomerRef: payload.CustomerRef,
                    Email: payload.Email,
                    status: payload.status,
                    SalesmanSid: payload.SalesmanSid,
                    CustomerName: payload.CustomerName,
                    EnquirySid: payload.EnquirySid ? Number(payload.EnquirySid) : null,
                    FreightPPCC: payload.FreightPPCC,
                    CustomerAddress: payload.CustomerAddress,
                    CustomerBranchSid: payload.CustomerBranchSid,
                    IncoTerms: payload.IncoTerms,
                    ClearanceBy: payload.ClearanceBy,
                    TransportBy: payload.TransportBy,
                    Remarks: payload.Remarks,
                    updatedBy: payload.updatedBy,
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
                            PORSid: Number(route.PORSid),
                            POLSid: Number(route.POLSid),
                            PODSid: Number(route.PODSid),
                            FDPSid: Number(route.FPODSid),
                            CarrierName: route.CarrierName,
                            CarrierMasterSid: route.CarrierMasterSid,
                            CargoType: route.CargoType,
                            effDate: new Date(route.effDate),
                            expdate: new Date(route.expDate),
                            twentyft: Number(route.twentyft) || null,
                            fortyft: Number(route.fortyft) || null,
                            ContainerType: route.ContainerType,
                            ContainerQty: route.ContainerQty,
                            CBM: route.CBM,
                            ChargeableWeight: route.ChargeableWeight,
                            updatedBy: payload.updatedBy,
                            updatedOn: new Date(),
                            ServiceLevel: route.ServiceLevel,
                            cargoType: route.cargoType,
                            segmentType: route.segmentType,
                            POLFreeDays: Number(route.POLFreeDays),
                            PODFreeDays: Number(route.PODFreeDays),
                            TransitDays: Number(route.TransitDays) || Number(route.transit) || null,
                        }
                    });
                } else {
                    createData = await this._db.quoteRoute.create({
                        data: {
                            PORSid: Number(route.PORSid),
                            POLSid: Number(route.POLSid),
                            PODSid: Number(route.PODSid),
                            FDPSid: Number(route.FPODSid),
                            CarrierName: route.CarrierName,
                            CarrierMasterSid: route.CarrierMasterSid,
                            effDate: new Date(route.effDate),
                            expdate: new Date(route.expDate),
                            twentyft: Number(route.twentyft) || null,
                            fortyft: Number(route.fortyft) || null,
                            CargoType: route.CargoType,
                            ContainerType: route.ContainerType,
                            ContainerQty: route.ContainerQty,
                            CBM: route.CBM,
                            ChargeableWeight: route.ChargeableWeight,
                            cargoType: route.cargoType,
                            segmentType: route.segmentType,
                            ServiceLevel: route.ServiceLevel,
                            POLFreeDays: Number(route.POLFreeDays),
                            PODFreeDays: Number(route.PODFreeDays),
                            TransitDays: Number(route.TransitDays) || Number(route.transit) || null,
                            DepartmentMasterSid: Number(route.DepartmentMasterSid),
                            CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                            BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                            QuoteHeaderSid: QuoteHeaderSid,
                            createdBy: payload.updatedBy,
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
                                    ChargeUomSid: cargoItem.ChargeUomSid,
                                    ChargeDisplayName: cargoItem.ChargeDisplayName,
                                    CurrencyMasterSid: cargoItem.CurrencyMasterSid,
                                    UOMMasterSid: cargoItem.UOMMasterSid,
                                    Qty: Number(cargoItem.Qty),
                                    perUnit: Number(cargoItem.perUnit),
                                    Amount: Number(cargoItem.Amount),
                                    costUnit: cargoItem.costUnit,
                                    costCurrency: cargoItem.costCurrency,
                                    costPerUnit: Number(cargoItem.costPerUnit),
                                    CostAgentMasterSid : cargoItem.CostAgentMasterSid,
                                    CostAgentBranchSid : cargoItem.CostAgentBranchSid,
                                    RevenueCustomerMasterSid : cargoItem.RevenueCustomerMasterSid,
                                    RevenueCustomerBranchSid : cargoItem.RevenueCustomerBranchSid,
                                    updatedBy: payload.updatedBy,
                                    updatedOn: new Date(),
                                }
                            });
                        } else {
                            createCargoData = await this._db.quoteCharge.create({
                                data: {
                                    ChargeUomSid: cargoItem.ChargeUomSid,
                                    ChargeDisplayName: cargoItem.ChargeDisplayName,
                                    CurrencyMasterSid: cargoItem.CurrencyMasterSid,
                                    UOMMasterSid: cargoItem.UOMMasterSid,
                                    Qty: Number(cargoItem.Qty),
                                    perUnit: Number(cargoItem.perUnit),
                                    Amount: Number(cargoItem.Amount),
                                    costUnit: cargoItem.costUnit,
                                    costCurrency: cargoItem.costCurrency,
                                    costPerUnit: Number(cargoItem.costPerUnit),
                                    QuoteHeaderSid: QuoteHeaderSid,
                                    QuoteRouteSid: routeData.QuoteRouteSid, // Link to the correct route
                                    createdBy: payload.updatedBy,
                                    CostAgentMasterSid: cargoItem.CostAgentMasterSid,
                                    CostAgentBranchSid: cargoItem.CostAgentBranchSid,
                                    RevenueCustomerMasterSid: cargoItem.RevenueCustomerMasterSid,
                                    RevenueCustomerBranchSid: cargoItem.RevenueCustomerBranchSid,
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
                    finalCargoData: finalCargoData,  // Now an array
                    authLogUpdate
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

        if (existingQuote.status === 'D') {
            throw new Error(`Quote with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.quoteHeader.update({
            where: { QuoteHeaderSid: id },
            data: { status: 'D' }
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
            data: { status: 'D' }
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
            data: { status: 'D' }
        });
    }

    async getAllMasters(CompanyMasterSid: number) {
        try {
            const [charges, units, currencies] = await this._db.$transaction([
                this._db.chargeMaster.findMany({
                    where: {
                        Status: 'A',
                        CompanyMasterSid: CompanyMasterSid
                    }
                }),
                this._db.unitMaster.findMany({
                    where: {
                        status: 'A'
                    }
                }),
                this._db.currencyMaster.findMany({
                    where: {
                        status: 'A'
                    }
                }),
            ]);

            return { charges, units, currencies };
        } catch (error) {
            throw new Error("Failed to fetch master data.");
        }
    }



    async getAllCustomer(CompanyMasterSid: number) {
        try {
            const customers = await this._db.customerMaster.findMany({
                where: {
                    CustomerType: {
                        path: ['carrier'],
                        equals: 'isTrue'
                    },
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            });


            return customers;
        } catch (error) {
            throw error
        }
    }

    async searchQuotation(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.QuoteHeaderWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(search
                ? {
                    OR: [
                        { enquiryHeader: { EnquiryNumber: { contains: search, mode: 'insensitive'}}},
                        { enquiryHeader: { CustomerName: { contains: search, mode: 'insensitive'}}},
                        { enquiryHeader: { ShipmentType: { contains: search, mode: 'insensitive'}}},
                        { enquiryHeader: { enquiryRoute: {some: { POLSid: Number(search)}}}},
                        { enquiryHeader: { enquiryRoute: {some: { PODSid: Number(search)}}}},
                        { QuoteNumber: { contains: search, mode: 'insensitive' } },
                        { CustomerName: { contains: search, mode: 'insensitive' } },
                        { departmentMaster: {departmentName: {contains: search, mode: 'insensitive'}}},
                        { quoteRoute: {some: { POLSid: Number(search)}}},
                        { quoteRoute: {some: { PODSid: Number(search)}}},
                        { status: {contains: search, mode: 'insensitive'}},
                        ...(!isNaN(new Date(search).getTime())
                            ? [{ QuoteDate: new Date(search) }]
                            : []),
                    ],
                }
                : {}),
        };
        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.quoteHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { QuoteHeaderSid: 'desc' },
                include: {
                    quoteRoute: {
                        where: {
                            status: 'A'
                        },
                        include: {
                            departmentMaster: {
                                select: {
                                    departmentName: true
                                }
                            },
                            quoteCharge: {
                                where: {
                                    status: 'A'
                                },
                                include: {
                                    uomMaster: { select: { UOMCode: true } },
                                    currencyMaster: { select: { currencyCode: true } },

                                }
                            }
                        }
                    }
                }
            }),
            this._db.quoteHeader.count({ where }),
        ]);
        console.log(items);
        items = await Promise.all(
            items.map(async (item) => {
                const updatedRoutes = await Promise.all(
                    item.quoteRoute.map(async (route) => {

                        const [departmentMaster, PortPOL, PortPOD] = await Promise.all([
                            route.DepartmentMasterSid !== null ?
                                this.globalConfigService.getMasterData('department_master', route.DepartmentMasterSid) : { departmentName: '' },
                            route.POLSid !== null ? this.globalConfigService.getMasterData('port_master', route.POLSid) : { PortName: '' },
                            route.PODSid !== null ?
                                this.globalConfigService.getMasterData('port_master', route.PODSid) : { PortName: '' }
                        ]);

                        const updatedCharges = await Promise.all(
                            route.quoteCharge.map(async (charge) => {
                                const [uomMaster, currencyMaster] = await Promise.all([

                                    charge.UOMMasterSid !== null
                                        ? this.globalConfigService.getMasterData(
                                            'uom_master',
                                            charge.UOMMasterSid
                                        )
                                        : { UOMMasterSid: null, UOMName: '', UOMCode: '' },

                                    charge.CurrencyMasterSid !== null
                                        ? this.globalConfigService.getMasterData(
                                            'currency_master',
                                            charge.CurrencyMasterSid
                                        )
                                        : { CurrencyMasterSid: null, currencyName: '', currencyCode: '' },
                                ]);

                                return {
                                    ...charge,
                                    uomMaster,
                                    currencyMaster,
                                };
                            })
                        );
                        return {
                            ...route,
                            departmentMaster,
                            PortPOL,
                            PortPOD,
                            quoteCharge: updatedCharges,
                        };
                    })
                )
                return {
                    ...item,
                    quoteRoute: updatedRoutes,
                };
            })
        )
        return {
            items,
            totalCount,
        };
    }

    async getAllSalesperson() {
        try {

            const allSalespersons = await this._db.customerSalesTeam.findMany({
                where: {
                    status: 'A',
                },
            });

            if (allSalespersons.length === 0) return [];


            const salesmanIds = [...new Set(allSalespersons.map(sp => sp.Salesman))];


            const users = await this._db.userMaster.findMany({
                where: {
                    UserMasterSid: { in: salesmanIds },
                    status: 'A',
                },
                select: {
                    UserMasterSid: true,
                    userName: true,
                    userEmail: true
                }
            });


            const result = allSalespersons.map(sp => {
                const user = users.find(u => u.UserMasterSid === sp.Salesman);
                return {
                    ...sp,
                    userName: user?.userName || '',
                };
            });

            return result;
        } catch (error) {
            console.error("Error in getAllSalesperson:", error);
            throw error;
        }
    }

    async getCustomerBranchEmail(CustomerBranchSid) {
        try {
            const cusBranchEmail = await this._db.customerBranch.findFirst({
                where: {
                    CustomerBranchSid: CustomerBranchSid
                },
                select: {
                    Email: true
                }
            })
            return cusBranchEmail;
        } catch (error) {
            throw error;
        }
    }

    async getTariffByQuoteDetails(payload) {
        try {
            const allTariffDetails = await this._db.tariffDetail.findMany({
                where: {
                    EffectiveDate: { lte: new Date(payload.EffectiveDate) },
                    ExpiredOn: { gte: new Date(payload.ExpiredDate) },
                    CargoType: payload.CargoType,
                    tariffHeader: {
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        POOSid: payload.PORSid,
                        POLSid: payload.POLSid,
                        PODSid: payload.PODSid,
                        FDCSid: payload.FPODSid
                    }
                },
                include: {
                    currencyMasterBuy: { select: { currencyName: true, currencyCode: true } },
                    currencyMasterSale: { select: { currencyName: true } },
                    UOMMaster: { select: { UOMName: true, UOMCode: true } }
                }
            })
            return allTariffDetails;
        } catch (error) {
            throw error;
        }
    }

    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            const whereClause: any = { tableName };
            if (recordId) whereClause.recordId = recordId;

            const logs = await this._db.auditLog.findMany({
                where: whereClause,
                orderBy: { changedAt: 'desc' },
            });

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    async deleteQuoteProduct(QuoteProductSid:number){
        try {
            return await this._db.quoteProduct.delete({
                where: {
                    QuoteProductSid: QuoteProductSid
                }
            })
        } catch (error) {
            throw new Error(`Error deleting quote product: ${error.message}`);
        }
    }

}