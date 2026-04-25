import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OperationCommonService } from '../operation-common/operation-common.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import * as moment from 'moment-timezone';
import { parseDateFromString, statusWhereClause, toNumber } from 'src/common/helper';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';
import { Prisma } from '@prisma/client';
interface searchHouseJob {
    search: string,
    page: number,
    pageSize: number,
    activeCompanyId: number,
    activeBranchId: number,
    departmentType: string,
    dateFrom?: string,
    dateTo?: string,
    dateField?: string,
    partyType?: string,
    partyId?: number,
    partyName?: string
}
@Injectable()
export class HouseJobService {
    constructor(
        private _db: DatabaseService,
        private commonService: OperationCommonService,
        private menuService: MenuService,
        private logger: Logger,
        private numberSeriesService: NumberSeriesService,
    ) { }

    private getHouseJobCargoPayloads(payload: any): any[] {
        const cargoPayload = payload?.houseJobCargo ?? payload?.cargo ?? payload?.Cargo;

        if (Array.isArray(cargoPayload)) {
            return cargoPayload;
        }

        if (cargoPayload && typeof cargoPayload === 'object') {
            return [cargoPayload];
        }

        return [];
    }

    private getHouseJobCargoProducts(cargo: any, fallbackProducts: any[] = []): any[] {
        if (Array.isArray(cargo?.bookingProducts)) {
            return cargo.bookingProducts;
        }

        if (Array.isArray(cargo?.products)) {
            return cargo.products;
        }

        if (Array.isArray(cargo?.houseJobProducts)) {
            return cargo.houseJobProducts;
        }

        return fallbackProducts;
    }

    private getFlatHouseJobProducts(payload: any): any[] {
        const flatProducts = payload?.houseJobProduct ?? payload?.products ?? payload?.bookingProducts;
        return Array.isArray(flatProducts) ? flatProducts : [];
    }

    private getHouseJobProxyPayloads(payload: any): any[] {
        const proxyPayload = payload?.houseJobProxy ?? payload?.proxy ?? payload?.HouseJobProxy;

        if (Array.isArray(proxyPayload)) {
            return proxyPayload;
        }

        if (proxyPayload && typeof proxyPayload === 'object') {
            return [proxyPayload];
        }

        return [];
    }

    private buildHouseJobProxyData(proxy: any, HouseJobSid: number, createdBy: string, updatedBy?: string | null) {
        return {
            HouseJobSid,
            CustomerName: proxy?.CustomerName || null,
            CustomerAddress: proxy?.CustomerAddress || null,
            AgentName: proxy?.AgentName || null,
            AgentAddress: proxy?.AgentAddress || null,
            ShipperName: proxy?.ShipperName || null,
            ShipperAddress: proxy?.ShipperAddress || null,
            ConsigneeName: proxy?.ConsigneeName || null,
            ConsigneeAddress: proxy?.ConsigneeAddress || null,
            VesselName: proxy?.VesselName || null,
            VoyageNo: proxy?.VoyageNo || null,
            POO: proxy?.POO || null,
            FPD: proxy?.FPD || null,
            CarrierName: proxy?.CarrierName || null,
            CreatedBy: createdBy,
            UpdatedBy: updatedBy ?? null,
            UpdatedOn: updatedBy ? new Date() : null,
            Status: proxy?.Status ? String(proxy.Status).charAt(0) : 'A',
        };
    }

    private async syncHouseJobProxy(
        prisma: any,
        HouseJobSid: number,
        payload: any,
        createdBy: string,
        updatedBy: string | null = null,
        mode: 'create' | 'update' = 'create',
    ) {
        const proxyPayloads = this.getHouseJobProxyPayloads(payload);
        const createdOrUpdatedProxy: any[] = [];

        if (mode === 'update') {
            if (proxyPayloads.length > 0) {
                const usedProxyIds = new Set<number>();

                for (const proxyPayload of proxyPayloads) {
                    const proxyId = proxyPayload?.HouseJobProxySid ?? proxyPayload?.houseJobProxySid ?? null;
                    const proxyData = this.buildHouseJobProxyData(proxyPayload, HouseJobSid, createdBy, updatedBy);
                    let proxyRow;

                    if (proxyId) {
                        proxyRow = await prisma.houseJobProxy.update({
                            where: { HouseJobProxySid: Number(proxyId) },
                            data: proxyData,
                        });
                    } else {
                        proxyRow = await prisma.houseJobProxy.create({
                            data: proxyData,
                        });
                    }

                    createdOrUpdatedProxy.push(proxyRow);
                    usedProxyIds.add(proxyRow.HouseJobProxySid);
                }

                await prisma.houseJobProxy.updateMany({
                    where: {
                        HouseJobSid,
                        Status: 'A',
                        HouseJobProxySid: { notIn: Array.from(usedProxyIds) },
                    },
                    data: {
                        Status: 'D',
                        UpdatedBy: updatedBy ?? createdBy,
                    },
                });
            } else {
                await prisma.houseJobProxy.updateMany({
                    where: {
                        HouseJobSid,
                        Status: 'A',
                    },
                    data: {
                        Status: 'D',
                        UpdatedBy: updatedBy ?? createdBy,
                    },
                });
            }
        } else {
            for (const proxyPayload of proxyPayloads) {
                const proxyData = this.buildHouseJobProxyData(proxyPayload, HouseJobSid, createdBy, updatedBy);
                const proxyRow = await prisma.houseJobProxy.create({
                    data: proxyData,
                });
                createdOrUpdatedProxy.push(proxyRow);
            }
        }

        return createdOrUpdatedProxy;
    }

    private buildHouseJobCargoData(cargoPayload: any, payload: any, HouseJobSid: number, createdBy: string, updatedBy?: string | null) {
        return {
            HouseJobSid,
            CompanyMasterSid: payload.CompanyMasterSid ?? null,
            BranchMasterSid: payload.BranchMasterSid ?? null,
            NoOfPackage: Number(cargoPayload?.NoOfPackage ?? cargoPayload?.PackageQty ?? cargoPayload?.Qty ?? 0) || 0,
            FreightAmount: String(cargoPayload?.FreightAmount ?? '0'),
            CargoType: cargoPayload?.CargoType ?? '',
            ContainerType: cargoPayload?.ContainerType ?? null,
            WeightUnitSid: cargoPayload?.WeightUnitSid ?? cargoPayload?.WeightUnit ?? null,
            GrossWeight: Number(cargoPayload?.GrossWeight) || 0,
            NetWeight: Number(cargoPayload?.NetWeight) || 0,
            Volume: Number(cargoPayload?.Volume) || 0,
            Volumetric: Number(cargoPayload?.Volumetric) || 0,
            ChargeableWeight: Number(cargoPayload?.ChargeableWeight) || 0,
            PackageType: cargoPayload?.PackageType ?? null,
            Qty: Number(cargoPayload?.Qty) || 0,
            ShipmentTerms: cargoPayload?.ShipmentTerms || '',
            FreightTerms: cargoPayload?.FreightTerms || '',
            MovementType: cargoPayload?.MovementType || '',
            CommodityDescription: cargoPayload?.CommodityDescription || '',
            MarksAndNumber: cargoPayload?.MarksAndNumber || '',
            LandedMarksandNumber: cargoPayload?.LandedMarksandNumber || '',
            ModeOfTransport: cargoPayload?.ModeOfTransport || '',
            NoofContainers: Number(cargoPayload?.NoofContainers) || 0,
            StuffingAt: cargoPayload?.StuffingAt || '',
            createdBy,
            updatedBy: updatedBy ?? null,
            status: cargoPayload?.status ? String(cargoPayload.status).charAt(0) : 'A',
        };
    }

    private buildHouseJobProductData(product: any, payload: any, HouseJobSid: number, HouseJobCargoSid: number | null, createdBy: string, updatedBy?: string | null) {
        return {
            HouseJobSid,
            HouseJobCargoSid,
            ProductName: product?.ProductName || '',
            ProductDescription: product?.ProductDescription || '',
            ShippingBillNo: product?.ShippingBillNo || '',
            ShippingBillDate: product?.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
            ExternaPkg: product?.ExternaPkg ?? product?.ExternalPkg ?? '',
            ExternlQty: product?.ExternlQty ?? product?.ExternalQty ?? '',
            InternalPkg: product?.InternalPkg ?? '',
            InternalQty: product?.InternalQty ?? '',
            GrossWeight: Number(product?.GrossWeight) || 0,
            ActualGrWeight: Number(product?.ActualGrWeight ?? product?.GrossWeight) || 0,
            NetWeight: Number(product?.NetWeight) || 0,
            Volume: Number(product?.Volume) || 0,
            ActualVolume: Number(product?.ActualVolume ?? product?.Volume) || 0,
            RecdPack: product?.RecdPack || '',
            CargoRecDate: product?.CargoRecDate ? new Date(product.CargoRecDate) : null,
            CFS: product?.CFS || '',
            Height: product?.Height || 0,
            Volumetric: Number(product?.Volumetric) || 0,
            HSCode: product?.HSCode || '',
            ImcoClass: product?.ImcoClass || '',
            IsHaz: product?.IsHaz || 'N',
            Length: product?.Length || 0,
            PkgGroup: product?.PkgGroup || '',
            UnNo: product?.UnNo || '',
            Width: product?.Width || 0,
            UomMasterSid: product?.UomMasterSid || null,
            ContainerNo: product?.ContainerNo || null,
            MasterJobContainerSid: product?.MasterJobContainerSid || null,
            DeliveryDate: product?.DeliveryDate ? new Date(product.DeliveryDate) : null,
            ReceivedQty: product?.ReceivedQty || 0,
            DamageQty: product?.DamageQty || 0,
            DamageRemarks: product?.DamageRemarks || '',
            DeliveredQty: product?.DeliveredQty || 0,
            MarksAndNumber: product?.MarksAndNumber || '',
            createdBy,
            updatedBy: updatedBy ?? null,
            status: product?.status ? String(product.status).charAt(0) : 'A',
        };
    }

