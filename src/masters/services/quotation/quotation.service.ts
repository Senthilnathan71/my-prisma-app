import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, LeadStatus, Prisma } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import * as moment from 'moment-timezone';
import { SearchListDto } from "src/masters/DTO/search-list.dto";
import { filterDto } from "src/masters/DTO/search-vessel.dto";
import { GlobalConfigService } from "src/common/config/master-config.service";
import { contains } from "class-validator";
import { statusWhereClause, toCamelCase, toNumber } from "src/common/helper";
import { NumberSeriesService } from "src/settings/services/number-series/number-series.service";

interface authLogDTO {
    CompanyMasterSid : number,
    BranchMasterSid : number,
    Status : string,
    LevelOfAuthorization : string,
    AuthorizerId : number,
    AuthorizedStatus : ApprovalStatus,
    DocumentSid : number,
    Remarks : string,
    CreatedBy : string,
    AuthorityDetailSid : number,
    AuthorisedDate : Date,
}
@Injectable()
export class QuotationService {
    constructor(
        private _db: DatabaseService, private logger: Logger,
        private globalConfigService: GlobalConfigService,
        private numberSeriesService: NumberSeriesService
    ) { }

    async createQuotation(payload) {
        try {
            const DepartmentMasterSid = Number(payload.DepartmentMasterSid);
            
            // Get MenuMasterSid for Enquiry (look up by code or use provided value)
            let MenuMasterSid = Number(payload.MenuMasterSid);
            if (!MenuMasterSid) {
                const enquiryMenu = await this._db.menuMaster.findFirst({
                    where: {
                        OR: [
                            { MenuCode: 'QUA' },
                            { MenuCode: 'QT' },
                            { MenuName: { contains: 'Quotation', mode: 'insensitive' } }
                        ],
                        status: 'A'
                    }
                });

                if(!enquiryMenu){
                    throw new BadRequestException('No Quotation menu found');
                }

                MenuMasterSid = enquiryMenu?.MenuMasterSid;
            }

            // Generate enquiry number using NumberSeriesService
            let quotationNumber: string | null = null;
            if (MenuMasterSid) {
                quotationNumber = await this.numberSeriesService.generateNextNumber(
                    payload.CompanyMasterSid,
                    payload.BranchMasterSid,
                    MenuMasterSid,
                    DepartmentMasterSid,
                    payload.QuoteDate ? new Date(payload.QuoteDate) : undefined,
                );
            }

            // Step 1: Create Quote Header
            const quoteDate = payload.QuoteDate ? new Date(payload.QuoteDate) : new Date();
            const quoteHeaderPayload: any = {
                CustomerName: payload.CustomerName,
                CustomerMasterSid: Number(payload.CustomerMasterSid) || null,
                CustomerBranchSid: payload.CustomerBranchSid,
                QuoteDate: quoteDate,
                EnquirySid: payload.EnquirySid ? Number(payload.EnquirySid) : null,
                CustomerAddress: payload.CustomerAddress,
                Email: payload.Email,
                ContactPerson: payload.ContactPerson,
                ContactNumber: payload.ContactNumber,
                CustomerRef: payload.CustomerRef,
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
                AgreedRate: payload.AgreedRate,
                RateLock: payload.RateLock,
                IsContract: payload.IsContract,
                MenuMasterSid: Number(payload.MenuMasterSid),
                QuoteNumber: quotationNumber,
                createdBy: payload.createdBy,
                InternalApprovedBy: payload.InternalApprovedBy || null,
                InternalApprovedOn: payload.InternalApprovedBy ? new Date() : null,
                CustomerApprovedBy: payload.CustomerApprovedBy || null,
                CustomerApprovedOn: payload.CustomerApprovedBy ? new Date() : null,

            };

            const quoteHeader = await this._db.quoteHeader.create({ data: quoteHeaderPayload });

            // Step 2: Create Quote Routes
            const quoteRoutes = await Promise.all(
                payload.quoteRoutes.map(async (route, index) => {
                    const createdQuoteRoute = await this._db.quoteRoute.create({
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
                            FreightPPCC : route.FreightPPCC,
                            ServiceLevel: route.ServiceLevel,

                            // Need to be removed later
                            // CarrierName : "hello",
                        },
                    }).catch(error => {
                        console.log(error);
                    });

                    if (!createdQuoteRoute) return;

                    const allCarriers = route.quoteCarriers || [];
                    let finalCarriers: any[] = [];
                    await Promise.all(
                        allCarriers.map(async (carrier) => {
                            const createdQuoteCarrier = await this._db.quoteCarrier.create({
                                data: {
                                    QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                                    QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                    CarrierMasterSid: carrier.CarrierMasterSid,
                                    CarrierName: carrier.CarrierName,
                                    TransitTime: carrier.TransitTime,
                                    CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                    BranchMasterSid: quoteHeader.BranchMasterSid,
                                    ApprovalStatus: ApprovalStatus.Open,
                                    createdBy: payload.createdBy,
                                },
                            });


                            const allCharges = carrier.quoteCharges || [];
                            let finalCharges: any[] = [];
                            await Promise.all(
                                allCharges.map(async (charge) => {
                                    const createdCharge = await this._db.quoteCharge.create({
                                        data: {
                                            QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                                            QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                                            QuoteCarrierSid: createdQuoteCarrier.QuoteCarrierSid,
                                            CompanyMasterSid: quoteHeader.CompanyMasterSid,
                                            BranchMasterSid: quoteHeader.BranchMasterSid,
                                            createdBy: payload.createdBy,
                                            status: "A",
                                            ChargeUomSid: charge.ChargeUomSid,
                                            ChargeDisplayName: charge.ChargeDisplayName,
                                            Qty: Number(charge.Qty) || 0,
                                            CostChargeUomSid: charge.CostChargeUomSid,
                                            CostPrepaidCollect: charge.CostPrepaidCollect || "Prepaid",
                                            CostCurrencyMasterSid: charge.CostCurrencyMasterSid,
                                            CostExchangeRate: Number(charge.CostExchangeRate) || 0,
                                            CostRate: Number(charge.CostRate) || 0,
                                            CostNumberOfUnit: Number(charge.Qty) || 0,
                                            CostDrCr: charge.CostDrCr || "D",
                                            CostAmount: Number(charge.CostAmount) || 0,
                                            CostLocalAmount: Number(charge.CostLocalAmount) || 0,
                                            CostAgentMasterSid: charge.CostAgentMasterSid,
                                            CostAgentBranchSid: charge.CostAgentBranchSid,
                                            RevenueChargeUomSid: charge.RevenueChargeUomSid,
                                            RevenuePrepaidCollect: charge.RevenuePrepaidCollect || "Prepaid",
                                            RevenueCurrencyMasterSid: charge.RevenueCurrencyMasterSid,
                                            RevenueExchangeRate: Number(charge.RevenueExchangeRate) || 0,
                                            RevenueRate: Number(charge.RevenueRate) || 0,
                                            RevenueNumberOfUnit: Number(charge.Qty) || 0,
                                            RevenueDrCr: charge.RevenueDrCr || "C",
                                            RevenueAmount: Number(charge.RevenueAmount) || 0,
                                            RevenueLocalAmount: Number(charge.RevenueLocalAmount) || 0,
                                            RevenueCustomerMasterSid: charge.RevenueCustomerMasterSid,
                                            RevenueCustomerBranchSid: charge.RevenueCustomerBranchSid,
                                            Remarks: charge.Remarks,
                                            TariffDetailSid: charge.TariffDetailSid
                                        }
                                    })
                                    finalCharges.push(createdCharge)
                                })
                            )
                            createdQuoteCarrier['quoteCharges'] = finalCharges;
                            finalCarriers.push(createdQuoteCarrier)
                        })
                    );

                    const quoteCargo = await this._db.quoteCargo.create({
                        data: {
                            CompanyMasterSid: quoteHeader.CompanyMasterSid,
                            BranchMasterSid: quoteHeader.BranchMasterSid,
                            QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                            QuoteRouteSid: createdQuoteRoute.QuoteRouteSid,
                            CreatedBy: payload.createdBy,
                            Status: "A",
                            CargoType: route.CargoType || '',
                            WeightUnitSid: route.WeightUnitSid,
                            GrossWeight: Number(route.GrossWeight) || 0,
                            NetWeight: Number(route.NetWeight) || 0,
                            Volume: Number(route.Volume) || 0,
                            ChargeableWeight: Number(route.ChargeableWeight) || 0,
                            ContainerType: route.ContainerType || '',
                            Qty: Number(route.Qty) || 0,
                            ShipmentTerms: route.ShipmentTerms || '',
                            PackageType: route.PackageType || '',
                            PackageQty: Number(route.PackageQty) || 0,
                            CargoDescription: route.CargoDescription || '',
                        }
                    })

                    const products = await this._db.quoteProduct.createMany({
                        data: route.quoteProducts.map((product, index) => ({
                            Sno: index + 1,
                            ProductSid: product.ProductSid,
                            ProductName: product.ProductName || '',
                            PackageType: product.PackageType || '',
                            CargoDescription: product.CargoDescription || '',
                            ProductUnit: product.ProductUnit || 0,
                            CompanyMasterSid: quoteHeader.CompanyMasterSid,
                            BranchMasterSid: quoteHeader.BranchMasterSid,
                            QuoteHeaderSid: quoteHeader.QuoteHeaderSid,
                            QuoteCargoSid: quoteCargo.QuoteCargoSid,
                            CreatedBy: payload.createdBy,
                            Status: "A",
                            ExternalPkg: product.ExternalPkg || null,
                            ExternalQty: Number(product.ExternalQty) || 0,
                            GrossWeight: Number(product.GrossWeight) || 0,
                            NetWeight: Number(product.NetWeight) || 0,
                            Volume: Number(product.Volume) || 0,
                            Length: Number(product.Length) || 0,
                            Width: Number(product.Width) || 0,
                            Height: Number(product.Height) || 0,
                            ChargeableWeight: Number(product.ChargeableWeight) || 0,
                            IsHaz: product.IsHaz ? "Y" : "N",
                            ImcoClass: product.ImcoClass || null,
                            PkgGroup: Number(product.PkgGroup) || null,
                            Remarks: product.Remarks,
                            Volumetric: Number(product.Volumetric ?? product.volumetric) || 0 
                        }))
                    });

                    if (quoteHeader && payload.LeadOrCustomer === "L") {
                        await this._db.preCustomerMaster.update({
                            where: {
                                PreCustomerMasterSid: payload.PreCustomerMasterSid
                            }, data: {
                                leadStatus: LeadStatus.QuotationCreated
                            }
                        })
                    }

                    if (payload.EnquirySid) {
                        await this._db.enquiryHeader.update({
                            where: {
                                EnquiryHeaderSid: payload.EnquirySid
                            }, data: {
                                QuoteHeaderSid: quoteHeader.QuoteHeaderSid
                            }
                        })
                    }


                    return {
                        createdQuoteRoute,
                        finalCarriers,
                        quoteCargo,
                        products
                    };
                })
            )

            return {
                message: 'Quote created successfully',
                data: {
                    quoteHeader,
                    quoteRoutes
                }
            };
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
                    RateLock: true,
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
                    quoteRoute : {
                        where : { status : statusWhereClause},
                        orderBy: { createdOn: 'desc' },
                        include : {
                            bookingHeader: {
                                select: {
                                    BookingHeaderSid: true,
                                    BookingNo: true,
                                },
                            },
                            // route - carrier - charge
                            quoteCarrier : { where : 
                                { status : statusWhereClause},
                                 orderBy: { createdOn: 'desc' },
                                include : {
                                    quoteCharge : { where : 
                                        { status : statusWhereClause},
                                         orderBy: { createdOn: 'desc' },
                                    }
                                }
                            },

                            // route - cargo - product
                            quoteCargo : { where : 
                                { Status : statusWhereClause},
                                 orderBy: { CreatedOn: 'desc' },
                                include : {
                                    quoteProduct : { where : 
                                        { Status : statusWhereClause},
                                         orderBy: { CreatedOn: 'desc' },
                                    }
                                }
                            },
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
            // Approval Based Payload
            const authPayload = payload.authDetails;

            const updatedQuoteHeader = await this._db.quoteHeader.update({
                where: { QuoteHeaderSid: QuoteHeaderSid },
                data: {
                    QuoteDate: payload.QuoteDate ? new Date(payload.QuoteDate) : new Date(),
                    CustomerRef: payload.CustomerRef,
                    Email: payload.Email,
                    ContactPerson:payload.ContactPerson,
                    ContactNumber:payload.ContactNumber,
                    status: String(payload.status).charAt(0) || "A",
                    SalesmanSid: payload.SalesmanSid,
                    CustomerName: payload.CustomerName,
                    EnquirySid: payload.EnquirySid ? Number(payload.EnquirySid) : null,
                    FreightPPCC: payload.FreightPPCC,
                    CustomerAddress: payload.CustomerAddress,
                    RateLock: payload.RateLock,
                    IsContract: payload.IsContract,
                    CustomerBranchSid: payload.CustomerBranchSid,
                    MenuMasterSid: Number(payload.MenuMasterSid),
                    ClearanceBy: payload.ClearanceBy,
                    TransportBy: payload.TransportBy,
                    Remarks: payload.Remarks,
                    updatedBy: payload.updatedBy,
                    InternalApprovedBy : authPayload.InternalApprovedBy || null,
                    updatedOn: new Date(),

                }
            });


            // Step 2: Route
            let finalRoutes : any[] = [];
            const routes = payload.quoteRoutes || [];
            for (const route of routes) {
                let currentRoute;

                if (route.QuoteRouteSid) {
                    currentRoute = await this._db.quoteRoute.update({
                        where: { QuoteRouteSid: route.QuoteRouteSid },
                        data: {
                            DepartmentMasterSid: Number(route.DepartmentMasterSid),
                            POLFreeDays: Number(route.POLFreeDays),
                            PODFreeDays: Number(route.PODFreeDays),
                            PORSid: Number(route.PORSid),
                            POLSid: Number(route.POLSid),
                            PODSid: Number(route.PODSid),
                            FDPSid: Number(route.FPODSid),
                            Remarks: route.Remarks || '',
                            CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                            BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                            effDate: new Date(route.effDate),
                            expdate: new Date(route.expDate),
                            updatedBy: payload.updatedBy,
                            TransitDays: Number(route.TransitDays) || Number(route.transit) || null,
                            segmentType: route.segmentType,
                            ServiceLevel: route.ServiceLevel,
                            FreightPPCC : route.FreightPPCC,
                        }
                    });
                } else {
                    currentRoute = await this._db.quoteRoute.create({
                        data: {
                                QuoteHeaderSid: updatedQuoteHeader.QuoteHeaderSid,
                                DepartmentMasterSid: Number(route.DepartmentMasterSid),
                                POLFreeDays: Number(route.POLFreeDays),
                                PODFreeDays: Number(route.PODFreeDays),
                                PORSid: Number(route.PORSid),
                                POLSid: Number(route.POLSid),
                                PODSid: Number(route.PODSid),
                                FDPSid: Number(route.FPODSid),
                                Remarks: route.Remarks || '',
                                CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                                BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                                effDate: new Date(route.effDate),
                                expdate: new Date(route.expDate),
                                createdBy: payload.updatedBy,
                                TransitDays: Number(route.TransitDays) || Number(route.transit) || null,
                                segmentType: route.segmentType,
                                ServiceLevel: route.ServiceLevel,
                            },
                    });
                }
                

                //  Route - Carrier
                let finalCarriers : any[] = [];
                const allCarriers = route.quoteCarriers || [];
                for (const carrier of allCarriers) {
                    let currentCarrier;
                    if(carrier.QuoteCarrierSid) {
                        currentCarrier = await this._db.quoteCarrier.update({
                            where: { QuoteCarrierSid: carrier.QuoteCarrierSid },
                            data: {
                                CarrierMasterSid: carrier.CarrierMasterSid || null,
                                CarrierName: carrier.CarrierName,
                                TransitTime: carrier.TransitTime,
                                CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                                BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                                ApprovalStatus: carrier.authorizerStatus || ApprovalStatus.Pending,
                                ApprovedBy : carrier.ApprovedBy,
                                Remarks : carrier.authorizerRemarks,
                                updatedBy: payload.updatedBy,
                            },
                        });
                        
                    } else {
                        currentCarrier = await this._db.quoteCarrier.create({
                            data: {
                                QuoteRouteSid: currentRoute.QuoteRouteSid,
                                QuoteHeaderSid: updatedQuoteHeader.QuoteHeaderSid,
                                CarrierMasterSid: carrier.CarrierMasterSid,
                                CarrierName: carrier.CarrierName,
                                TransitTime: carrier.TransitTime,
                                CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                                BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                                ApprovalStatus: ApprovalStatus.Pending,
                                Remarks : carrier.authorizerRemarks,
                                createdBy: payload.updatedBy,
                            },
                        });
                    }

                    // Route - Carrier - Charge
                    let finalCharges : any[] = []; 
                    const allCharges = carrier.quoteCharges || [];
                    finalCharges = await Promise.all(
                        allCharges.map(async (chrg) => {
                            const chPayload = {
                                ...chrg,
                                QuoteRouteSid: currentRoute.QuoteRouteSid,
                                QuoteHeaderSid: updatedQuoteHeader.QuoteHeaderSid,
                                QuoteCarrierSid: currentCarrier.QuoteCarrierSid,
                                CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                                BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                                createdBy: payload.updatedBy,
                                updatedBy: payload.updatedBy,
                            }
                            return await this.upsertCharge(chPayload)
                        })
                    );
                    currentCarrier.quoteCharges = finalCharges;
                    finalCarriers.push(currentCarrier);
                }
                currentRoute.quoteCarriers = finalCarriers;

                let ourCargo;
                if(route.QuoteCargoSid) {
                    ourCargo = await this._db.quoteCargo.update({
                        where: { QuoteCargoSid: route.QuoteCargoSid },
                        data: {
                            CargoType: route.CargoType ||"",
                            WeightUnitSid: route.WeightUnitSid,
                            GrossWeight: Number(route.GrossWeight) || 0,
                            NetWeight: Number(route.NetWeight) || 0,
                            Volume: Number(route.Volume) || 0,
                            ChargeableWeight: Number(route.ChargeableWeight) || 0,
                            ContainerType: route.ContainerType || "",
                            Qty: Number(route.Qty) || 0,
                            ShipmentTerms: route.ShipmentTerms || "",
                            PackageType: route.PackageType || "",
                            PackageQty: Number(route.PackageQty) || 0,
                            CargoDescription: route.CargoDescription || "",
                            UpdatedBy: payload.updatedBy,
                        }
                    })
                } else {
                    ourCargo = await this._db.quoteCargo.create({
                        data: {
                            CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                            BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                            QuoteHeaderSid: updatedQuoteHeader.QuoteHeaderSid,
                            QuoteRouteSid: currentRoute.QuoteRouteSid,
                            CreatedBy: payload.updatedBy,
                            Status: "A",
                            CargoType: route.CargoType ||"",
                            WeightUnitSid: route.WeightUnitSid,
                            GrossWeight: Number(route.GrossWeight) || 0,
                            NetWeight: Number(route.NetWeight) || 0,
                            Volume: Number(route.Volume) || 0,
                            ChargeableWeight: Number(route.ChargeableWeight) || 0,
                            ContainerType: route.ContainerType || "",
                            Qty: Number(route.Qty) || 0,
                            ShipmentTerms: route.ShipmentTerms || "",
                            PackageType: route.PackageType || "",
                            PackageQty: Number(route.PackageQty) || 0,
                            CargoDescription: route.CargoDescription || "",
                        }
                    })
                }
                finalRoutes.push(currentRoute);

                // Route - Cargo - Product
                const allProducts = route.quoteProducts || [];
                let x = 0;
                await Promise.all(
                    allProducts.map(async (product) => {
                        const productPayload = {
                            ...product,
                            Sno : ++x,
                            CompanyMasterSid: updatedQuoteHeader.CompanyMasterSid,
                            BranchMasterSid: updatedQuoteHeader.BranchMasterSid,
                            QuoteHeaderSid: updatedQuoteHeader.QuoteHeaderSid,
                            QuoteCargoSid: ourCargo.QuoteCargoSid,
                            createdBy : payload.updatedBy,
                            updatedBy : payload.updatedBy,
                        }
                        return await this.upsertProduct(productPayload);
                    })
                );
            }

            let createdAuthLog;
            
            if(authPayload.canAuthorize){

               createdAuthLog = await this._db.authorityLog.create({
                    data: {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        CreatedBy: payload.updatedBy,
                        Status: 'A',
                        AuthorityDetailSid: authPayload.AuthorityDetailSid,
                        AuthorisedDate: new Date(),
                        ApprovalStatus: authPayload.ApprovalStatus,
                        DocumentSid: updatedQuoteHeader.QuoteHeaderSid,
                        Remarks: payload.AuthorizerRemarks || '',
                    },
                });
            }

            const atleastOneApprovedCarrier = finalRoutes.some(route => {
                return route.quoteCarriers.some(carrier => {
                    return carrier.ApprovalStatus === "Approved"
                })
            })


            // if approved
            let createdCustomer;
            if(updatedQuoteHeader && updatedQuoteHeader.LeadOrCustomer === "L" && updatedQuoteHeader.PreCustomerMasterSid && atleastOneApprovedCarrier){
                let ourLead = await this._db.preCustomerMaster.findUnique({
                    where : {
                        PreCustomerMasterSid: updatedQuoteHeader.PreCustomerMasterSid
                    },
                    include : {
                        customerMaster : true
                    }
                });

                if(!ourLead){
                    console.error("Lead not found");
                }

                const ourLeadCustomer =  ourLead?.customerMaster?.length
                console.log(ourLeadCustomer,'ourLeadCustomer')

                if(ourLeadCustomer){
                    throw new BadRequestException("Customer has been already created for this lead");
                }

                const customerTypes: Record<string, string> = {};
                if(ourLead?.preCustomerType){
                    const customerTypeKey = toCamelCase(ourLead?.preCustomerType);
                    if (customerTypeKey) {
                        customerTypes[customerTypeKey] = 'isTrue';
                        customerTypes.customer = 'isTrue';
                    }
                }

                createdCustomer = await this._db.customerMaster.create({
                    data : {
                        CompanyMasterSid : updatedQuoteHeader.CompanyMasterSid,
                        PreCustomerMasterSid : updatedQuoteHeader.PreCustomerMasterSid,
                        CustomerName : updatedQuoteHeader.CustomerName,
                        CountryMasterSid : ourLead?.CountryMasterSid,
                        CustomerType : customerTypes || {},
                        CustomerAddress1 : updatedQuoteHeader.CustomerAddress,
                        createdBy : payload.updatedBy,
                    }
                })

                let updateData = {
                    LeadOrCustomer: "C",
                    CustomerMasterSid: createdCustomer.CustomerMasterSid
                }
                let updatedHeader = await this._db.quoteHeader.update({
                    where: {
                        QuoteHeaderSid: QuoteHeaderSid
                    }, data: updateData
                })

                if(updatedQuoteHeader.EnquirySid){
                    await this._db.enquiryHeader.update({
                        where : { EnquiryHeaderSid : updatedQuoteHeader.EnquirySid },data : updateData
                    })
                }

                const updatedLead = await this._db.preCustomerMaster.update({
                    where: {
                        PreCustomerMasterSid: updatedQuoteHeader.PreCustomerMasterSid!
                    }, data: {
                        leadStatus: LeadStatus.QuotationConfirmed
                    }
                })
            }



            return {
                ...updatedQuoteHeader,
                createdAuthLog,
                createdCustomer
            }
        } catch (error) {
            throw error;
        }
    }

    async moveOpenApprovalToWaitingForApproval(QuoteHeaderSid: number, updatedBy?: string) {
        try {
            return await this._db.quoteCarrier.updateMany({
                where: {
                    QuoteHeaderSid,
                    ApprovalStatus: ApprovalStatus.Open,
                },
                data: {
                    ApprovalStatus: ApprovalStatus.Pending,
                    ...(updatedBy ? { updatedBy } : {}),
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async handleQuotationAuthLog(payload : authLogDTO) {
        try {
            const authLog = await this._db.authorityLog.create({
                data : payload
            });
            return authLog;
        } catch (error) {
            throw error;
        }
    }

    async upsertCharge(payload:any) {
        try {
            if(payload.QuoteChargeSid) {
                return await this._db.quoteCharge.update({
                    where: { QuoteChargeSid: payload.QuoteChargeSid },
                    data: {
                        updatedBy: payload.updatedBy,
                        ChargeUomSid: payload.ChargeUomSid,
                        ChargeDisplayName: payload.ChargeDisplayName,
                        CostChargeUomSid: payload.CostChargeUomSid,
                        CostPrepaidCollect: payload.CostPrepaidCollect || "Prepaid",
                        CostCurrencyMasterSid: payload.CostCurrencyMasterSid,
                        CostExchangeRate: Number(payload.CostExchangeRate) || 0,
                        CostRate: Number(payload.CostRate) || 0,
                        CostNumberOfUnit: Number(payload.CostNumberOfUnit) || 0,
                        CostDrCr: payload.CostDrCr || "D",
                        CostAmount: Number(payload.CostAmount) || 0,
                        CostLocalAmount: Number(payload.CostLocalAmount) || 0,
                        CostAgentMasterSid: payload.CostAgentMasterSid,
                        CostAgentBranchSid: payload.CostAgentBranchSid,
                        RevenueChargeUomSid: payload.RevenueChargeUomSid,
                        RevenuePrepaidCollect: payload.RevenuePrepaidCollect || "Prepaid",
                        RevenueCurrencyMasterSid: payload.RevenueCurrencyMasterSid,
                        RevenueExchangeRate: Number(payload.RevenueExchangeRate) || 0,
                        RevenueRate: Number(payload.RevenueRate) || 0,
                        RevenueNumberOfUnit: Number(payload.RevenueNumberOfUnit) || 0,
                        RevenueDrCr: payload.RevenueDrCr || "C",
                        RevenueAmount: Number(payload.RevenueAmount) || 0,
                        RevenueLocalAmount: Number(payload.RevenueLocalAmount) || 0,
                        RevenueCustomerMasterSid: payload.RevenueCustomerMasterSid,
                        RevenueCustomerBranchSid: payload.RevenueCustomerBranchSid,
                        Qty : Number(payload.Qty) || 0,
                        Remarks: payload.Remarks,
                    }
                });
            } else {
                return await this._db.quoteCharge.create({
                    data: {
                        QuoteRouteSid: payload.QuoteRouteSid,
                        QuoteHeaderSid: payload.QuoteHeaderSid,
                        QuoteCarrierSid: payload.QuoteCarrierSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        createdBy: payload.createdBy,
                        status: "A",
                        ChargeUomSid: payload.ChargeUomSid,
                        ChargeDisplayName: payload.ChargeDisplayName,
                        CostChargeUomSid: payload.CostChargeUomSid,
                        CostPrepaidCollect: payload.CostPrepaidCollect || "Prepaid",
                        CostCurrencyMasterSid: payload.CostCurrencyMasterSid,
                        CostExchangeRate: Number(payload.CostExchangeRate) || 0,
                        CostRate: Number(payload.CostRate) || 0,
                        CostNumberOfUnit: Number(payload.CostNumberOfUnit) || 0,
                        CostDrCr: payload.CostDrCr || "D",
                        CostAmount: Number(payload.CostAmount) || 0,
                        CostLocalAmount: Number(payload.CostLocalAmount) || 0,
                        CostAgentMasterSid: payload.CostAgentMasterSid,
                        CostAgentBranchSid: payload.CostAgentBranchSid,
                        RevenueChargeUomSid: payload.RevenueChargeUomSid,
                        RevenuePrepaidCollect: payload.RevenuePrepaidCollect || "Prepaid",
                        RevenueCurrencyMasterSid: payload.RevenueCurrencyMasterSid,
                        RevenueExchangeRate: Number(payload.RevenueExchangeRate) || 0,
                        RevenueRate: Number(payload.RevenueRate) || 0,
                        RevenueNumberOfUnit: Number(payload.RevenueNumberOfUnit) || 0,
                        RevenueDrCr: payload.RevenueDrCr || "C",
                        RevenueAmount: Number(payload.RevenueAmount) || 0,
                        RevenueLocalAmount: Number(payload.RevenueLocalAmount) || 0,
                        RevenueCustomerMasterSid: payload.RevenueCustomerMasterSid,
                        RevenueCustomerBranchSid: payload.RevenueCustomerBranchSid,
                        TariffDetailSid : payload.TariffDetailSid,
                        Qty : Number(payload.Qty) || 0,
                        Remarks: payload.Remarks,
                    }
                });
            }
        } catch (error) {
            throw new Error(`Error updating enquiry: ${error.message}`);
        }
    }

    async upsertProduct(payload:any) {
        try {
            if(payload.QuoteProductSid) {
                return await this._db.quoteProduct.update({
                    where: { QuoteProductSid: payload.QuoteProductSid },
                    data: {
                        Sno: payload.Sno,
                        ProductSid: payload.ProductSid,
                        ProductName: payload.ProductName || "",
                        PackageType: payload.PackageType || "",
                        CargoDescription: payload.CargoDescription || "",
                        ProductUnit: payload.ProductUnit || 0,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        QuoteHeaderSid: payload.QuoteHeaderSid,
                        QuoteCargoSid: payload.QuoteCargoSid,
                        UpdatedBy: payload.updatedBy,
                        ExternalPkg: payload.ExternalPkg || null,
                        ExternalQty: Number(payload.ExternalQty) || 0,
                        GrossWeight: Number(payload.GrossWeight) || 0,
                        NetWeight: Number(payload.NetWeight) || 0,
                        Volume : Number(payload.Volume) || 0,
                        Length: Number(payload.Length) || 0,
                        Width: Number(payload.Width) || 0,
                        Height: Number(payload.Height) || 0,
                        ChargeableWeight: Number(payload.ChargeableWeight) || 0,
                        IsHaz: payload.IsHaz ? "Y" : "N",
                        ImcoClass: payload.ImcoClass,
                        PkgGroup: Number(payload.PkgGroup) || null,
                        Remarks: payload.Remarks,
                        Volumetric: Number(payload.Volumetric ?? payload.volumetric) || 0, 
                    }
                });
            } else {
                return await this._db.quoteProduct.create({
                    data: {
                        Sno: payload.Sno,
                        ProductSid: payload.ProductSid,
                        ProductName: payload.ProductName || "",
                        PackageType: payload.PackageType || "",
                        CargoDescription: payload.CargoDescription || "",
                        ProductUnit: payload.ProductUnit || 0,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        QuoteHeaderSid: payload.QuoteHeaderSid,
                        QuoteCargoSid: payload.QuoteCargoSid,
                        CreatedBy: payload.updatedBy,
                        Status: "A",
                        ExternalPkg: payload.ExternalPkg || null,
                        ExternalQty: Number(payload.ExternalQty) || 0,
                        GrossWeight: Number(payload.GrossWeight) || 0,
                        NetWeight: Number(payload.NetWeight) || 0,
                        Volume : Number(payload.Volume) || 0,
                        Length: Number(payload.Length) || 0,
                        Width: Number(payload.Width) || 0,
                        Height: Number(payload.Height) || 0,
                        ChargeableWeight: Number(payload.ChargeableWeight) || 0,
                        IsHaz: payload.IsHaz ? "Y" : "N",
                        ImcoClass: payload.ImcoClass || null,
                        PkgGroup: Number(payload.PkgGroup) || null,
                        Remarks: payload.Remarks,
                        Volumetric: Number(payload.Volumetric ?? payload.volumetric) || 0, 
                    }
                });
            }
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

        const deletedCarriers = await this._db.quoteCarrier.updateManyAndReturn({
            where: { QuoteRouteSid: id },
            data: { status: 'D' }
        });
        const allDeletedCarrierIds = deletedCarriers.map(carrier => carrier.QuoteCarrierSid);
        const deletedCharges = await this._db.quoteCharge.updateMany({
            where: { QuoteRouteSid: { in: allDeletedCarrierIds } },
            data: { status: 'D' }
        });

        const deletedCargos = await this._db.quoteCargo.updateManyAndReturn({
            where: { QuoteRouteSid: id },
            data: { Status: 'D' }
        });
        const allDeletedCargoIds = deletedCargos.map(cargo => cargo.QuoteCargoSid);
        await this._db.quoteProduct.updateMany({
            where: { QuoteProductSid: { in: allDeletedCargoIds } },
            data: { Status: 'D' }
        });


        return await this._db.quoteRoute.update({
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


    async getEnquiryForQuoteCreation(payload: {
        CompanyMasterSid: number,
        BranchMasterSid: number,
        EnquiryHeaderSid: number
    }) {
        try {

            /* ================= FETCH ENQUIRY ================= */
            const enquiry = await this._db.enquiryHeader.findFirst({
                where: {
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    EnquiryHeaderSid: payload.EnquiryHeaderSid,
                    status: 'A'
                },
                include: {
                    departmentMaster: {
                        select: {
                            departmentType: true,
                            FCLLCL: true
                        }
                    },
                    enquiryRoute: {
                        where: { status: 'A' },
                        include: {
                            enquiryCargo: {
                                where: { status: 'A' }
                            }
                        }
                    },
                    enquiryOther: true
                }
            });

            if (!enquiry) {
                throw new BadRequestException('Enquiry not found');
            }

            /* ================= SHIPMENT TYPE ================= */
            let selectedFCLLCL: 'FCL' | 'LCL' | 'AIR' | null = null;

            if (enquiry.departmentMaster?.departmentType === 'Air') {
                selectedFCLLCL = 'AIR';
            } else if (enquiry.departmentMaster?.departmentType === 'Sea') {
                selectedFCLLCL = enquiry.departmentMaster?.FCLLCL === 'LCL' ? 'LCL' : 'FCL';
            }

            /* ================= OPTIMIZATION (CACHE LOOKUPS) ================= */

            // Collect unique container + package names
            const containerNames = new Set<string>();
            const packageNames = new Set<string>();

            enquiry.enquiryRoute.forEach(route => {
                route.enquiryCargo?.forEach(cargo => {
                    if (cargo.ContainerType) containerNames.add(cargo.ContainerType);
                    if (cargo.PackageType) packageNames.add(cargo.PackageType);
                });
            });

            // Fetch all at once
            const [containerTypes, uomTypes] = await Promise.all([
                this._db.containerTypeMaster.findMany({
                    where: {
                        ContainerName: { in: Array.from(containerNames) },
                        status: 'A'
                    },
                    select: {
                        ContainerName: true,
                        ContainerCode: true
                    }
                }),
                this._db.uOMMaster.findMany({
                    where: {
                        UOMCode: { in: Array.from(packageNames) }
                    },
                    select: {
                        UOMCode: true,
                        UOMMasterSid: true
                    }
                })
            ]);

            // Convert to map for O(1) lookup
            const containerMap = new Map(
                containerTypes.map(c => [c.ContainerName, c.ContainerCode])
            );

            const packageMap = new Map(
                uomTypes.map(u => [u.UOMCode, u.UOMMasterSid])
            );

            /* ================= BUILD ROUTES ================= */

            const enrichedRoutes = await Promise.all(
                enquiry.enquiryRoute.flatMap(route =>
                    (route.enquiryCargo || []).map(async (cargo) => {

                        return {
                            PORSid: route.PORSid,
                            POLSid: route.POLSid,
                            PODSid: route.PODSid,
                            FPODSid: route.FDPSid,
                            CargoType: cargo.CargoType,
                            GrossWeight: cargo.GrossWeight,
                            NetWeight: cargo.NetWeight,
                            Volume: cargo.Volume,
                            ContainerType: cargo.ContainerType ? containerMap.get(cargo.ContainerType) : null,
                            Qty: cargo.Qty,
                            ContainerQty: cargo.Qty,
                            ChargeableWeight: cargo.ChargeableWeight,
                            PackageQty: cargo.PackageQty,
                            PackageType: cargo.PackageType,
                            PackageTypeId: cargo.PackageType ?  packageMap.get(cargo.PackageType) : null,
                            ServiceLevel: enquiry.IncoTerms,
                            ProductName: cargo.ProductName,
                            length: cargo.length,
                            width: cargo.width,
                            height: cargo.height,
                            Volumetric: cargo.Volumetric
                        };
                    })
                )
            );

            /* ================= FINAL RESPONSE ================= */

            return {
                rateRequest: true,
                EnquirySid: enquiry.EnquiryHeaderSid,
                EnquiryNumber: enquiry.EnquiryNumber,
                CustomerAddress: enquiry.CustomerAddress,
                CustomerName: enquiry.CustomerName,
                Email: enquiry.Email,
                CustomerRef: enquiry.CustomerRef,
                TransportBy: enquiry.TransportBy,
                ClearanceBy: enquiry.ClearanceBy,
                LeadOrCustomer: enquiry.LeadOrCustomer === 'C',
                CustomerMasterSid: enquiry.CustomerMasterSid,
                CustomerBranchSid: enquiry.CustomerBranchSid,
                PreCustomerMasterSid: enquiry.PreCustomerMasterSid,
                DepartmentMasterSid: enquiry.DepartmentMasterSid,
                ContactPerson: enquiry.ContactPerson,
                ContactNumber: enquiry.ContactNumber,
                SalesmanSid: enquiry.UserMasterSid,
                FreightPPCC: enquiry.FreightPPCC,
                status: enquiry.status,
                ShipmentType: selectedFCLLCL,
                quoteRoutes: enrichedRoutes
            };

        } catch (error) {
            throw error;
        }
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
        const dateFromRaw = (params as any).dateFrom ?? (params as any).DateFrom;
        const dateToRaw = (params as any).dateTo ?? (params as any).DateTo;
        const dateFieldRaw = (params as any).dateField ?? (params as any).DateField ?? 'QuoteDate';
        const allowedDateFields = new Set(['QuoteDate']);
        const dateField = allowedDateFields.has(dateFieldRaw) ? dateFieldRaw : 'QuoteDate';
        const customerMasterSid = (params as any).CustomerMasterSid ?? (params as any).customerMasterSid ?? null;
        const departmentMasterSid = (params as any).DepartmentMasterSid ?? (params as any).departmentMasterSid ?? null;
        const pol = (params as any).POL ?? (params as any).pol ?? null;
        const pod = (params as any).POD ?? (params as any).pod ?? null;
        const approvalStatusRaw = (params as any).ApprovalStatus ?? (params as any).approvalStatus ?? null;
        const validApprovalStatuses = new Set(Object.values(ApprovalStatus));
        const selectedApprovalStatus = approvalStatusRaw && validApprovalStatuses.has(String(approvalStatusRaw) as ApprovalStatus)
            ? String(approvalStatusRaw) as ApprovalStatus
            : null;

        const dateRange: Prisma.DateTimeFilter = {};
        if (dateFromRaw) {
            const parsedFrom = new Date(dateFromRaw);
            if (!Number.isNaN(parsedFrom.getTime())) {
                dateRange.gte = parsedFrom;
            }
        }
        if (dateToRaw) {
            const parsedTo = new Date(dateToRaw);
            if (!Number.isNaN(parsedTo.getTime())) {
                dateRange.lte = parsedTo;
            }
        }

        const [searchPorts, polPorts, podPorts] = await Promise.all([
            search
                ? this._db.portMaster.findMany({
                    where: {
                        status: 'A',
                        OR: [
                            { PortCode: { contains: search, mode: 'insensitive' } },
                            { PortName: { contains: search, mode: 'insensitive' } }
                        ]
                    },
                    select: { PortMasterSid: true }
                })
                : Promise.resolve([]),
            pol
                ? this._db.portMaster.findMany({
                    where: { status: 'A', PortCode: String(pol) },
                    select: { PortMasterSid: true }
                })
                : Promise.resolve([]),
            pod
                ? this._db.portMaster.findMany({
                    where: { status: 'A', PortCode: String(pod) },
                    select: { PortMasterSid: true }
                })
                : Promise.resolve([])
        ]);

        const normalizedSearch = search.trim();
        const portWithSearchOnlyIds = searchPorts.map(p => p.PortMasterSid);
        const polPortIds = polPorts.map(p => p.PortMasterSid);
        const podPortIds = podPorts.map(p => p.PortMasterSid);
        const validSearchApprovalStatuses = new Set(Object.values(ApprovalStatus));
        const approvalStatus = validSearchApprovalStatuses.has(normalizedSearch as ApprovalStatus)
            ? (normalizedSearch as ApprovalStatus)
            : null;
        const isDateSearch =
            /^\d{4}-\d{2}-\d{2}$/.test(normalizedSearch) ||
            /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(normalizedSearch) ||
            /^\d{4}[/-]\d{2}[/-]\d{2}$/.test(normalizedSearch);
        const parsedSearchDate = isDateSearch ? new Date(normalizedSearch) : null;
        const isValidSearchDate = parsedSearchDate instanceof Date && !isNaN(parsedSearchDate.getTime());

        const andFilters: Prisma.QuoteHeaderWhereInput[] = [];

        if (customerMasterSid) {
            andFilters.push({ CustomerMasterSid: Number(customerMasterSid) });
        }
        if (departmentMasterSid) {
            andFilters.push({ quoteRoute: { some: { DepartmentMasterSid: Number(departmentMasterSid) } } });
        }
        if (polPortIds.length) {
            andFilters.push({ quoteRoute: { some: { POLSid: { in: polPortIds } } } });
        }
        if (podPortIds.length) {
            andFilters.push({ quoteRoute: { some: { PODSid: { in: podPortIds } } } });
        }
        if (Object.keys(dateRange).length) {
            andFilters.push({ [dateField]: dateRange } as any);
        }
        if (selectedApprovalStatus) {
            andFilters.push({
                quoteRoute: {
                    some: {
                        quoteCarrier: {
                            some: {
                                ApprovalStatus: selectedApprovalStatus
                            }
                        }
                    }
                }
            });
        }

        const searchFilter: Prisma.QuoteHeaderWhereInput = search ? {
            OR: [
                { QuoteNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                ...(isValidSearchDate ? [{ QuoteDate: parsedSearchDate as Date }] : []),
                { CustomerName: { contains: normalizedSearch, mode: 'insensitive' } },
                { quoteRoute: { some: { departmentMaster: { departmentName: { contains: normalizedSearch, mode: 'insensitive' } } } } },
                { quoteRoute: { some: { POLSid: { in: portWithSearchOnlyIds } } } },
                { quoteRoute: { some: { PODSid: { in: portWithSearchOnlyIds } } } },
                { bookingHeader: { BookingNo: { contains: normalizedSearch, mode: 'insensitive' } } },
                { status: { contains: normalizedSearch, mode: 'insensitive' } },
                ...(approvalStatus
                    ? [{ quoteRoute: { some: { quoteCarrier: { some: { ApprovalStatus: approvalStatus } } } } }]
                    : []),
            ]
        } : {};

        const where: Prisma.QuoteHeaderWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(andFilters.length ? { AND: [...andFilters, ...(search ? [searchFilter] : [])] } : (search ? searchFilter : {}))
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.quoteHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { QuoteDate: 'desc' },
                include: {
                    bookingHeader: {
                        select: {
                            BookingHeaderSid: true,
                            BookingNo: true
                        }
                    },
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
                            quoteCarrier: {
                                where: { status: statusWhereClause },
                                include: {
                                    quoteCharge: { where: { status: statusWhereClause } }
                                }
                            },
                            quoteCargo: {
                                where: { Status: statusWhereClause },
                                include: {
                                    uomMaster: { select: { UOMCode: true } },
                                    quoteProduct: { where: { Status: statusWhereClause } }
                                }
                            }
                        }
                    }
                }
            }),
            this._db.quoteHeader.count({ where }),
        ]);
        items = await Promise.all(
            items.map(async (item) => {
                const updatedRoutes = await Promise.all(
                    item.quoteRoute.map(async (route) => {
                        const [departmentMaster, PortPOL, PortPOD] = await Promise.all([
                            route.DepartmentMasterSid !== null
                                ? this.globalConfigService.getMasterData('department_master', route.DepartmentMasterSid)
                                : { departmentName: '' },
                            route.POLSid !== null
                                ? this.globalConfigService.getMasterData('port_master', route.POLSid)
                                : { PortName: '' },
                            route.PODSid !== null
                                ? this.globalConfigService.getMasterData('port_master', route.PODSid)
                                : { PortName: '' },
                        ]);

                        const updatedCarriers = await Promise.all(
                            route.quoteCarrier.map(async (carrier) => {
                                const updatedCharges = await Promise.all(
                                    carrier.quoteCharge.map(async (charge) => {
                                        const [uomMaster, currencyMaster] = await Promise.all([
                                            charge.CostChargeUomSid !== null
                                                ? this.globalConfigService.getMasterData('uom_master', charge.CostChargeUomSid)
                                                : { UOMMasterSid: null, UOMName: '', UOMCode: '' },
                                            charge.CostCurrencyMasterSid !== null
                                                ? this.globalConfigService.getMasterData('currency_master', charge.CostCurrencyMasterSid)
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
                                    ...carrier,
                                    quoteCharge: updatedCharges,
                                };
                            })
                        );

                        return {
                            ...route,
                            departmentMaster,
                            PortPOL,
                            PortPOD,
                            quoteCarrier: updatedCarriers,
                        };
                    })
                );

                return {
                    ...item,
                    quoteRoute: updatedRoutes,
                };
            })
        );

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
                    // UserMasterSid: { in: salesmanIds },
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
            const brEmail = await this._db.customerBrEmail.findFirst({
                where: {
                    CustomerBranchSid: CustomerBranchSid,
                    status: 'A'
                },
                select: {
                    Toemail: true
                }
            });
            if (brEmail?.Toemail) {
                return { Email: brEmail.Toemail };
            }

            throw new BadRequestException('To email is not available. Please configure in Customer Branch Email.');
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

    async deleteQuoteCargo(QuoteCargoSid:number){
        try {

            // Soft Delete its child (Products)
            await this._db.quoteProduct.updateMany({
                where : {
                    QuoteCargoSid: QuoteCargoSid
                },
                data : {
                    Status : 'D'
                }
            })

            // Soft Delete Cargo
            return await this._db.quoteCargo.update({
                where: {
                    QuoteCargoSid: QuoteCargoSid
                },
                data : {
                    Status : 'D'
                }
            })
        } catch (error) {
            throw new Error(`Error deleting quote cargo: ${error.message}`);
        }
    }

    async deleteQuoteProduct(QuoteProductSid:number){
        try {
            // No child table here
            return await this._db.quoteProduct.update({
                where: {
                    QuoteProductSid: QuoteProductSid
                },
                data : {
                    Status : 'D'
                }
            })
        } catch (error) {
            throw new Error(`Error deleting quote product: ${error.message}`);
        }
    }

    async deleteQuoteCarrier(QuoteCarrierSid:number){
        try {
            // Soft Delete its child (Charges)
            await this._db.quoteCharge.updateMany({
                where : {
                    QuoteCarrierSid: QuoteCarrierSid
                },
                data : {
                    status : 'D'
                }
            })
            // Soft Delete Carrier
            return await this._db.quoteCarrier.update({
                where: {
                    QuoteCarrierSid: QuoteCarrierSid
                },
                data : {
                    status : 'D'
                }
            })
        } catch (error) {
            throw new Error(`Error deleting quote carrier: ${error.message}`);
        }
    }

    async getQuoteForBookingCreation(payload: {
        CompanyMasterSid: number,
        BranchMasterSid: number,
        QuoteHeaderSid: number,
        QuoteRouteSid?: number
    }) {
        try {
            const quote = await this._db.quoteHeader.findFirst({
                where: {
                    QuoteHeaderSid: payload.QuoteHeaderSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    status: 'A'
                },
                include: {
                    quoteRoute: {
                        where: { status: 'A' },
                        include: {
                            departmentMaster: {
                                select: { departmentName: true, ExportImport: true }
                            },
                            quoteCarrier: {
                                where: { status: 'A' },
                                include: { quoteCharge: { where: { status: 'A' } } }
                            },
                            quoteCargo: {
                                where: { Status: 'A' },
                                include: { quoteProduct: { where: { Status: 'A' } } }
                            }
                        }
                    },
                    EnquiryHeader: {
                        include: {
                            enquiryOther: {
                                select: {
                                    ShipperName: true,
                                    ShipperAddress: true,
                                    ConsigneeName: true,
                                    ConsigneeAddress: true
                                }
                            }
                        }
                    }
                }
            });

            if (!quote) throw new BadRequestException('Quotation not found');

            const activeRoutes = quote.quoteRoute ?? [];
            if (!activeRoutes.length) throw new BadRequestException('No routes found on this quotation');

            /* ── Multiple routes: ask the user to pick one ── */
            if (activeRoutes.length > 1 && !payload.QuoteRouteSid) {
                const allSids = new Set<number>();
                for (const r of activeRoutes) {
                    [r.PORSid, r.POLSid, r.PODSid, r.FDPSid].forEach(s => s && allSids.add(s));
                }
                const allPorts = allSids.size ? await this._db.portMaster.findMany({
                    where: { PortMasterSid: { in: Array.from(allSids) } },
                    select: { PortMasterSid: true, PortCode: true }
                }) : [];
                const pm = new Map(allPorts.map(p => [p.PortMasterSid, p.PortCode]));

                return {
                    requiresSelection: true,
                    routes: activeRoutes.map(r => ({
                        QuoteRouteSid: r.QuoteRouteSid,
                        POL: pm.get(r.POLSid) || null,
                        POD: pm.get(r.PODSid) || null,
                        departmentName: r.departmentMaster?.departmentName || null,
                        carrier: r.quoteCarrier.find(c => c.ApprovalStatus === ApprovalStatus.Approved)?.CarrierName
                            ?? r.quoteCarrier[0]?.CarrierName
                            ?? null
                    }))
                };
            }

            /* ── Resolve the single or explicitly selected route ── */
            const approvedRoute = payload.QuoteRouteSid
                ? activeRoutes.find(r => r.QuoteRouteSid === payload.QuoteRouteSid)
                : activeRoutes[0];
            if (!approvedRoute) throw new BadRequestException('Selected route not found');
            if (approvedRoute.BookingHeaderSid) throw new BadRequestException('A booking already exists for this quotation');

            const approvedCarrier =
                approvedRoute.quoteCarrier?.find(c => c.ApprovalStatus === ApprovalStatus.Approved)
                ?? approvedRoute.quoteCarrier?.[0]
                ?? null;

            if (!approvedCarrier) throw new BadRequestException('Cannot find Approved Carrier.');

            const cargo = approvedRoute.quoteCargo?.[0] ?? null;

            // Batch-resolve port codes
            const portSids = [approvedRoute.PORSid, approvedRoute.POLSid, approvedRoute.PODSid, approvedRoute.FDPSid].filter(Boolean) as number[];
            const [ports, containerType] = await Promise.all([
                portSids.length ? this._db.portMaster.findMany({
                    where: { PortMasterSid: { in: portSids } },
                    select: { PortMasterSid: true, PortCode: true }
                }) : [],
                cargo?.ContainerType ? this._db.containerTypeMaster.findFirst({
                    where: { ContainerCode: cargo.ContainerType, status: 'A' },
                    select: { ContainerTypeMasterSid: true }
                }) : null
            ]);

            const portMap = new Map((ports as any[]).map(p => [p.PortMasterSid, p.PortCode]));
            const containerTypeId = (containerType as any)?.ContainerTypeMasterSid ?? null;

            // Derive JobType from department
            let jobType = '';
            const dept = approvedRoute.departmentMaster;
            if (dept) {
                const deptName = dept.departmentName?.toLowerCase() || '';
                if (deptName.includes('fcl') || deptName.includes('lcl') || deptName.includes('air')) {
                    if (dept.ExportImport === 'Export') jobType = 'Export';
                    else if (dept.ExportImport === 'Import') jobType = 'Import';
                }
            }

            const enquiryOther = quote.EnquiryHeader?.enquiryOther?.[0];

            return {
                quotation: true,
                quotationHeader: { QuoteNumber: quote.QuoteNumber },
                BookingHeaderSid: null,
                DepartmentMasterSid: approvedRoute.DepartmentMasterSid || null,
                IncoTerms: approvedRoute.ServiceLevel,
                CustomerMasterSid: quote.CustomerMasterSid || null,
                CustomerBranchSid: quote.CustomerBranchSid || null,
                CustomerName: quote.CustomerName || '',
                CustomerAddress: quote.CustomerAddress || '',
                SalesmanSid: quote.SalesmanSid || null,
                FreightTerms: approvedRoute.FreightPPCC || 'Prepaid',
                QuotationHeaderSid: quote.QuoteHeaderSid,
                QuoteRouteSid: approvedRoute.QuoteRouteSid || null,
                CarrierName: approvedCarrier?.CarrierName || '',
                status: 'A',
                JobType: jobType,
                IsContract: (quote as any).IsContract || 'N',
                ContractExpired: (quote as any).expDate ? new Date((quote as any).expDate) < new Date() : false,
                ShipperName: enquiryOther?.ShipperName || '',
                ShipperAddress: enquiryOther?.ShipperAddress || '',
                ConsigneeName: enquiryOther?.ConsigneeName || '',
                ConsigneeAddress: enquiryOther?.ConsigneeAddress || '',
                POO: portMap.get(approvedRoute.PORSid) || null,
                POL: portMap.get(approvedRoute.POLSid) || null,
                POD: portMap.get(approvedRoute.PODSid) || null,
                FPD: portMap.get(approvedRoute.FDPSid) || null,
                bookingCargo: cargo ? [{
                    CargoType: cargo.CargoType || 'General',
                    GrossWeight: toNumber(cargo.GrossWeight),
                    NetWeight: toNumber(cargo.NetWeight),
                    Volume: toNumber(cargo.Volume),
                    Volumetric: toNumber((cargo as any).Volumetric),
                    ChargeableWeight: toNumber(cargo.ChargeableWeight),
                    ContainerType: containerTypeId,
                    NoofContainers: toNumber(cargo.Qty),
                    NoOfPackage: toNumber(cargo.PackageQty)
                }] : [],
                bookingOthers: [{ CargoCurrency: null, CargoValue: 0 }],
                bookingProduct: (cargo?.quoteProduct || []).map(product => ({
                    ProductName: product.ProductName,
                    ExternaPkg: product.PackageType,
                    ExternlQty: product.ExternalQty,
                    GrossWeight: toNumber(product.GrossWeight),
                    NetWeight: toNumber(product.NetWeight),
                    Volume: toNumber(product.Volume),
                    IsHaz: product.IsHaz,
                    ImcoClass: product.ImcoClass,
                    UnNo: null,
                    PkgGroup: product.PkgGroup,
                    Length: toNumber(product.Length),
                    Width: toNumber(product.Width),
                    Height: toNumber(product.Height),
                    UomMasterSid: product.ProductUnit,
                    Volumetric: toNumber(product.Volumetric)
                })),
                bookingRates: (approvedCarrier?.quoteCharge || []).map((charge, index) => ({
                    CompanyMasterSid: charge.CompanyMasterSid,
                    BranchMasterSid: charge.BranchMasterSid,
                    SerialNumber: index + 1,
                    ChargeMasterSid: charge.ChargeUomSid,
                    ChargeDescription: charge.ChargeDisplayName,
                    NoOfUnit: toNumber(charge.Qty) || 1,
                    CostChargeUomSid: charge.CostChargeUomSid,
                    CostPrepaidCollect: charge.CostPrepaidCollect || 'Prepaid',
                    CostDrCr: charge.CostDrCr || 'D',
                    CostCurrencyMasterSid: charge.CostCurrencyMasterSid,
                    CostExchangeRate: toNumber(charge.CostExchangeRate) || 1,
                    CostRate: toNumber(charge.CostRate),
                    CostAmount: toNumber(charge.CostAmount),
                    CostLocalAmount: toNumber(charge.CostLocalAmount),
                    AgentMasterSid: charge.CostAgentMasterSid,
                    CostAgentBranchSid: charge.CostAgentBranchSid,
                    CostAgentMasterSid: charge.CostAgentMasterSid,
                    RevenueChargeUomSid: (charge as any).RevenueChargeUomSid,
                    RevenuePrepaidCollect: (charge as any).RevenuePrepaidCollect || 'Prepaid',
                    RevenueDrCr: (charge as any).RevenueDrCr || 'C',
                    RevenueCurrencyMasterSid: (charge as any).RevenueCurrencyMasterSid,
                    RevenueExchangeRate: toNumber((charge as any).RevenueExchangeRate) || 1,
                    RevenueRate: toNumber((charge as any).RevenueRate),
                    RevenueAmount: toNumber((charge as any).RevenueAmount),
                    RevenueLocalAmount: toNumber((charge as any).RevenueLocalAmount),
                    CustomerMasterSid: (charge as any).RevenueCustomerMasterSid,
                    RevenueCustomerMasterSid: (charge as any).RevenueCustomerMasterSid,
                    RevenueCustomerBranchSid: (charge as any).RevenueCustomerBranchSid,
                    QuoteChargeSid: charge.QuoteChargeSid,
                    TariffDetailSid: (charge as any).TariffDetailSid
                }))
            };
        } catch (error) {
            throw error;
        }
    }

    async findQuote(quoteId: any) {
        try {
            return await this._db.quoteHeader.findUnique({
                where: {
                    QuoteHeaderSid: quoteId
                },
                include: {
                    quoteRoute : {
                        where : { status : statusWhereClause},
                        include : {
                            // route - carrier - charge
                            quoteCarrier : { where : 
                                { status : statusWhereClause},
                                include : {
                                    quoteCharge : { where : 
                                        { status : statusWhereClause}
                                    }
                                }
                            },

                            // route - cargo - product
                            quoteCargo : { where : 
                                { Status : statusWhereClause},
                                include : {
                                    quoteProduct : { where : 
                                        { Status : statusWhereClause}
                                    }
                                }
                            },
                        }
                    },
                    EnquiryHeader:{
                        include:{
                            enquiryOther:{
                                select:{
                                    ShipperName: true,
                                    ShipperAddress:true,
                                    ConsigneeName: true,
                                    ConsigneeAddress: true,
                                }
                            },
                            enquiryCargo: {
                                select: {
                                    ProductName: true,
                                    PackageQty: true,
                                    length: true,
                                    width: true,
                                    height: true
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

    // async checkIfUserIsAuthorizerForQuotation(payload:any){
    //     const authorizer = await this._db.authorityDetail.findFirst({
    //         where: {
    //             UserMasterSid: payload.UserMasterSid,
    //             CompanyMasterSid: payload.CompanyMasterSid,
    //             BranchMasterSid: payload.BranchMasterSid,
    //             status: 'A',
    //             authorityMaster: {
    //                 status: 'A',
    //                 MenuMaster: payload.MenuMasterSid,
    //                 CompanyMasterSid: payload.CompanyMasterSid,
    //                 BranchMasterSid: payload.BranchMasterSid
    //             }
    //         },
    //         select: {
    //             AuthorityDetailSid: true,
    //             AuthorityLevel : true,
    //         }
    //     });

    //     if (!authorizer) {
    //         return { 
    //             isAuthorizer : false, 
    //             isAlreadyAuthorized : false, 
    //             AuthorityDetailSid : null,
    //             AuthorityLevel : null,
    //             message: "User is not an authorizer for this menu."
    //         };
    //     }

    //     const alreadyAuthorized = await this._db.authorityLog.findFirst({
    //         where: {
    //             AuthorityDetailSid: authorizer.AuthorityDetailSid,
    //             DocumentSid: payload.DocumentSid,
    //             Status: 'A'
    //         },
    //         select: {
    //             AuthorityLogSid: true
    //         }
    //     });

    //     if (alreadyAuthorized) {
    //         return {
    //             isAuthorizer: true,
    //             isAlreadyAuthorized: true,
    //             AuthorityDetailSid: authorizer.AuthorityDetailSid,
    //             AuthorityLevel: authorizer.AuthorityLevel,
    //             message: "User is authorized and has not yet approved this document."
    //         };
    //     }

    //     return {
    //         isAuthorizer: true,
    //         isAlreadyAuthorized: false,
    //         AuthorityDetailSid: authorizer.AuthorityDetailSid,
    //         AuthorityLevel: authorizer.AuthorityLevel,
    //         message: "User is a valid authorizer for this menu."
    //     };

    // }

}


// let authLogUpdate;
// if (payload.approvalStatusChange) {
//     const authorityDetail = await this._db.authorityDetail.findFirst({
//         where: {
//             CompanyMasterSid: payload.CompanyMasterSid,
//             BranchMasterSid: payload.BranchMasterSid,
//             UserMasterSid: payload.UserMasterSid,
//             status: 'A',
//             authorityMaster: {
//                 MenuMaster: payload.MenuMaster,
//                 status: 'A',
//             },
//         },
//     });

//     if (!authorityDetail) {
//         throw new NotFoundException('AuthorityDetail not found for this user/menu.');
//     }

//     authLogUpdate = await this._db.authorityLog.create({
//         data: {
//             CompanyMasterSid: payload.CompanyMasterSid,
//             BranchMasterSid: payload.BranchMasterSid,
//             CreatedBy: payload.updatedBy,
//             UpdatedBy: payload.updatedBy,
//             CreatedOn: new Date(),
//             UpdatedOn: new Date(),
//             Status: 'A',
//             DocumentSid: QuoteHeaderSid,
//             AuthorityDetailSid: authorityDetail.AuthorityDetailSid,
//             ApprovalStatus: payload.authorizerStatus,
//             AuthorisedDate: new Date(),
//             Remarks: payload.AuthorizerRemarks,
//         },
//     });

//     if (authorityDetail.FinalAuthority === 'Y') {

//         await this._db.quoteHeader.update({
//             where: { QuoteHeaderSid },
//             data: {
//                 authorizerStatus: payload.authorizerStatus,
//                 AuthorizerRemarks: payload.AuthorizerRemarks,
//             },
//         });
//     }
// }