    private async syncHouseJobCargoTree(
        prisma: any,
        HouseJobSid: number,
        payload: any,
        createdBy: string,
        updatedBy: string | null = null,
        mode: 'create' | 'update' = 'create',
    ) {
        const cargoPayloads = this.getHouseJobCargoPayloads(payload);
        const flatProducts = this.getFlatHouseJobProducts(payload);
        const createdOrUpdatedCargos: any[] = [];
        const createdOrUpdatedProducts: any[] = [];

        const shouldUseCargoTree = cargoPayloads.length > 0;

        if (mode === 'update') {
            if (shouldUseCargoTree) {
                const usedCargoIds = new Set<number>();
                const usedProductIds = new Set<number>();

                for (const cargoPayload of cargoPayloads) {
                    const cargoId = cargoPayload?.HouseJobCargoSid ?? cargoPayload?.houseJobCargoSid ?? null;
                    const cargoData = this.buildHouseJobCargoData(cargoPayload, payload, HouseJobSid, createdBy, updatedBy);
                    let cargoRow;

                    if (cargoId) {
                        cargoRow = await prisma.houseJobCargo.update({
                            where: { HouseJobCargoSid: Number(cargoId) },
                            data: cargoData,
                        });
                    } else {
                        cargoRow = await prisma.houseJobCargo.create({
                            data: cargoData,
                        });
                    }

                    createdOrUpdatedCargos.push(cargoRow);
                    usedCargoIds.add(cargoRow.HouseJobCargoSid);

                    const nestedProducts = this.getHouseJobCargoProducts(cargoPayload, []);
                    for (const product of nestedProducts) {
                        const productId = product?.HouseJobProductSid ?? product?.houseJobProductSid ?? null;
                        const productData = this.buildHouseJobProductData(product, payload, HouseJobSid, cargoRow.HouseJobCargoSid, createdBy, updatedBy);
                        const shouldFlagHaz = String(product?.IsHaz || '').toUpperCase() === 'Y' && product?.MasterJobContainerSid;

                        if (productId) {
                            const updatedProduct = await prisma.houseJobProduct.update({
                                where: { HouseJobProductSid: Number(productId) },
                                data: productData,
                            });
                            createdOrUpdatedProducts.push(updatedProduct);
                            usedProductIds.add(updatedProduct.HouseJobProductSid);
                            if (shouldFlagHaz) {
                                await prisma.masterJobContainer.updateMany({
                                    where: {
                                        MasterJobContainerSid: Number(product.MasterJobContainerSid),
                                        Status: 'A',
                                    },
                                    data: {
                                        IsHaz: 'Y',
                                        UpdatedBy: updatedBy ?? createdBy,
                                    },
                                });
                            }
                        } else {
                            const createdProduct = await prisma.houseJobProduct.create({
                                data: productData,
                            });
                            createdOrUpdatedProducts.push(createdProduct);
                            usedProductIds.add(createdProduct.HouseJobProductSid);
                            if (shouldFlagHaz) {
                                await prisma.masterJobContainer.updateMany({
                                    where: {
                                        MasterJobContainerSid: Number(product.MasterJobContainerSid),
                                        Status: 'A',
                                    },
                                    data: {
                                        IsHaz: 'Y',
                                        UpdatedBy: updatedBy ?? createdBy,
                                    },
                                });
                            }
                        }
                    }
                }

                await prisma.houseJobCargo.updateMany({
                    where: {
                        HouseJobSid,
                        status: 'A',
                        HouseJobCargoSid: { notIn: Array.from(usedCargoIds) },
                    },
                    data: {
                        status: 'D',
                        updatedBy: updatedBy ?? createdBy,
                    },
                });

                await prisma.houseJobProduct.updateMany({
                    where: {
                        HouseJobSid,
                        status: 'A',
                        HouseJobProductSid: { notIn: Array.from(usedProductIds) },
                    },
                    data: {
                        status: 'D',
                        updatedBy: updatedBy ?? createdBy,
                    },
                });
            } else if (flatProducts.length > 0) {
                const usedProductIds = new Set<number>();

                for (const product of flatProducts) {
                    const productId = product?.HouseJobProductSid ?? product?.houseJobProductSid ?? null;
                    const cargoId = product?.HouseJobCargoSid ?? product?.houseJobCargoSid ?? null;
                    const productData = this.buildHouseJobProductData(product, payload, HouseJobSid, cargoId ? Number(cargoId) : null, createdBy, updatedBy);
                    const shouldFlagHaz = String(product?.IsHaz || '').toUpperCase() === 'Y' && product?.MasterJobContainerSid;

                    if (productId) {
                        const updatedProduct = await prisma.houseJobProduct.update({
                            where: { HouseJobProductSid: Number(productId) },
                            data: productData,
                        });
                        createdOrUpdatedProducts.push(updatedProduct);
                        usedProductIds.add(updatedProduct.HouseJobProductSid);
                        if (shouldFlagHaz) {
                            await prisma.masterJobContainer.updateMany({
                                where: {
                                    MasterJobContainerSid: Number(product.MasterJobContainerSid),
                                    Status: 'A',
                                },
                                data: {
                                    IsHaz: 'Y',
                                    UpdatedBy: updatedBy ?? createdBy,
                                },
                            });
                        }
                    } else {
                        const createdProduct = await prisma.houseJobProduct.create({
                            data: productData,
                        });
                        createdOrUpdatedProducts.push(createdProduct);
                        usedProductIds.add(createdProduct.HouseJobProductSid);
                        if (shouldFlagHaz) {
                            await prisma.masterJobContainer.updateMany({
                                where: {
                                    MasterJobContainerSid: Number(product.MasterJobContainerSid),
                                    Status: 'A',
                                },
                                data: {
                                    IsHaz: 'Y',
                                    UpdatedBy: updatedBy ?? createdBy,
                                },
                            });
                        }
                    }
                }

                await prisma.houseJobProduct.updateMany({
                    where: {
                        HouseJobSid,
                        status: 'A',
                        HouseJobProductSid: { notIn: Array.from(usedProductIds) },
                    },
                    data: {
                        status: 'D',
                        updatedBy: updatedBy ?? createdBy,
                    },
                });
            }
        } else {
            if (shouldUseCargoTree) {
                for (const cargoPayload of cargoPayloads) {
                    const cargoData = this.buildHouseJobCargoData(cargoPayload, payload, HouseJobSid, createdBy, updatedBy);
                    const cargoRow = await prisma.houseJobCargo.create({ data: cargoData });
                    createdOrUpdatedCargos.push(cargoRow);

                    const nestedProducts = this.getHouseJobCargoProducts(cargoPayload, []);
                    for (const product of nestedProducts) {
                        const productData = this.buildHouseJobProductData(product, payload, HouseJobSid, cargoRow.HouseJobCargoSid, createdBy, updatedBy);
                        const shouldFlagHaz = String(product?.IsHaz || '').toUpperCase() === 'Y' && product?.MasterJobContainerSid;
                        const createdProduct = await prisma.houseJobProduct.create({ data: productData });
                        createdOrUpdatedProducts.push(createdProduct);
                        if (shouldFlagHaz) {
                            await prisma.masterJobContainer.updateMany({
                                where: {
                                    MasterJobContainerSid: Number(product.MasterJobContainerSid),
                                    Status: 'A',
                                },
                                data: {
                                    IsHaz: 'Y',
                                    UpdatedBy: updatedBy ?? createdBy,
                                },
                            });
                        }
                    }
                }
            } else {
                for (const product of flatProducts) {
                    const cargoId = product?.HouseJobCargoSid ?? product?.houseJobCargoSid ?? null;
                    const productData = this.buildHouseJobProductData(product, payload, HouseJobSid, cargoId ? Number(cargoId) : null, createdBy, updatedBy);
                    const shouldFlagHaz = String(product?.IsHaz || '').toUpperCase() === 'Y' && product?.MasterJobContainerSid;
                    const createdProduct = await prisma.houseJobProduct.create({ data: productData });
                    createdOrUpdatedProducts.push(createdProduct);
                    if (shouldFlagHaz) {
                        await prisma.masterJobContainer.updateMany({
                            where: {
                                MasterJobContainerSid: Number(product.MasterJobContainerSid),
                                Status: 'A',
                            },
                            data: {
                                IsHaz: 'Y',
                                UpdatedBy: updatedBy ?? createdBy,
                            },
                        });
                    }
                }
            }
        }

        return {
            houseJobCargo: createdOrUpdatedCargos,
            houseJobProduct: createdOrUpdatedProducts,
        };
    }

    private async getAgentMasterAirWaybillMenuSid() {
        try {
            return await this.menuService.getMenuSidByName('Agent Master Air Waybill');
        } catch {
            return await this.menuService.getMenuSidByName('AgentMaster Air Waybill');
        }
    }

    async createHouseJob(payload: any) {
        try {
            if (!payload.DepartmentMasterSid) {
                throw new BadRequestException('Department Master Sid is required');
            }
            const department = await this._db.departmentMaster.findUnique({
                where: { DepartmentMasterSid: payload.DepartmentMasterSid },
                select: {
                    departmentType: true,
                    ExportImport: true
                }
            });
            if (!department) {
                throw new BadRequestException('Department not found.');
            }

            const isAgentMasterAirWaybill = String(payload.JobType || '').toLowerCase() === 'agent';
            const menuId = isAgentMasterAirWaybill
                ? await this.getAgentMasterAirWaybillMenuSid()
                : await this.menuService.getMenuSidByName(
                    department.departmentType?.toUpperCase() === 'AIR'
                        ? "House Air Waybill"
                        : "House Job"
                );
            // ================= RESOLVE JOB DATE FIRST =================
            let resolvedJobDate: Date = payload.HBLDate
                ? new Date(payload.HBLDate)
                : new Date();

            if (payload?.shipmentList?.length) {
                const bookingIds = payload.shipmentList
                    .map(s => s.BookingHeaderSid)
                    .filter(Boolean);

                if (bookingIds.length > 0) {
                    const firstBooking = await this._db.bookingHeader.findFirst({
                        where: { BookingHeaderSid: { in: bookingIds } },
                        select: { BookingDateTime: true }
                    });

                    if (firstBooking?.BookingDateTime) {
                        resolvedJobDate = new Date(firstBooking.BookingDateTime);
                    }
                }
            }
            // Get MenuMasterSid for House Job (look up by code or use provided value)
            let numberSeriesMenuId = payload.NumberSeriesMenuMasterSid;
            if (!numberSeriesMenuId) {
                const houseJobMenu = await this._db.menuMaster.findFirst({
                    where: {
                        OR: [
                            { MenuCode: 'HJB' },
                            { MenuCode: 'HJ' },
                            { MenuName: { contains: 'house job', mode: 'insensitive' } }
                        ],
                        status: 'A'
                    }
                });
                numberSeriesMenuId = houseJobMenu?.MenuMasterSid;
            }

            const departmentExportImport = department?.ExportImport ?? null;

            // Generate HBL number using NumberSeriesService (for Export only)
            let HBLNo: string | null = null;
            if (isAgentMasterAirWaybill) {
                HBLNo = null;
            }
            else if (payload.HBLNo && payload.HBLNo.trim() !== '') {
                HBLNo = payload.HBLNo.trim();
            }
            // 🎯 Otherwise → Auto generate
            else {
                if (numberSeriesMenuId) {
                    HBLNo = await this.numberSeriesService.generateNextNumber(
                        payload.CompanyMasterSid,
                        payload.BranchMasterSid,
                        numberSeriesMenuId,
                        payload.DepartmentMasterSid,
                        resolvedJobDate,
                    );
                }

                // fallback generator
                if (!HBLNo) {
                    const dateString = moment().format('YYYYMMDD');
                    const hblBaseCount = await this._db.houseJob.count({
                        where: { HBLNo: { contains: dateString } },
                    });

                    HBLNo = `HOUSE-${dateString}-${(hblBaseCount + 1)
                        .toString()
                        .padStart(3, '0')}`;
                }
            }

            const createdHouseJob = await this._db.$transaction(async (prisma) => {


                // Create main House Job record
                const houseJob = await prisma.houseJob.create({
                    data: {
                        MasterJobSid: payload.MasterJobSid || null,
                        BookingHeaderSid: payload.BookingHeaderSid || null,
                        ColoadedBy: payload.ColoadedBy || '',
                        BookingNo: payload.BookingNo || '',
                        BookingDateTime: payload.BookingDateTime || null,
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        BranchMasterSid: payload.BranchMasterSid || null,
                        CustomerMasterSid: payload.CustomerMasterSid || null,
                        CustomerName: payload.CustomerName || '',
                        CustomerAddress: payload.CustomerAddress || '',
                        SalesmanSid: payload.SalesmanSid || null,
                        CargoExpectedon: payload.CargoExpectedon || null,
                        FreightTerms: payload.FreightTerms || '',
                        POO: payload.POO || '',
                        POL: payload.POL || '',
                        POD: payload.POD || '',
                        FPD: payload.FPD || '',
                        TsPortSid: payload.TsPortSid || null,
                        POLTerminal: payload.POLTerminal || '',
                        VoyageMasterSid: payload.VoyageMasterSid || null,
                        VesselName: payload.VesselName || '',
                        VoyageNo: payload.VoyageNo || '',
                        HBLDate: payload.HBLDate ? new Date(payload.HBLDate) : new Date(),
                        ETD: payload.ETD ? new Date(payload.ETD) : null,
                        ETA: payload.ETA ? new Date(payload.ETA) : null,
                        IncoTerms: payload.IncoTerms || '',
                        BLLocation: payload.BLLocation || null,
                        ShipperName: payload.ShipperName || '',
                        ShipperAddress: payload.ShipperAddress || '',
                        ConsigneeName: payload.ConsigneeName || '',
                        ConsigneeAddress: payload.ConsigneeAddress || '',
                        ClearanceRequire: payload.ClearanceRequire || '',
                        ShipmentType: payload.ShipmentType || '',
                        DestinationAgent: payload.DestinationAgent,
                        AgentName: payload.AgentName || '',
                        AgentAddress: payload.AgentAddress || '',
                        HouseNo: payload.HouseNo || '',
                        QuotationHeaderSid: payload.QuotationHeaderSid || null,
                        EnquiryHeaderSid: payload.EnquiryHeaderSid || null,
                        MovementType: payload.MovementType || '',
                        DoValid: payload.DoValid || null,
                        IsServiceJob: payload.IsServiceJob || '',
                        createdBy: payload.createdBy || '',
                        updatedBy: payload.updatedBy || '',
                        status: payload.status || 'A',
                        HouseStatus: payload.HouseStatus,
                        HBLCount: payload.HBLCount || 0,
                        BookingStatus: payload.BookingStatus || '',
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        CustomerBranchSid: payload.CustomerBranchSid || null,
                        AuthorizerRemarks: payload.AuthorizerRemarks || '',
                        authorizerStatus: payload.authorizerStatus,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        CarrierSid: payload.CarrierSid || null,
                        CarrierName: payload.CarrierName || '',
                        Coload: payload.Coload || '',
                        GeneralNote: payload.GeneralNote || '',
                        HBLNo: HBLNo,
                        InternalNote: payload.InternalNote || '',
                        MBLDate: payload.MBLDate || null,
                        MBLNo: payload.MBLNo || '',
                        Nominated: payload.Nominated || '',
                        NominatedBy: payload.NominatedBy || '',
                        Notify: payload.Notify || '',
                        NotifyAddress: payload.NotifyAddress || '',
                        PODTerminal: payload.PODTerminal || '',
                        ShipmentNo: payload.ShipmentNo || '',
                        OriginAgent: payload.OriginAgent || '',
                        JobType: payload.JobType
                    }
                });

                const HouseJobSid = houseJob.HouseJobSid;

                const cargoTree = await this.syncHouseJobCargoTree(
                    prisma,
                    HouseJobSid,
                    payload,
                    payload.createdBy || payload.updatedBy || '',
                    payload.updatedBy ?? null,
                    'create',
                );

                const finalHouseJobCargo = cargoTree.houseJobCargo;
                const finalHouseJobProduct = cargoTree.houseJobProduct;

                // Create House Job Connections
                const finalHouseConnections: any[] = [];
                const houseConnectionPayload = payload.houseConnections || [];
                if (houseConnectionPayload.length > 0) {
                    for (const connection of houseConnectionPayload) {
                        const createdConnection = await prisma.houseJobConnection.create({
                            data: {
                                HouseJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: connection.ETD ? new Date(connection.ETD) : null,
                                ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks,
                                status: String(connection.status).charAt(0) || 'A',
                                createdBy: payload.createdBy,
                            }
                        });
                        finalHouseConnections.push(createdConnection);
                    }
                }

                // Create House Job Others
                let finalHouseJobOthers: any = null;
                const otherPayload = payload.houseJobOthers || {};
                if (Object.keys(otherPayload).length > 0) {
                    finalHouseJobOthers = await prisma.houseJobOthers.create({
                        data: {
                            HouseJobSid,
                            CustomerRefNo: otherPayload.CustomerRefNo || '',
                            OperationUser: otherPayload.OperationUser || '',
                            DocumentationUser: otherPayload.DocumentationUser || '',
                            CustomerServiceuser: otherPayload.CustomerServiceuser || '',
                            NotifyParty: otherPayload.NotifyParty || '',
                            NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                            CHAName: otherPayload.CHAName || '',
                            PickupMode: otherPayload.PickupMode || '',
                            YardCFS: otherPayload.YardCFS || '',
                            LocalTransport: otherPayload.LocalTransport || '',
                            OverseasTransport: otherPayload.OverseasTransport || '',
                            OverseasClearance: otherPayload.OverseasClearance || '',
                            PickupPlace: otherPayload.PickupPlace || '',
                            PickupDate: otherPayload.PickupDate ? new Date(otherPayload.PickupDate) : null,
                            SIConfirmationDate: otherPayload.SIConfirmationDate ? new Date(otherPayload.SIConfirmationDate) : null,
                            DGConfirmationDate: otherPayload.DGConfirmationDate ? new Date(otherPayload.DGConfirmationDate) : null,
                            PickupAddress: otherPayload.PickupAddress || '',
                            BlClause: otherPayload.BlClause || [],
                            DeliveryPlace: otherPayload.DeliveryPlace || '',
                            DeliveryDate: otherPayload.DeliveryDate || "",
                            DeliveryAddress: otherPayload.DeliveryAddress || '',
                            CargoCurrency: otherPayload.CargoCurrency || '',
                            CargoValue: Number(otherPayload.CargoValue) || 0,
                            ValueForInsurance: Number(otherPayload.ValueForInsurance) || 0,
                            InsuranceAmount: Number(otherPayload.InsuranceAmount) || 0,
                            ValuationCharge: Number(otherPayload.ValuationCharge) || 0,
                            HandlingInformation: otherPayload.HandlingInformation || '',
                            DeliveryMode: otherPayload.DeliveryMode || '',
                            ExternalRemarks: otherPayload.ExternalRemarks || '',
                            SwitchBL: otherPayload.SwitchBL || '',
                            TransporterName: otherPayload.TransporterName || '',
                            AgentAddress: otherPayload.AgentAddress || '',
                            BacktoBack: otherPayload.BackToBack || '',
                            CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                            CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                            Coloader: otherPayload.Coloader || '',
                            Forwarder: otherPayload.Forwarder || '',
                            ForwarderAddress: otherPayload.ForwarderAddress || '',
                            HBLNo: otherPayload.HBLNo || '',
                            Notify2: otherPayload.Notify2 || '',
                            NotifyAddress2: otherPayload.NotifyAddress2 || '',
                            ROValidity: otherPayload.ROValidity || '',
                            ReleaseType: otherPayload.ReleaseType || '',
                            DeclaredValueOfCarriage: otherPayload.DeclaredValueOfCarriage || '',
                            DeclaredValueOfCustoms: otherPayload.DeclaredValueOfCustoms || '',
                            IATARate: otherPayload.IATARate !== undefined && otherPayload.IATARate !== null && otherPayload.IATARate !== '' ? Number(otherPayload.IATARate) : null,
                            PlaceOfSupply: otherPayload.PlaceOfSupply || otherPayload.PlaceofSupply || '',
                            SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                            SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                            SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                            SwitchLocation: otherPayload.SwitchLocation || '',
                            Depo: otherPayload.Depo,
                            DONo: otherPayload.DONo || '',
                            DODate: otherPayload.DODate ? new Date(otherPayload.DODate) : null,
                            status: 'A',
                            createdBy: payload.createdBy,
                        }
                    });
                }

                const finalHouseJobProxy = await this.syncHouseJobProxy(
                    prisma,
                    HouseJobSid,
                    payload,
                    payload.createdBy || payload.updatedBy || '',
                    payload.updatedBy ?? null,
                    'create',
                );

                // Create Cost Revenue Charges
                const finalCharges: any[] = [];
                const allCostRevenueCharges = payload?.bookingRates || payload?.costRevenueCharges || [];

                let itemIndex = 1;
                for (const item of allCostRevenueCharges) {
                    const costRevenueChargesPayload = {
                        TransactionSid: houseJob.HouseJobSid,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        ShipmentNo: houseJob.ShipmentNo,
                        MasterJobNo: houseJob.MBLNo,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,

                        SerialNumber: itemIndex++,
                        ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                        ChargeDescription: item.ChargeDescription,

                        ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                        RevenueChargeUomSid: Number(item.RevenueChargeUomSid),
                        CostChargeUomSid: Number(item.CostChargeUomSid),
                        RevenueNumberOfUnit: item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null,
                        CostNumberOfUnit: item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null,

                        // Revenue Section
                        RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? item.RevenueCurrencyMasterSid : null,
                        RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                        RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                        RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                        RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                        RevenueDrCr: item.RevenueDrCr,
                        RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                        RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                        RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                        RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                        RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                        // Cost Section
                        CostCurrencyMasterSid: item.CostCurrencyMasterSid ? item.CostCurrencyMasterSid : null,
                        CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                        CostRate: item.CostRate ? Number(item.CostRate) : null,
                        CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                        CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                        CostDrCr: item.CostDrCr,
                        CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                        CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                        CostPrepaidCollect: item.CostPrepaidCollect,
                        CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                        PaymentRequestSid: item.PaymentRequestSid ? Number(item.PaymentRequestSid) : null,
                        CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                        createdBy: payload.createdBy,
                        status: "A",
                        Remarks: item.Remarks,
                        BookingRateSid : item.BookingRatesSid || null,
                        TariffDetailSid : item.TariffDetailSid || null
                    }

                    const createdCharge = await prisma.costRevenueCharges.create({
                        data: costRevenueChargesPayload
                    });
                    finalCharges.push(createdCharge);
                }

                // Create House Job BOE
                const finalHouseJobBOE: any[] = [];
                const houseJobBOEPayload = payload.houseJobBOE || [];
                if (houseJobBOEPayload.length > 0) {
                    for (const boe of houseJobBOEPayload) {
                        const createdBOE = await prisma.houseJobBOE.create({
                            data: {
                                HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                Sno: boe.Sno || 1,
                                DeclarationNo: boe.DeclarationNo || '',
                                BOENo: boe.BOENo || '',
                                BOEDate: boe.BOEDate ? new Date(boe.BOEDate) : null,
                                BOEValue: boe.BOEValue ? Number(boe.BOEValue) : null,
                                BOEInvoiceValue: boe.BOEInvoiceValue ? Number(boe.BOEInvoiceValue) : null,
                                TransactionType: boe.TransactionType || '',
                                Amount: boe.Amount ? Number(boe.Amount) : null,
                                ProcessDate: boe.ProcessDate ? new Date(boe.ProcessDate) : null,
                                ReceivedDate: boe.ReceivedDate ? new Date(boe.ReceivedDate) : null,
                                AckNumber: boe.AckNumber || '',
                                AckDate: boe.AckDate ? new Date(boe.AckDate) : null,
                                AckStatus: boe.AckStatus || '',
                                Remarks: boe.Remarks || '',
                                CreatedBy: payload.createdBy,
                                Status: 'A'
                            }
                        });
                        finalHouseJobBOE.push(createdBOE);
                    }
                }

                // Create House Job Vehicle
                let finalHouseJobVehicle: any[] = [];
                const houseJobVehiclePayload = payload.houseJobVehicle || [];
                if (houseJobVehiclePayload.length > 0) {
                    for (const vehicle of houseJobVehiclePayload) {
                        const createdVehicle = await prisma.houseJobVehicle.create({
                            data: {
                                HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                VehicleIndicator: vehicle.VehicleIndicator,
                                UsedNew: vehicle.UsedNew,
                                ChassisNo: vehicle.ChassisNo,
                                CaseNo: vehicle.CaseNo,
                                Make: vehicle.Make,
                                Model: vehicle.Model,
                                EngineNo: vehicle.EngineNo,
                                YearBuilt: vehicle.YearBuilt,
                                Color: vehicle.Color,
                                Rolling: vehicle.Rolling,
                                GoodsDescription: vehicle.GoodsDescription,
                                Weight: vehicle.Weight ? Number(vehicle.Weight) : null,
                                Volume: vehicle.Volume ? Number(vehicle.Volume) : null,
                                Remarks: vehicle.Remarks,
                                CreatedBy: payload.createdBy,
                                Status: 'A'
                            }
                        });
                        finalHouseJobVehicle.push(createdVehicle);
                    }
                }

                // Create House Job Customs
                let finalHouseJobCustoms: any[] = [];
                const houseJobCustomsPayload = payload.houseJobCustoms || [];
                if (houseJobCustomsPayload.length > 0) {
                    for (const customs of houseJobCustomsPayload) {
                        const createdCustoms = await prisma.houseJobCustoms.create({
                            data: {
                                HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                LineCode: customs.LineCode,
                                VoyageAgentCode: customs.VoyageAgentCode,
                                RotationNumber: customs.RotationNumber,
                                ManifestSequence: customs.ManifestSequence,
                                CargoCode: customs.CargoCode,
                                StorageRequest: customs.StorageRequest,
                                PackageTypeCode: customs.PackageTypeCode,
                                FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                                NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                                SLACIndicator: customs.SLACIndicator,
                                ImporterCode: customs.ImporterCode,
                                SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                                UsedOrNew: customs.UsedOrNew,
                                UNHSCode: customs.UNHSCode,
                                UNNumber: customs.UNNumber,
                                FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                                TemperatureUnit: customs.TemperatureUnit,
                                HazStorageRequest: customs.HazStorageRequest,
                                RefrigerationRequired: customs.RefrigerationRequired,
                                MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                                MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                                RefTemperatureUnit: customs.RefTemperatureUnit,
                                CreatedBy: payload.createdBy,
                                Status: 'A'
                            }
                        });
                        finalHouseJobCustoms.push(createdCustoms);
                    }
                }

                let finalAllMilestones: any = [];
                const allMilestones = payload.milestones || [];
                if (allMilestones.length > 0) {
                    for (const milestone of allMilestones) {
                        const createdMilestone = await prisma.shipmentMilestone.create({
                            data: {
                                HouseJobSid: houseJob.HouseJobSid,
                                ShipmentNo: houseJob.ShipmentNo!,
                                CompanyMasterSid: houseJob.CompanyMasterSid,
                                BranchMasterSid: houseJob.BranchMasterSid!,
                                CreatedBy: payload.createdBy,
                                Status: "A",
                                MilestoneMasterSid: milestone.MilestoneMasterSid,
                                Remarks: milestone.Remarks,
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured,
                            }
                        });
                        finalAllMilestones.push(createdMilestone);
                    }
                }

                if (houseJob.MasterJobSid) {
                    await this.recalculateMasterJobTotals(
                        prisma,
                        houseJob.MasterJobSid
                    );
                }

                //   const allMilestones = await prisma.shipmentMilestone.createMany({
                //     data :(payload.milestones || []).map(milestone => ({
                //         ShipmentNo : houseJob.ShipmentNo,
                //         CompanyMasterSid : houseJob.CompanyMasterSid,
                //         BranchMasterSid : houseJob.BranchMasterSid!,
                //         CreatedBy : payload.createdBy,
                //         Status : "A",
                //         MilestoneMasterSid : milestone.MilestoneMasterSid,
                //         Remarks : milestone.Remarks,
                //         MilestoneName : milestone.MilestoneName,
                //         MilestoneDate : milestone.MilestoneDate,
                //         AutoCaptured : milestone.AutoCaptured ? 'Y' : 'N'
                //     }))
                //   })

                return {
                    houseJob,
                    houseJobCargo: finalHouseJobCargo,
                    houseJobProduct: finalHouseJobProduct,
                    houseConnections: finalHouseConnections,
                    houseJobOthers: finalHouseJobOthers,
                    houseJobProxy: finalHouseJobProxy,
                    houseJobBOE: finalHouseJobBOE,
                    houseJobVehicle: finalHouseJobVehicle,
                    houseJobCustoms: finalHouseJobCustoms,
                    bookingRates: finalCharges,
                    costRevenueCharges: finalCharges,
                    shipmentMilestones: finalAllMilestones,


                };
            });

            return createdHouseJob;
        } catch (error) {
            throw error;
        }
    }




    async getHouseJobById(HouseJobSid: number) {
        try {
            const ourHouseJob = await this._db.houseJob.findUnique({
                where: {
                    HouseJobSid: HouseJobSid
                },
                include: {
                    departmentMaster: {
                        select: {
                            departmentType: true
                        }
                    },
                    Cargo: {
                        where: { status: 'A' }
                        ,
                        include: {
                            products: {
                                where: { status: 'A' },
                                include: {
                                    masterJobContainer: {
                                        select: {
                                            MasterJobContainerSid: true,
                                            ContainerType: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    Connections: {
                        where: { status: 'A' }
                    },
                    Others: {
                        where: { status: 'A' }
                    },
                    HouseJobProxy: {
                        where: { Status: 'A' }
                    },
                    Products: {
                        where: { status: 'A' },
                        include: {
                            houseJobCargo: {
                                select: {
                                    HouseJobCargoSid: true,
                                    CargoType: true,
                                    NoOfPackage: true,
                                }
                            },
                            masterJobContainer: {
                                select: {
                                    MasterJobContainerSid: true,
                                    ContainerType: true
                                }
                            }
                        }
                    },
                    houseJobBOE: {
                        where: {
                            Status: 'A'
                        }
                    },
                    houseJobVehicle: {
                        where: {
                            Status: 'A'
                        }
                    },
                    houseJobCustoms: {
                        where: {
                            Status: 'A'
                        }
                    },
                    ShipmentMilestone: {
                        where: {
                            Status: 'A'
                        }
                    },
                    bookingHeader : {
                        select : {
                            BookingHeaderSid : true,
                            BookingNo : true,
                            status : true
                        }
                    },
                    masterJob: {

                        where: {
                            Status: 'A',

                        },
                        select: {
                            MasterJobSid: true,
                            NoofOriginal: true,
                            MasterJobNumber: true,
                            MenuMasterSid: true,
                            MBLNo: true,
                            WeightIn: true,
                            containers: true,
                            others: true,
                            voyages: {
                                where: {
                                    Status: 'A'
                                },
                                take: 1
                            }
                        },

                    }


                }
            })
            if (!ourHouseJob) {
                throw new BadRequestException('Error fetching house job record.');
            }

            const isAgentMasterAirWaybill = String(ourHouseJob.JobType || '').toLowerCase() === 'agent';
            const menuId = isAgentMasterAirWaybill
                ? await this.getAgentMasterAirWaybillMenuSid()
                : await this.menuService.getMenuSidByName(
                    ourHouseJob.departmentMaster?.departmentType?.toUpperCase() === 'AIR'
                        ? "House Air Waybill"
                        : "House Job"
                );

            const costRevenuePayload = {
                TransactionSid: ourHouseJob.HouseJobSid,
                MenuMasterSid: menuId || ourHouseJob.MenuMasterSid!,
                CompanyMasterSid: ourHouseJob.CompanyMasterSid,
                BranchMasterSid: ourHouseJob.BranchMasterSid!,
            }

            const costRevenueCharges = await this.commonService.getAllCostRevenueCharges(costRevenuePayload);

            return {
                ...ourHouseJob,
                houseJobCargo: ourHouseJob.Cargo?.map((cargo: any) => ({
                    ...cargo,
                    products: cargo.products || []
                })) || [],
                costRevenueCharges,

            }
        } catch (error) {
            throw error;
        }
    }

    async getHouseJobByMasterJobSid(payload: any) {
        try {
            const { MasterJobSid, CompanyMasterSid, BranchMasterSid, SearchText, Skip, Take } = payload;
            const where: any = {
                MasterJobSid,
                CompanyMasterSid,
                BranchMasterSid,
                status: 'A',
                ...(SearchText && {
                    HBLNo: { contains: SearchText, mode: 'insensitive' },
                }),
            };
            const ourHouseJob = await this._db.houseJob.findMany({
                where,
                select: {
                    HouseJobSid: true,
                    HBLNo: true,
                    HBLDate : true
                },
                orderBy: [{ HBLDate : 'desc' } , { HBLNo: 'desc' }],
                skip: Skip ?? 0,
                take: Take ?? 100,
            })
            return ourHouseJob;
        } catch (error) {
            throw error;
        }
    }

    async updateHouseJobById(HouseJobSid: number, payload: any) {
        try {

            if (!payload.DepartmentMasterSid) {
                throw new BadRequestException('Department Master Sid is required.');
            }

            const department = await this._db.departmentMaster.findUnique({
                where: { DepartmentMasterSid: payload.DepartmentMasterSid },
                select: {
                    departmentType: true
                }
            });

            if (!department) {
                throw new BadRequestException('Department not found.');
            }

           const isAgentMasterAirWaybill = String(payload.JobType || '').toLowerCase() === 'agent';
            const menuId = isAgentMasterAirWaybill
                ? await this.getAgentMasterAirWaybillMenuSid()
                : await this.menuService.getMenuSidByName(
                    department.departmentType?.toUpperCase() === 'AIR'
                        ? "House Air Waybill"
                        : "House Job"
                );

            const updatedHouseJob = await this._db.$transaction(async (prisma) => {

                const updatedHouseJob = await prisma.houseJob.update({
                    where: {
                        HouseJobSid: HouseJobSid
                    },
                    data: {
                        MasterJobSid: payload.MasterJobSid || null,
                        BookingHeaderSid: payload.BookingHeaderSid || null,
                        ColoadedBy: payload.ColoadedBy || '',
                        BookingNo: payload.BookingNo || '',
                        BookingDateTime: payload.BookingDateTime || null,
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        BranchMasterSid: payload.BranchMasterSid || null,
                        CustomerMasterSid: payload.CustomerMasterSid || null,
                        CustomerName: payload.CustomerName || '',
                        CustomerAddress: payload.CustomerAddress || '',
                        SalesmanSid: payload.SalesmanSid || null,
                        CargoExpectedon: payload.CargoExpectedon || null,
                        FreightTerms: payload.FreightTerms || '',
                        POO: payload.POO || '',
                        POL: payload.POL || '',
                        POD: payload.POD || '',
                        FPD: payload.FPD || '',
                        TsPortSid: payload.TsPortSid || null,
                        POLTerminal: payload.POLTerminal || '',
                        VoyageMasterSid: payload.VoyageMasterSid || null,
                        VesselName: payload.VesselName || '',
                        VoyageNo: payload.VoyageNo || '',
                        HBLDate: payload.HBLDate ? new Date(payload.HBLDate) : null,
                        ETD: payload.ETD ? new Date(payload.ETD) : null,
                        ETA: payload.ETA ? new Date(payload.ETA) : null,
                        IncoTerms: payload.IncoTerms || '',
                        BLLocation: payload.BLLocation || null,
                        ShipperName: payload.ShipperName || '',
                        ShipperAddress: payload.ShipperAddress || '',
                        ConsigneeName: payload.ConsigneeName || '',
                        ConsigneeAddress: payload.ConsigneeAddress || '',
                        ClearanceRequire: payload.ClearanceRequire || '',
                        ShipmentType: payload.ShipmentType || '',
                        DestinationAgent: payload.DestinationAgent,
                        AgentName: payload.AgentName || '',
                        AgentAddress: payload.AgentAddress || '',
                        HouseNo: payload.HouseNo || '',
                        QuotationHeaderSid: payload.QuotationHeaderSid || null,
                        EnquiryHeaderSid: payload.EnquiryHeaderSid || null,
                        MovementType: payload.MovementType || '',
                        DoValid: payload.DoValid || null,
                        IsServiceJob: payload.IsServiceJob || '',
                        updatedBy: payload.updatedBy || '',
                        status: payload.status || '',
                        HouseStatus: payload.HouseStatus,
                        HBLCount: payload.HBLCount || 0,
                        BookingStatus: payload.BookingStatus || '',
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        CustomerBranchSid: payload.CustomerBranchSid || null,
                        AuthorizerRemarks: payload.AuthorizerRemarks || '',
                        authorizerStatus: payload.authorizerStatus,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        CarrierSid: payload.CarrierSid || null,
                        CarrierName: payload.CarrierName || '',
                        Coload: payload.Coload || '',
                        GeneralNote: payload.GeneralNote || '',
                        HBLNo: isAgentMasterAirWaybill ? ""+HouseJobSid : (payload.HBLNo || ''),
                        InternalNote: payload.InternalNote || '',
                        MBLDate: payload.MBLDate || null,
                        MBLNo: payload.MBLNo || '',
                        Nominated: payload.Nominated || '',
                        NominatedBy: payload.NominatedBy || '',
                        Notify: payload.Notify || '',
                        NotifyAddress: payload.NotifyAddress || '',
                        PODTerminal: payload.PODTerminal || '',
                        ShipmentNo: payload.ShipmentNo || '',
                        OriginAgent: payload.OriginAgent || '',
                        JobType: payload.JobType
                    }
                });
                const cargoTree = await this.syncHouseJobCargoTree(
                    prisma,
                    HouseJobSid,
                    payload,
                    payload.updatedBy || payload.createdBy || '',
                    payload.updatedBy ?? payload.createdBy ?? null,
                    'update',
                );

                // 3️⃣ ✅ NOW RECALCULATE MASTER JOB (CORRECT PLACE)
                if (updatedHouseJob.MasterJobSid) {
                    await this.recalculateMasterJobTotals(
                        prisma,
                        updatedHouseJob.MasterJobSid
                    );
                }

                return {
                    ...updatedHouseJob,
                    houseJobCargo: cargoTree.houseJobCargo,
                    houseJobProduct: cargoTree.houseJobProduct,
                };
            });
            
            // 🔁 Sync HBL / MBL to BookingHeader (ONLY if BookingHeaderSid exists)
            if (payload.BookingHeaderSid) {

                const houseJob = await this._db.houseJob.findUnique({
                    where: { HouseJobSid },
                    select: {
                        HBLNo: true,
                        MasterJobSid: true
                    }
                });

                if (houseJob?.MasterJobSid) {

                    const masterJob = await this._db.masterJob.findUnique({
                        where: { MasterJobSid: houseJob.MasterJobSid },
                        select: {
                            MBLNo: true
                        }
                    });

                    await this._db.bookingHeader.update({
                        where: {
                            BookingHeaderSid: payload.BookingHeaderSid
                        },
                        data: {
                            ...(houseJob.HBLNo && { HBLNo: houseJob.HBLNo }),
                            ...(masterJob?.MBLNo && { MBLNo: masterJob.MBLNo }),
                            updatedBy: payload.updatedBy
                        }
                    });
                }
            }

            let finalHouseConnections: any[] = [];
            const houseConnectionPayload = payload.houseConnections || [];
            if (houseConnectionPayload.length > 0) {
                for (const connection of houseConnectionPayload) {
                    let createdConnection;
                    let updatedConnection;
                    if (connection.HouseJobConnectionSid) {
                        updatedConnection = await this._db.houseJobConnection.update({
                            where: {
                                HouseJobConnectionSid: connection.HouseJobConnectionSid
                            },
                            data: {
                                HouseJobSid: HouseJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: connection.ETD ? new Date(connection.ETD) : null,
                                ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks,
                                updatedBy: payload.updatedBy,
                                status: String(connection.status).charAt(0) || 'A',
                            }
                        })
                    }
                    else {
                        createdConnection = await this._db.houseJobConnection.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: connection.ETD ? new Date(connection.ETD) : null,
                                ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks,
                                status: String(connection.status).charAt(0) || 'A',
                                createdBy: payload.updatedBy,
                            }
                        })
                    }
                    finalHouseConnections.push(updatedConnection || createdConnection);
                }
            }

            let finalHouseJobOthers;
            const otherPayload = payload.houseJobOthers || [];
            const HouseJobOthersSid = otherPayload.HouseJobOthersSid;
            if (HouseJobOthersSid) {
                finalHouseJobOthers = await this._db.houseJobOthers.update({
                    where: {
                        HouseJobOthersSid: HouseJobOthersSid
                    },
                    data: {
                        HouseJobSid: Number(HouseJobSid),
                        CustomerRefNo: otherPayload.CustomerRefNo || '',
                        OperationUser: otherPayload.OperationUser || '',
                        DocumentationUser: otherPayload.DocumentationUser || '',
                        CustomerServiceuser: otherPayload.CustomerServiceuser || '',
                        NotifyParty: otherPayload.NotifyParty || '',
                        NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                        CHAName: otherPayload.CHAName || '',
                        PickupMode: otherPayload.PickupMode || '',
                        YardCFS: otherPayload.YardCFS || '',
                        LocalTransport: otherPayload.LocalTransport || '',
                        OverseasTransport: otherPayload.OverseasTransport || '',
                        OverseasClearance: otherPayload.OverseasClearance || '',
                        PickupPlace: otherPayload.PickupPlace || '',
                        PickupDate: otherPayload.PickupDate ? new Date(otherPayload.PickupDate) : null,
                        SIConfirmationDate: otherPayload.SIConfirmationDate ? new Date(otherPayload.SIConfirmationDate) : null,
                        DGConfirmationDate: otherPayload.DGConfirmationDate ? new Date(otherPayload.DGConfirmationDate) : null,
                        PickupAddress: otherPayload.PickupAddress || '',
                        DeliveryPlace: otherPayload.DeliveryPlace || '',
                        DeliveryDate: otherPayload.DeliveryDate || "",
                        DeliveryAddress: otherPayload.DeliveryAddress || '',
                        CargoCurrency: otherPayload.CargoCurrency || '',
                        BlClause: otherPayload.BlClause || [],
                        CargoValue: Number(otherPayload.CargoValue) || 0,
                        ValueForInsurance: Number(otherPayload.ValueForInsurance) || 0,
                        InsuranceAmount: Number(otherPayload.InsuranceAmount) || 0,
                        ValuationCharge: Number(otherPayload.ValuationCharge) || 0,
                        HandlingInformation: otherPayload.HandlingInformation || '',
                        DeliveryMode: otherPayload.DeliveryMode || '',
                        ExternalRemarks: otherPayload.ExternalRemarks || '',
                        SwitchBL: otherPayload.SwitchBL || '',
                        TransporterName: otherPayload.TransporterName || '',
                        AgentAddress: otherPayload.AgentAddress || '',
                        BacktoBack: otherPayload.BackToBack || '',
                        CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                        CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                        Coloader: otherPayload.Coloader || '',
                        Forwarder: otherPayload.Forwarder || '',
                        ForwarderAddress: otherPayload.ForwarderAddress || '',
                        HBLNo: otherPayload.HBLNo || '',
                        Notify2: otherPayload.Notify2 || '',
                        NotifyAddress2: otherPayload.NotifyAddress2 || '',
                        ROValidity: otherPayload.ROValidity || '',
                        ReleaseType: otherPayload.ReleaseType || '',
                        DeclaredValueOfCarriage: otherPayload.DeclaredValueOfCarriage || '',
                        DeclaredValueOfCustoms: otherPayload.DeclaredValueOfCustoms || '',
                        IATARate: otherPayload.IATARate,
                        PlaceOfSupply: otherPayload.PlaceOfSupply || otherPayload.PlaceofSupply || '',
                        SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                        SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                        SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                        SwitchLocation: otherPayload.SwitchLocation || '',
                        Depo: otherPayload.Depo,
                        DONo: otherPayload.DONo || '',
                        DODate: otherPayload.DODate ? new Date(otherPayload.DODate) : null,
                        status: 'A',
                        updatedBy: payload.updatedBy || null,
                    }
                })
            } else {
                finalHouseJobOthers = await this._db.houseJobOthers.create({
                    data: {

                        CustomerRefNo: otherPayload.CustomerRefNo || '',
                        OperationUser: otherPayload.OperationUser || '',
                        DocumentationUser: otherPayload.DocumentationUser || '',
                        CustomerServiceuser: otherPayload.CustomerServiceuser || '',
                        NotifyParty: otherPayload.NotifyParty || '',
                        NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                        CHAName: otherPayload.CHAName || '',
                        PickupMode: otherPayload.PickupMode || '',
                        YardCFS: otherPayload.YardCFS || '',
                        LocalTransport: otherPayload.LocalTransport || '',
                        OverseasTransport: otherPayload.OverseasTransport || '',
                        OverseasClearance: otherPayload.OverseasClearance || '',
                        PickupPlace: otherPayload.PickupPlace || '',
                        PickupDate: otherPayload.PickupDate ? new Date(otherPayload.PickupDate) : null,
                        SIConfirmationDate: otherPayload.SIConfirmationDate ? new Date(otherPayload.SIConfirmationDate) : null,
                        DGConfirmationDate: otherPayload.DGConfirmationDate ? new Date(otherPayload.DGConfirmationDate) : null,
                        PickupAddress: otherPayload.PickupAddress || '',
                        DeliveryPlace: otherPayload.DeliveryPlace || '',
                        DeliveryDate: otherPayload.DeliveryDate || "",
                        BlClause: otherPayload.BlClause || null,
                        DeliveryAddress: otherPayload.DeliveryAddress || '',
                        CargoCurrency: otherPayload.CargoCurrency || '',
                        CargoValue: Number(otherPayload.CargoValue) || 0,
                        ValueForInsurance: Number(otherPayload.ValueForInsurance) || 0,
                        InsuranceAmount: Number(otherPayload.InsuranceAmount) || 0,
                        ValuationCharge: Number(otherPayload.ValuationCharge) || 0,
                        HandlingInformation: otherPayload.HandlingInformation || '',
                        DeliveryMode: otherPayload.DeliveryMode || '',
                        ExternalRemarks: otherPayload.ExternalRemarks || '',
                        SwitchBL: otherPayload.SwitchBL || '',
                        TransporterName: otherPayload.TransporterName || '',
                        AgentAddress: otherPayload.AgentAddress || '',
                        BacktoBack: otherPayload.BackToBack || '',
                        CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                        CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                        Coloader: otherPayload.Coloader || '',
                        Forwarder: otherPayload.Forwarder || '',
                        ForwarderAddress: otherPayload.ForwarderAddress || '',
                        HBLNo: otherPayload.HBLNo || '',
                        Notify2: otherPayload.Notify2 || '',
                        NotifyAddress2: otherPayload.NotifyAddress2 || '',
                        ROValidity: otherPayload.ROValidity || '',
                        ReleaseType: otherPayload.ReleaseType || '',
                        DeclaredValueOfCarriage: otherPayload.DeclaredValueOfCarriage || '',
                        DeclaredValueOfCustoms: otherPayload.DeclaredValueOfCustoms || '',
                        IATARate: otherPayload.IATARate !== undefined && otherPayload.IATARate !== null && otherPayload.IATARate !== '' ? Number(otherPayload.IATARate) : null,
                        PlaceOfSupply: otherPayload.PlaceOfSupply || otherPayload.PlaceofSupply || '',
                        SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                        SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                        SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                        SwitchLocation: otherPayload.SwitchLocation || '',
                        Depo: otherPayload.Depo,
                        DONo: otherPayload.DONo || '',
                        DODate: otherPayload.DODate ? new Date(otherPayload.DODate) : null,
                        status: 'A',
                        createdBy: payload.updatedBy || null,
                        HouseJob: {
                            connect: {
                                HouseJobSid: HouseJobSid
                            }
                        }

                    }

                })
            }

            const finalHouseJobProxy = await this.syncHouseJobProxy(
                this._db,
                HouseJobSid,
                payload,
                payload.updatedBy || payload.createdBy || '',
                payload.updatedBy ?? null,
                'update',
            );
            const finalCharges: any[] = [];
            const allCostRevenueCharges = payload?.bookingRates || payload?.costRevenueCharges || [];

            let itemIndex = 1;
            for (const item of allCostRevenueCharges) {
                let createdCharge;
                let updatedCharge;
                if (item.RateSid) {
                    // update
                    const costRevenueChargesPayload = {
                        TransactionSid: updatedHouseJob.HouseJobSid || item.RateSid,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        ShipmentNo: updatedHouseJob.ShipmentNo,
                        MasterJobNo: updatedHouseJob.MBLNo,
                        updatedBy: payload.updatedBy || payload.createdBy || '',
                        status: String(item.status).charAt(0) || 'A',
                        Remarks: item.Remarks || '',

                        SerialNumber: itemIndex++,
                        ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                        ChargeDescription: item.ChargeDescription,
                        ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                        RevenueChargeUomSid:
                            (item.RevenueChargeUomSid ? Number(item.RevenueChargeUomSid) : null) ||
                            (item.ChargeUomSid ? Number(item.ChargeUomSid) : null)!,
                        CostChargeUomSid:
                            (item.CostChargeUomSid! ? Number(item.CostChargeUomSid) : null) ||
                            (item.ChargeUomSid ? Number(item.ChargeUomSid) : null)!,
                        RevenueNumberOfUnit:
                            (item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null) ||
                            (item.NoOfUnit ? Number(item.NoOfUnit) : null)!,
                        CostNumberOfUnit:
                            (item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null) ||
                            (item.NoOfUnit ? Number(item.NoOfUnit) : null)!,

                        // Revenue Section
                        RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? Number(item.RevenueCurrencyMasterSid) : null,
                        RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                        RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                        RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                        RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                        RevenueDrCr: item.RevenueDrCr,
                        RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                        RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                        RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                        RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                        RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                        // Cost Section
                        CostCurrencyMasterSid: item.CostCurrencyMasterSid ? Number(item.CostCurrencyMasterSid) : null,
                        CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                        CostRate: item.CostRate ? Number(item.CostRate) : null,
                        CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                        CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                        CostDrCr: item.CostDrCr,
                        CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                        CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                        CostPrepaidCollect: item.CostPrepaidCollect,
                        CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                        PaymentRequestSid: item.PaymentRequestSid ? Number(item.PaymentRequestSid) : null,
                        CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                    }
                    updatedCharge = await this._db.costRevenueCharges.update({
                        where: {
                            CostRevenueChargesSid: item.RateSid
                        },
                        data: costRevenueChargesPayload
                    })
                } else {
                    // create
                    const costRevenueChargesPayload = {
                        TransactionSid: updatedHouseJob.HouseJobSid,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        ShipmentNo: updatedHouseJob.ShipmentNo,
                        MasterJobNo: updatedHouseJob.MBLNo,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,

                        SerialNumber: itemIndex++,
                        ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                        ChargeDescription: item.ChargeDescription,

                        ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                        RevenueChargeUomSid: Number(item.RevenueChargeUomSid),
                        CostChargeUomSid: Number(item.CostChargeUomSid),
                        RevenueNumberOfUnit: item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null,
                        CostNumberOfUnit: item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null,

                        // Revenue Section
                        RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? item.RevenueCurrencyMasterSid : null,
                        RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                        RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                        RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                        RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                        RevenueDrCr: item.RevenueDrCr,
                        RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                        RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                        RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                        RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                        RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                        // Cost Section
                        CostCurrencyMasterSid: item.CostCurrencyMasterSid ? item.CostCurrencyMasterSid : null,
                        CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                        CostRate: item.CostRate ? Number(item.CostRate) : null,
                        CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                        CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                        CostDrCr: item.CostDrCr,
                        CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                        CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                        CostPrepaidCollect: item.CostPrepaidCollect,
                        CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                        PaymentRequestSid: item.PaymentRequestSid ? Number(item.PaymentRequestSid) : null,
                        CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                        createdBy: payload.updatedBy,
                        status: "A",
                        Remarks: item.Remarks,
                        BookingRateSid : item.BookingRatesSid || null,
                        TariffDetailSid : item.TariffDetailSid || null
                    }

                    createdCharge = await this._db.costRevenueCharges.create({
                        data: costRevenueChargesPayload
                    })
                }
                finalCharges.push(createdCharge || updatedCharge);
            }
            const finalHouseJobBOE: any[] = [];
            const houseJobBOEPayload = payload.houseJobBOE || [];

            if (houseJobBOEPayload.length > 0) {
                for (const boe of houseJobBOEPayload) {
                    let createdBOE;
                    let updatedBOE;

                    if (boe.HouseJobBOESid) {
                        // Update existing BOE
                        updatedBOE = await this._db.houseJobBOE.update({
                            where: {
                                HouseJobBOESid: boe.HouseJobBOESid
                            },
                            data: {
                                Sno: boe.Sno || 1,
                                DeclarationNo: boe.DeclarationNo || '',
                                BOENo: boe.BOENo || '',
                                BOEDate: boe.BOEDate ? new Date(boe.BOEDate) : null,
                                BOEValue: boe.BOEValue ? Number(boe.BOEValue) : null,
                                BOEInvoiceValue: boe.BOEInvoiceValue ? Number(boe.BOEInvoiceValue) : null,
                                TransactionType: boe.TransactionType || '',
                                Amount: boe.Amount ? Number(boe.Amount) : null,
                                ProcessDate: boe.ProcessDate ? new Date(boe.ProcessDate) : null,
                                ReceivedDate: boe.ReceivedDate ? new Date(boe.ReceivedDate) : null,
                                AckNumber: boe.AckNumber || '',
                                AckDate: boe.AckDate ? new Date(boe.AckDate) : null,
                                AckStatus: boe.AckStatus || '',
                                Remarks: boe.Remarks || '',
                                UpdatedBy: payload.updatedBy || payload.createdBy || null,
                                Status: 'A'
                            }
                        });
                    } else {
                        // Create new BOE
                        createdBOE = await this._db.houseJobBOE.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                Sno: boe.Sno || 1,
                                DeclarationNo: boe.DeclarationNo || '',
                                BOENo: boe.BOENo || '',
                                BOEDate: boe.BOEDate ? new Date(boe.BOEDate) : null,
                                BOEValue: boe.BOEValue ? Number(boe.BOEValue) : null,
                                BOEInvoiceValue: boe.BOEInvoiceValue ? Number(boe.BOEInvoiceValue) : null,
                                TransactionType: boe.TransactionType || '',
                                Amount: boe.Amount ? Number(boe.Amount) : null,
                                ProcessDate: boe.ProcessDate ? new Date(boe.ProcessDate) : null,
                                ReceivedDate: boe.ReceivedDate ? new Date(boe.ReceivedDate) : null,
                                AckNumber: boe.AckNumber || '',
                                AckDate: boe.AckDate ? new Date(boe.AckDate) : null,
                                AckStatus: boe.AckStatus || '',
                                Remarks: boe.Remarks || '',
                                CreatedBy: payload.updatedBy || payload.createdBy || null,
                                Status: 'A'
                            }
                        });
                    }
                    finalHouseJobBOE.push(updatedBOE || createdBOE);
                }
            }


            let finalHouseJobVehicle: any[] = [];
            const houseJobVehiclePayload = payload.houseJobVehicle || [];

            if (houseJobVehiclePayload.length > 0) {
                for (const vehicle of houseJobVehiclePayload) {
                    let createdVehicle;
                    let updatedVehicle;

                    if (vehicle.HouseJobVehicleSid) {
                        // Update existing vehicle
                        updatedVehicle = await this._db.houseJobVehicle.update({
                            where: {
                                HouseJobVehicleSid: vehicle.HouseJobVehicleSid
                            },
                            data: {
                                VehicleIndicator: vehicle.VehicleIndicator,
                                UsedNew: vehicle.UsedNew,
                                ChassisNo: vehicle.ChassisNo,
                                CaseNo: vehicle.CaseNo,
                                Make: vehicle.Make,
                                Model: vehicle.Model,
                                EngineNo: vehicle.EngineNo,
                                YearBuilt: vehicle.YearBuilt,
                                Color: vehicle.Color,
                                Rolling: vehicle.Rolling,
                                GoodsDescription: vehicle.GoodsDescription,
                                Weight: vehicle.Weight ? Number(vehicle.Weight) : null,
                                Volume: vehicle.Volume ? Number(vehicle.Volume) : null,
                                Remarks: vehicle.Remarks,
                                UpdatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    } else {
                        // Create new vehicle
                        createdVehicle = await this._db.houseJobVehicle.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                VehicleIndicator: vehicle.VehicleIndicator,
                                UsedNew: vehicle.UsedNew,
                                ChassisNo: vehicle.ChassisNo,
                                CaseNo: vehicle.CaseNo,
                                Make: vehicle.Make,
                                Model: vehicle.Model,
                                EngineNo: vehicle.EngineNo,
                                YearBuilt: vehicle.YearBuilt,
                                Color: vehicle.Color,
                                Rolling: vehicle.Rolling,
                                GoodsDescription: vehicle.GoodsDescription,
                                Weight: vehicle.Weight ? Number(vehicle.Weight) : null,
                                Volume: vehicle.Volume ? Number(vehicle.Volume) : null,
                                Remarks: vehicle.Remarks,
                                CreatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    }
                    finalHouseJobVehicle.push(updatedVehicle || createdVehicle);
                }
            }
            let finalHouseJobCustoms: any[] = [];
            const houseJobCustomsPayload = payload.houseJobCustoms || [];

            if (houseJobCustomsPayload.length > 0) {
                for (const customs of houseJobCustomsPayload) {
                    let createdCustoms;
                    let updatedCustoms;

                    if (customs.HouseJobCustomsSid) {
                        // Update existing customs
                        updatedCustoms = await this._db.houseJobCustoms.update({
                            where: {
                                HouseJobCustomsSid: customs.HouseJobCustomsSid
                            },
                            data: {
                                LineCode: customs.LineCode,
                                VoyageAgentCode: customs.VoyageAgentCode,
                                RotationNumber: customs.RotationNumber,
                                ManifestSequence: customs.ManifestSequence,
                                CargoCode: customs.CargoCode,
                                StorageRequest: customs.StorageRequest,
                                PackageTypeCode: customs.PackageTypeCode,
                                FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                                NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                                SLACIndicator: customs.SLACIndicator,
                                ImporterCode: customs.ImporterCode,
                                SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                                UsedOrNew: customs.UsedOrNew,
                                UNHSCode: customs.UNHSCode,
                                UNNumber: customs.UNNumber,
                                FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                                TemperatureUnit: customs.TemperatureUnit,
                                HazStorageRequest: customs.HazStorageRequest,
                                RefrigerationRequired: customs.RefrigerationRequired,
                                MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                                MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                                RefTemperatureUnit: customs.RefTemperatureUnit,
                                UpdatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    } else {
                        // Create new customs
                        createdCustoms = await this._db.houseJobCustoms.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                LineCode: customs.LineCode,
                                VoyageAgentCode: customs.VoyageAgentCode,
                                RotationNumber: customs.RotationNumber,
                                ManifestSequence: customs.ManifestSequence,
                                CargoCode: customs.CargoCode,
                                StorageRequest: customs.StorageRequest,
                                PackageTypeCode: customs.PackageTypeCode,
                                FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                                NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                                SLACIndicator: customs.SLACIndicator,
                                ImporterCode: customs.ImporterCode,
                                SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                                UsedOrNew: customs.UsedOrNew,
                                UNHSCode: customs.UNHSCode,
                                UNNumber: customs.UNNumber,
                                FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                                TemperatureUnit: customs.TemperatureUnit,
                                HazStorageRequest: customs.HazStorageRequest,
                                RefrigerationRequired: customs.RefrigerationRequired,
                                MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                                MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                                RefTemperatureUnit: customs.RefTemperatureUnit,
                                CreatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    }
                    finalHouseJobCustoms.push(updatedCustoms || createdCustoms);
                }
            }

            const finalShipmentMilestones: any[] = [];
            const milestonePayload = payload.milestones || [];

            if (milestonePayload.length > 0) {
                for (const milestone of milestonePayload) {
                    let createdMilestone;
                    let updatedMilestone;
                    if (milestone.ShipmentMilestoneSid) {
                        // Update existing milestone
                        updatedMilestone = await this._db.shipmentMilestone.update({
                            where: {
                                ShipmentMilestoneSid: milestone.ShipmentMilestoneSid
                            },
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                ShipmentNo: updatedHouseJob.ShipmentNo!,
                                UpdatedBy: milestone.UpdatedBy || milestone.CreatedBy,
                                Status: String(milestone.Status).charAt(0),
                                MilestoneMasterSid: milestone.MilestoneMasterSid,
                                Remarks: milestone.Remarks,
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured,
                            }
                        });
                    } else {
                        // Create new milestone
                        createdMilestone = await this._db.shipmentMilestone.create({
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                ShipmentNo: updatedHouseJob.ShipmentNo!,
                                CompanyMasterSid: milestone.CompanyMasterSid,
                                BranchMasterSid: milestone.BranchMasterSid,
                                CreatedBy: milestone.UpdatedBy,
                                Status: "A",
                                MilestoneMasterSid: milestone.MilestoneMasterSid,
                                Remarks: milestone.Remarks,
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured,
                            }
                        });
                    }
                    finalShipmentMilestones.push(updatedMilestone || createdMilestone);
                }
            }

           




            return {
                houseJob: updatedHouseJob,
                houseJobCargo: [],
                houseJobProduct: [],
                houseConnections: finalHouseConnections,
                houseJobOthers: finalHouseJobOthers,
                houseJobProxy: finalHouseJobProxy,
                houseJobBOE: finalHouseJobBOE,
                houseJobVehicle: finalHouseJobVehicle,
                houseJobCustoms: finalHouseJobCustoms,
                bookingRates: finalCharges,
                costRevenueCharges: finalCharges,
                shipmentMilestones: finalShipmentMilestones
            };
        }
        catch (error) {
            throw error;
        }
    } 


    private readonly houseJobInclude = {
        Cargo: { where: { status: 'A' } },
        Products: { where: { status: 'A' } },
        Others: { where: { status: 'A' } },
        Connections: { where: { status: 'A' } },
        HouseJobProxy: { where: { Status: 'A' } }
    };

    private async enrichWithVoyageDetails(houseJob: any) {
        let voyageDetails;
        if (houseJob.VoyageMasterSid) {
            const data = await this._db.voyageMasterHeader.findUnique({
                where: {
                    VoyageMasterHeaderSid: houseJob.VoyageMasterSid
                },
                include: {
                    voyageMasterDetail: {
                        where: {
                            status: 'A'
                        },
                        select: {
                            ETA: true,
                            ETD: true,
                            PortCutoff: true,
                            portMasterPOL: {
                                select: {
                                    PortCode: true
                                }
                            }
                        },
                    }
                }
            })
            const POL = data?.voyageMasterDetail.find(vd => vd.portMasterPOL?.PortCode === houseJob.POL);
            const POD = data?.voyageMasterDetail.find(vd => vd.portMasterPOL?.PortCode === houseJob.POD);
            voyageDetails = {
                POLETA: POL?.ETA,
                POLETD: POL?.ETD,
                PODETA: POD?.ETA,
                PODETD: POD?.ETD,
                POLCutOffDate: POL?.PortCutoff,
                PODCutOffDate: POD?.PortCutoff
            }
        }
        return { ...houseJob, voyageDetails };
    }

    async getHouseJobByBookingNo(BookingNumber: string) {
        try {
            // 1. Try ShipmentNo match
            let ourBooking = await this._db.houseJob.findFirst({
                where: { ShipmentNo: BookingNumber, status: 'A' },
                include: this.houseJobInclude
            });

            if (ourBooking) {
                const enriched = await this.enrichWithVoyageDetails(ourBooking);
                return { data: enriched, multiple: false };
            }

            // 2. Try HBLNo match
            ourBooking = await this._db.houseJob.findFirst({
                where: { HBLNo: BookingNumber, status: 'A' },
                include: this.houseJobInclude
            });

            if (ourBooking) {
                const enriched = await this.enrichWithVoyageDetails(ourBooking);
                return { data: enriched, multiple: false };
            }

            // 3. Try MBLNo on MasterJob — return all associated HouseJobs
            const masterJob = await this._db.masterJob.findFirst({
                where: { MBLNo: BookingNumber, Status: 'A' }
            });

            if (masterJob) {
                const houseJobs = await this._db.houseJob.findMany({
                    where: { MasterJobSid: masterJob.MasterJobSid, status: 'A' },
                    include: this.houseJobInclude
                });

                if (houseJobs.length === 0) {
                    throw new BadRequestException('No house jobs found for this MBL number.');
                }

                const enrichedJobs = await Promise.all(
                    houseJobs.map(hj => this.enrichWithVoyageDetails(hj))
                );

                if (enrichedJobs.length === 1) {
                    return { data: enrichedJobs[0], multiple: false };
                }

                return { data: enrichedJobs, multiple: true };
            }

            throw new BadRequestException('No record found for the given Shipment No / HBL No / MBL No.');
        } catch (error) {
            throw error;
        }
    }

    async getMasterJobContainersByMasterJobSid(
        MasterJobSid: number,
        ContainerType?: number
    ) {
        const hasContainerTypeFilter =
            typeof ContainerType === 'number' && !Number.isNaN(ContainerType);

        try {
            const containers = await this._db.masterJobContainer.findMany({
                where: {
                    MasterJobSid: MasterJobSid,
                    Status: 'A',
                    ...(hasContainerTypeFilter ? { ContainerType: ContainerType } : {})
                },
                include: {
                    houseJobProduct: true
                }
            });

            const result = containers.map((c: any) => {
                const products = c.houseJobProduct || [];

                const NoOfPkg = products.reduce(
                    (sum: number, p: any) => sum + Number(p.ExternlQty || 0),
                    0
                );

                const GrossWeight = products.reduce(
                    (sum: number, p: any) => sum + Number(p.GrossWeight || 0),
                    0
                );

                const NetWeight = products.reduce(
                    (sum: number, p: any) => sum + Number(p.NetWeight || 0),
                    0
                );

                const Volume = products.reduce(
                    (sum: number, p: any) => sum + Number(p.Volume || 0),
                    0
                );

                return {
                    ...c,
                    NoOfPkg,
                    GrossWeight,
                    NetWeight,
                    Volume
                };
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    async updateHBLCount(payload: {
        CompanyMasterSid: number,
        BranchMasterSid: number,
        HouseJobSid: number,
    }) {
        try {
            const ourHouse = await this._db.houseJob.update({
                where: {
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    HouseJobSid: payload.HouseJobSid,
                    status: 'A'
                },
                data: {
                    HBLCount: {
                        increment: 1
                    }
                }
            })
            return ourHouse;
        } catch (error) {
            throw error;
        }
    }

    async getHouseJobARAPData(HouseJobSid: number): Promise<any> {
        try {
            // Using Prisma view instead of raw query
            const arapData = await this._db.vHouseARAP.findMany({
                where: {
                    HouseJobSid: HouseJobSid
                },
                orderBy: {
                    VoucherDate: 'desc'
                }
            });

            return arapData;
        } catch (error) {
            this.logger.error(`Error fetching AR/AP data: ${error.message}`);
            throw error;
        }
    }
    async softDeleteHouseJobProduct(HouseJobProductSid: number,updateBy: string) {
        try {
            const deletedHouseJobProduct = await this._db.houseJobProduct.update({
                where: {
                    HouseJobProductSid: HouseJobProductSid
                },
                data: { status: 'D' , updatedBy: updateBy, updatedOn: new Date() }
            })
            return deletedHouseJobProduct;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteHouseJobConnection(HouseJobConnectionSid: number, updatedBy: string) {
        try {
            return this._db.houseJobConnection.update({
                where: {
                    HouseJobConnectionSid: HouseJobConnectionSid
                },
                data: {
                    status: "D",
                    updatedBy: updatedBy, 
                    updatedOn: new Date()
                }
            })
        } catch (error) {
            throw error;
        }
    }


    async searchHouseJob(params: searchHouseJob) {
        const {
            search = '',
            page = 1,
            pageSize = 15,
            activeCompanyId,
            activeBranchId,
            departmentType,
            dateFrom,
            dateTo,
            dateField,
            partyType,
            partyId,
            partyName,
        } = params;

        const skip = (page - 1) * pageSize;
        const dateFromRaw = dateFrom ?? (params as any).DateFrom ?? (params as any).dateFrom;
        const dateToRaw = dateTo ?? (params as any).DateTo ?? (params as any).dateTo;
        const dateFieldRaw = dateField ?? (params as any).DateField ?? (params as any).dateField ?? 'HBLDate';
        const allowedDateFields = new Set(['BookingDateTime', 'ETD', 'ETA', 'HBLDate', 'MBLDate']);
        const normalizedDateField = allowedDateFields.has(dateFieldRaw) ? dateFieldRaw : 'HBLDate';
        const customerMasterSid = (params as any).CustomerMasterSid ?? (params as any).customerMasterSid ?? null;
        const departmentMasterSid = (params as any).DepartmentMasterSid ?? (params as any).departmentMasterSid ?? null;
        const pol = (params as any).POL ?? (params as any).pol ?? null;
        const pod = (params as any).POD ?? (params as any).pod ?? null;
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

        const where: Prisma.HouseJobWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            IsServiceJob : { not : 'Y' },
            JobType: { not: 'Agent' },
            ...(customerMasterSid ? { CustomerMasterSid: Number(customerMasterSid) } : {}),
            ...(departmentMasterSid ? { DepartmentMasterSid: Number(departmentMasterSid) } : {}),
            ...(pol ? { POL: String(pol) } : {}),
            ...(pod ? { POD: String(pod) } : {}),
            ...(Object.keys(dateRange).length ? { [normalizedDateField]: dateRange } : {}),

            // ✅ Correct department filter
            ...(departmentType
                ? {
                    departmentMaster: {
                        departmentType: {
                            in: Array.isArray(departmentType)
                                ? departmentType.map((d: string) => d.toUpperCase())
                                : [departmentType.toUpperCase()],
                            mode: 'insensitive',
                        },
                    },
                }
                : {}),

            ...(search
                ? {
                    OR: [
                        { masterJob:{MasterJobNumber : { contains: search, mode:'insensitive'}}},
                        { HBLNo: { contains: search, mode: 'insensitive' } },
                        { BookingNo: { contains: search, mode: 'insensitive' } },
                        { departmentMaster: {departmentName: { contains: search, mode: 'insensitive'}}},
                        { POL: { contains: search, mode: 'insensitive' } },
                        { POD: { contains: search, mode: 'insensitive' } },
                        { HouseStatus: { contains: search, mode: 'insensitive'}}
                    ],
                }
                : {}),
        };

        // Date range filter
        // Date range filter moved to normalizedDateField above for consistent payload handling.

        // Party filter
        if (partyType === 'CustomerMasterSid' && partyId) {
            where.CustomerMasterSid = partyId;
        } else if (partyType === 'ShipperName' && partyName) {
            where.ShipperName = { contains: partyName, mode: 'insensitive' };
        } else if (partyType === 'ConsigneeName' && partyName) {
            where.ConsigneeName = { contains: partyName, mode: 'insensitive' };
        }

        const [items, totalCount] = await this._db.$transaction([
            this._db.houseJob.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { HBLDate: 'desc' },
                include: {
                    departmentMaster: {
                        select: { departmentType: true, departmentName: true },
                    },
                    masterJob: {
                        select: {
                            MasterJobNumber: true,
                        }
                    }
                },
            }),
            this._db.houseJob.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }


    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            let conditions: any[] = [];

            // HEADER LOG
            if (tableName === 'HouseJob' && recordId) {
                const houseJobSid = Number(recordId);

                const [
                    cargo,
                    product,
                    connection,
                    others,
                    boe,
                    vehicle,
                    customs
                ] = await Promise.all([
                    this._db.houseJobCargo.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobCargoSid: true }
                    }),
                    this._db.houseJobProduct.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobProductSid: true }
                    }),
                    this._db.houseJobConnection.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobConnectionSid: true }
                    }),
                    this._db.houseJobOthers.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobOthersSid: true }
                    }),
                    this._db.houseJobBOE.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobBOESid: true }
                    }),
                    this._db.houseJobVehicle.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobVehicleSid: true }
                    }),
                    this._db.houseJobCustoms.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobCustomsSid: true }
                    })
                ]);

                conditions = [
                    { tableName: 'HouseJob', recordId: recordId },
                    { tableName: 'HouseJobCargo', recordId: { in: cargo.map(x => x.HouseJobCargoSid.toString()) } },
                    { tableName: 'HouseJobProduct', recordId: { in: product.map(x => x.HouseJobProductSid.toString()) } },
                    { tableName: 'HouseJobConnection', recordId: { in: connection.map(x => x.HouseJobConnectionSid.toString()) } },
                    { tableName: 'HouseJobOthers', recordId: { in: others.map(x => x.HouseJobOthersSid.toString()) } },
                    { tableName: 'HouseJobBOE', recordId: { in: boe.map(x => x.HouseJobBOESid.toString()) } },
                    { tableName: 'HouseJobVehicle', recordId: { in: vehicle.map(x => x.HouseJobVehicleSid.toString()) } },
                    { tableName: 'HouseJobCustoms', recordId: { in: customs.map(x => x.HouseJobCustomsSid.toString()) } }
                ];
            } else {
                conditions = [{
                    tableName,
                    ...(recordId && { recordId })
                }];
            }

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: { changedAt: 'desc' },
            });

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }
private async recalculateMasterJobTotals(
  prisma: any,
  masterJobSid: number
) {
  if (!masterJobSid) return;

  const houseJobs = await prisma.houseJob.findMany({
    where: {
      MasterJobSid: masterJobSid,
      status: 'A'
    },
    include: {
      Cargo: {
        where: { status: 'A' }
      }
    }
  });

  let totals = {
    NoOfPkg: 0,
    GrossWeight: 0,
    NetWeight: 0,
    ChargeableWeight: 0,
    Volume: 0
  };

  for (const hj of houseJobs) {
    for (const cargo of hj.Cargo || []) {
      totals.NoOfPkg += Number(cargo.NoOfPackage) || 0;
      totals.GrossWeight += Number(cargo.GrossWeight) || 0;
      totals.NetWeight += Number(cargo.NetWeight) || 0;
      totals.ChargeableWeight += Number(cargo.ChargeableWeight) || 0;
      totals.Volume += Number(cargo.Volume) || 0;
    }
  }

  await prisma.masterJob.update({
    where: { MasterJobSid: masterJobSid },
    data: {
      NoOfPkg: totals.NoOfPkg,
      GrossWeight: Number(totals.GrossWeight.toFixed(3)),
      NetWeight: Number(totals.NetWeight.toFixed(3)),
      ChargeableWeight: Number(totals.ChargeableWeight.toFixed(3)),
      Volume: Number(totals.Volume.toFixed(3)),
      UpdatedOn: new Date()
    }
  });
}

}




