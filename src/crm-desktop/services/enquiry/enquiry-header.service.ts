import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApprovalStatus, LeadStatus, Prisma } from '@prisma/client';
import { contains } from 'class-validator';
import * as moment from 'moment-timezone';
import { parseDateFromString, statusWhereClause, toYesNoFlag } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { MenuUserConfigService } from 'src/settings/services/menu-user-config/menu-user-config.service';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';

@Injectable()
export class EnquiryHeaderService {
    constructor(
        private _db: DatabaseService, 
        private logger: Logger,
        private numberSeriesService: NumberSeriesService,
        private menuUserConfigService: MenuUserConfigService
    ) { }

    /**
     * Department-scoped authorizer lookup for a menu. Authority rules store department NAMES in an
     * array (matched with `has`); when no rule covers the department there are no authorizers, so
     * the document needs no approval. Returns both the count and the resolved department name so
     * callers can reuse the name for the authorizer lookup.
     */
    private async resolveDepartmentAuthorizers(
        companyMasterSid: number,
        branchMasterSid: number,
        menuMasterSid: number,
        departmentMasterSid?: number | null,
    ): Promise<{ count: number; departmentName: string | null }> {
        let departmentName: string | null = null;
        if (departmentMasterSid && Number.isFinite(Number(departmentMasterSid))) {
            const dept = await this._db.departmentMaster.findFirst({
                where: {
                    DepartmentMasterSid: Number(departmentMasterSid),
                    CompanyMasterSid: companyMasterSid,
                    Status: 'A',
                },
                select: { departmentName: true },
            });
            departmentName = dept?.departmentName || null;
        }

        const count = await this._db.authorityDetail.count({
            where: {
                status: 'A',
                CompanyMasterSid: companyMasterSid,
                BranchMasterSid: branchMasterSid,
                authorityMaster: {
                    status: 'A',
                    MenuMaster: menuMasterSid,
                    CompanyMasterSid: companyMasterSid,
                    BranchMasterSid: branchMasterSid,
                    ...(departmentName ? { DepartmentMaster: { has: departmentName } } : {}),
                },
            },
        });

        return { count, departmentName };
    }

    async createEnquiry(payload) {
        try {
            return await this._db.$transaction(async (prisma) => {
            const DepartmentMasterSid = Number(payload.DepartmentMasterSid);

            // Get MenuMasterSid for Enquiry (look up by code or use provided value)
            let MenuMasterSid = Number(payload.MenuMasterSid);
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

                if(!enquiryMenu){
                    throw new BadRequestException('No enquiry menu found');
                }

                MenuMasterSid = enquiryMenu?.MenuMasterSid;
            }

            // Generate enquiry number using NumberSeriesService
            let enquiryNumber: string | null = null;
            if (MenuMasterSid) {
                try {
                    enquiryNumber = await this.numberSeriesService.generateNextNumber(
                        payload.CompanyMasterSid,
                        payload.BranchMasterSid,
                        MenuMasterSid,
                        DepartmentMasterSid,
                        payload.EnquiryDate ? new Date(payload.EnquiryDate) : undefined,
                        undefined,
                        undefined,
                        prisma,
                    );
                } catch (err) {
                    throw err;
                }
            }

            const resourcePerson =
        (await this.menuUserConfigService.getConfiguredUser(
          payload.CompanyMasterSid,
          payload.BranchMasterSid,
          MenuMasterSid,
        ));

                // Server-authoritative approval state: a new enquiry cannot be pre-approved by the
                // client. When its department has an active authority rule it starts Pending;
                // otherwise there is nobody to approve, so it is Approved (normal flow).
                const { count: authorizerCount } = await this.resolveDepartmentAuthorizers(
                    payload.CompanyMasterSid,
                    payload.BranchMasterSid,
                    MenuMasterSid,
                    DepartmentMasterSid,
                );
                const resolvedAuthorizerStatus = authorizerCount > 0 ? 'Pending' : 'Approved';

                // Step 1: Create Enquiry Header
                const enquiryHeaderPayload: any = {
                    LeadOrCustomer: payload.LeadOrCustomer,
                    PreCustomerMasterSid: payload.PreCustomerMasterSid ? Number(payload.PreCustomerMasterSid) : null,
                    FreightPPCC: payload.FreightPPCC,
                    CustomerName: payload.CustomerName,
                    DepartmentMasterSid: payload.DepartmentMasterSid ? Number(payload.DepartmentMasterSid) : null,
                    CustomerMasterSid : payload.CustomerMasterSid ? Number(payload.CustomerMasterSid) : null,
                    CustomerBranchSid:payload.CustomerBranchSid?  Number(payload.CustomerBranchSid):null,
                    CustomerAddressSid: payload.CustomerAddressSid?  Number(payload.CustomerAddressSid):null,
                    ShipmentExpectedDate: payload.shipmentDate,
                    ShipmentType: payload.Segment,
                    CustomerAddress: payload.CustomerAddress,
                    Email: payload.Email,
                    EnquiryType: payload.EnquiryType,
                    IncoTerms: payload.IncoTerms,
                    ClearanceBy: payload.ClearanceBy,
                    TransportBy: payload.TransportBy,
                    Remarks: payload.Remarks,
                    status: String(payload.status).charAt(0) || "A",
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    UserMasterSid: payload.UserMasterSid,
                    createdBy: payload.createdBy,
                    CustomerRef:payload.CustomerRef,
                    MenuMasterSid: Number(payload.MenuMasterSid),
                    ContactPerson:payload.ContactPerson,
                    ContactNumber:payload.ContactNumber,
                    EnquiryNumber: enquiryNumber,
                    EnquiryDate: payload.EnquiryDate,
                    authorizerStatus: resolvedAuthorizerStatus
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
                                createdBy: payload.createdBy
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
                        EnquiryRouteSid: enquiryRoute.EnquiryRouteSid,

                        CargoType: cargo.CargoType,                     // LCL , FCL , AIR
                        ProductName: cargo.ProductName,                 // LCL , FCL , AIR
                        CargoDescription: cargo.CargoDescription,      // LCL , FCL , AIR
                        PackageType: cargo.PackageType,
                        PackageQty: Number(cargo.PackageQty),
                        Qty: Number(cargo.Qty) || 0,                     // LCL , FCL
                        WeightUnitSid: cargo.WeightUnitSid,            // LCL , FCL
                        GrossWeight: parseFloat(cargo.GrossWeight) || null,    // LCL , FCL
                        NetWeight: parseFloat(cargo.NetWeight),            // LCL , FCL
                        ShipmentTerms: cargo.ShipmentTerms,            // LCL , FCL
                        Volume: parseFloat(cargo.cbm),                      // LCL
                        ContainerType: cargo.ContainerType,             // FCL , AIR
                        ChargeableWeight: parseFloat(cargo.ChargeableWeight),      // AIR
                        Volumetric: parseFloat(cargo.volumetric),
                        length: Number(cargo.length),
                        width: Number(cargo.width),
                        height: Number(cargo.height),
                        IsStackable: toYesNoFlag(cargo.IsStackable),
                        createdBy: payload.createdBy
                    }))
                );

                // Step 4: Bulk Insert Cargo Data
                const enquiryCargos = await prisma.enquiryCargo.createMany({
                    data: enquiryCargoPayload
                });

                // Step 5 : Create Enquiry Others
                const enquiryOther = payload.enquiryOther;
                const enquiryOtherPayload = await prisma.enquiryOther.create({
                    data: {
                        EnquiryHeaderSid: enquiryHeader.EnquiryHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        ShipperName: enquiryOther.ShipperName,
                        ShipperAddress: enquiryOther.ShipperAddress,
                        ConsigneeName: enquiryOther.ConsigneeName,
                        ConsigneeAddress: enquiryOther.ConsigneeAddress,
                        FreightTerms: enquiryOther.FreightTerms,
                        AdditionalService: enquiryOther.AdditionalService,
                        PickupAddress: enquiryOther.PickupAddress,
                        CreatedBy: payload.createdBy,
                        ResourcePerson: resourcePerson,
                    }
                })
                if (enquiryHeader && payload.LeadOrCustomer === "L") {
                    await this._db.preCustomerMaster.update({
                        where: {
                            PreCustomerMasterSid: payload.PreCustomerMasterSid
                        }, data: {
                            leadStatus: LeadStatus.EnquiryGenerated,
                            updatedBy: payload.createdBy,
                            updatedOn: new Date()
                        }
                    })
                }

                // Return Success Response
                return {
                    message: 'Enquiry created successfully',
                    data: {
                        enquiryHeader,
                        enquiryRoutes,
                        enquiryCargos,
                        enquiryOtherPayload
                    }
                };
            });
        } catch (error) {
            if (error instanceof HttpException) {
                    throw error;
            }
            throw new Error(`Transaction failed: ${error.stack}`);
        }
    }



    async getAllEnquiries(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const enquiries = await this._db.enquiryHeader.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                include: {
                    enquiryRoute: {
                        include: {
                            enquiryCargo: { orderBy: { EnquiryCargoSid: 'asc' } }
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


    async findOne(EnquiryHeaderSid:number,CompanyMasterSid:number,BranchMasterSid:number) {
        try {
            const enquiry = await this._db.enquiryHeader.findUnique({
                where: {
                    EnquiryHeaderSid: EnquiryHeaderSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                include: {
                    enquiryRoute: {
                        where: {
                            status: 'A'
                        },
                        include: {
                            enquiryCargo: {
                                where: { status: 'A' },
                                // Without this the rows come back in no guaranteed order, so a
                                // multi-cargo enquiry would reshuffle on every reopen.
                                orderBy: { EnquiryCargoSid: 'asc' }
                            },

                        }
                    },
                    enquiryOther: true
                }
            });
            if (!enquiry) {
                throw new UnauthorizedException('Access denied.');
            }
            return enquiry;
        } catch (error) {
            throw error;
        }
    }


    async updateEnquiry(enquiryHeaderSid: number, payload) {
        try {
            // Step 1: Update Enquiry Header
            const statusUpdate = payload.status === "A" ? "A" : "S";

            const menuMasterSid = Number(payload.MenuMasterSid) || Number(payload.MenuMaster);
            const departmentMasterSid = payload.DepartmentMasterSid ? Number(payload.DepartmentMasterSid) : null;

            // Server-authoritative approval state (department-scoped) — the client cannot
            // self-approve. If the department has no authority rule the enquiry is Approved;
            // otherwise its stored status is preserved and only a legitimate Final-authorizer
            // approval (or any rejection) recorded below is allowed to change it.
            const { count: authorizerCount, departmentName } = await this.resolveDepartmentAuthorizers(
                payload.CompanyMasterSid,
                payload.BranchMasterSid,
                menuMasterSid,
                departmentMasterSid,
            );
            const existingEnquiry = await this._db.enquiryHeader.findUnique({
                where: { EnquiryHeaderSid: enquiryHeaderSid },
                select: { authorizerStatus: true },
            });
            let resolvedAuthorizerStatus: any =
                authorizerCount === 0 ? 'Approved' : (existingEnquiry?.authorizerStatus ?? 'Pending');

            let authLogUpdate;

            if (authorizerCount > 0 && payload.approvalStatusChange && payload.authorizerStatus !== "Pending") {

                // The approver is the current logged-in user (ApproverUserMasterSid), not the
                // enquiry's salesman (payload.UserMasterSid, which can be null).
                const approverUserMasterSid = Number(payload.ApproverUserMasterSid) || null;
                if (!approverUserMasterSid) {
                    throw new BadRequestException('Cannot record approval: the acting user could not be identified.');
                }

                const authorityDetail = await this._db.authorityDetail.findFirst({
                    where: {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        UserMasterSid: approverUserMasterSid,
                        status: 'A',
                        authorityMaster: {
                            MenuMaster: menuMasterSid,
                            status: 'A',
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            ...(departmentName ? { DepartmentMaster: { has: departmentName } } : {}),
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
                        DocumentSid: enquiryHeaderSid,
                        AuthorityDetailSid: authorityDetail.AuthorityDetailSid,
                        ApprovalStatus: payload.authorizerStatus,
                        AuthorisedDate: new Date(),
                        Remarks: payload.AuthorizerRemarks,
                    },
                });

                // Only a Final authorizer's approval (or any rejection) flips the enquiry's status.
                if (authorityDetail.FinalAuthority === 'Y' || payload.authorizerStatus === "Rejected") {
                    resolvedAuthorizerStatus = payload.authorizerStatus;
                }
            }
            const updatedEnquiryHeader = await this._db.enquiryHeader.update({
                where: { EnquiryHeaderSid: enquiryHeaderSid },
                data: {
                    EnquiryDate : payload.EnquiryDate,
                    CustomerName: payload.CustomerName,
                    FreightPPCC: payload.FreightPPCC,
                    ShipmentExpectedDate: payload.shipmentDate,
                    ShipmentType: payload.Segment,
                    CustomerAddress: payload.CustomerAddress,
                    Email: payload.Email,
                    EnquiryType: payload.EnquiryType,
                    IncoTerms: payload.IncoTerms,
                    ClearanceBy: payload.ClearanceBy,
                    TransportBy: payload.TransportBy,
                    Remarks: payload.Remarks,
                    CustomerRef:payload.CustomerRef,
                    MenuMasterSid: Number(payload.MenuMasterSid),
                    UserMasterSid : payload.UserMasterSid,
                    authorizerStatus : resolvedAuthorizerStatus,
                    AuthorizerRemarks: payload.AuthorizerRemarks,
                    status: statusUpdate,
                    updatedBy: payload.updatedBy,
                    updatedOn: new Date(),
                     ContactPerson:payload.ContactPerson,
                    ContactNumber:payload.ContactNumber,
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
                            updatedBy: payload.updatedBy,
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

                        if (cargoItem.EnquiryCargoSid) {
                            updateCargoData = await this._db.enquiryCargo.update({
                                where: { EnquiryCargoSid: cargoItem.EnquiryCargoSid },
                                data: {
                                    CargoType: cargoItem.CargoType,
                                    ProductName: cargoItem.ProductName,
                                    CargoDescription: cargoItem.CargoDescription,
                                    PackageType: cargoItem.PackageType,
                                    PackageQty: Number(cargoItem.PackageQty),
                                    Qty: Number(cargoItem.Qty) || 0,
                                    WeightUnitSid: cargoItem.WeightUnitSid,
                                    GrossWeight: parseFloat(cargoItem.GrossWeight) || 0,
                                    NetWeight: parseFloat(cargoItem.NetWeight),
                                    ShipmentTerms: cargoItem.ShipmentTerms,
                                    Volume: parseFloat(cargoItem.cbm),
                                    ChargeableWeight: cargoItem.ChargeableWeight,
                                    Volumetric: parseFloat(cargoItem.volumetric),
                                    ContainerType: cargoItem.ContainerType,
                                    length: Number(cargoItem.length),
                                    width: Number(cargoItem.width),
                                    height: Number(cargoItem.height),
                                    IsStackable: toYesNoFlag(cargoItem.IsStackable),
                                    updatedBy: payload.updatedBy,
                                    updatedOn: new Date(),
                                }
                            });
                        } else {
                            createCargoData = await this._db.enquiryCargo.create({
                                data: {
                                    CargoType: cargoItem.CargoType,
                                    ProductName: cargoItem.ProductName,
                                    CargoDescription: cargoItem.CargoDescription,
                                    PackageType: cargoItem.PackageType,
                                    PackageQty: Number(cargoItem.PackageQty) ,
                                    Qty: Number(cargoItem.Qty) || 0,
                                    WeightUnitSid: cargoItem.WeightUnitSid,
                                    GrossWeight: parseFloat(cargoItem.GrossWeight) || 0,
                                    NetWeight: parseFloat(cargoItem.NetWeight),
                                    ShipmentTerms: cargoItem.ShipmentTerms,
                                    Volume: parseFloat(cargoItem.cbm),
                                    ContainerType: cargoItem.ContainerType,
                                    ChargeableWeight: cargoItem.ChargeableWeight,
                                    Volumetric: parseFloat(cargoItem.volumetric),
                                    length: Number(cargoItem.length),
                                    width: Number(cargoItem.width),
                                    height: Number(cargoItem.height),
                                    IsStackable: toYesNoFlag(cargoItem.IsStackable),
                                    EnquiryHeaderSid: enquiryHeaderSid,
                                    EnquiryRouteSid: routeData.EnquiryRouteSid, // Link to the correct route
                                    createdBy: payload.updatedBy,
                                    CompanyMasterSid: updatedEnquiryHeader.CompanyMasterSid,
                                    BranchMasterSid: updatedEnquiryHeader.BranchMasterSid,
                                }
                            });
                        }

                        finalCargoData.push(updateCargoData || createCargoData);
                    }
                }
            }

            let finalOtherData;
            const enquiryOther = payload.enquiryOther;
            if (enquiryOther?.EnquiryOtherSid) {
                finalOtherData = await this._db.enquiryOther.update({
                    where: {
                        EnquiryOtherSid: enquiryOther?.EnquiryOtherSid,
                        Status: 'A'
                    },
                    data: {
                        EnquiryHeaderSid: updatedEnquiryHeader.EnquiryHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        ShipperName: enquiryOther.ShipperName,
                        ShipperAddress: enquiryOther.ShipperAddress,
                        ConsigneeName: enquiryOther.ConsigneeName,
                        ConsigneeAddress: enquiryOther.ConsigneeAddress,
                        FreightTerms: enquiryOther.FreightTerms,
                        AdditionalService: enquiryOther.AdditionalService,
                        PickupAddress: enquiryOther.PickupAddress,
                        UpdatedBy: payload.updatedBy,
                        UpdatedOn: new Date(),
                    }
                })
            } else {
                finalOtherData = await this._db.enquiryOther.create({
                    data: {
                        EnquiryHeaderSid: updatedEnquiryHeader.EnquiryHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        ShipperName: enquiryOther.ShipperName,
                        ShipperAddress: enquiryOther.ShipperAddress,
                        ConsigneeName: enquiryOther.ConsigneeName,
                        ConsigneeAddress: enquiryOther.ConsigneeAddress,
                        FreightTerms: enquiryOther.FreightTerms,
                        AdditionalService: enquiryOther.AdditionalService,
                        PickupAddress: enquiryOther.PickupAddress,
                        CreatedBy: payload.updatedBy,
                    }
                })
            }

            return {
                status: true,
                message: 'Enquiry updated successfully',
                data: {
                    updatedEnquiryHeader: updatedEnquiryHeader,
                    finalRouteData: finalRouteData, // Now an array
                    finalCargoData: finalCargoData,  // Now an array
                    finalOtherData: finalOtherData,
                    authLogUpdate
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

        if (existingEnquiry.status === 'D') {
            throw new Error(`Enquiry with ID ${id} is already deleted`);
        }
        const deletedEnquiry = await this._db.enquiryHeader.update({
            where: { EnquiryHeaderSid: id },
            data: { status: 'D' }
        })

        const deletedRoutes = await this._db.enquiryRoute.updateMany({
            where: { EnquiryHeaderSid: id, status: 'D' },
            data: { status: 'D' }
        })

        const deletedCargos = await this._db.enquiryCargo.updateMany({
            where: { EnquiryHeaderSid: id, status: 'D' },
            data: { status: 'D' }
        })

        const deletedOthers = await this._db.enquiryOther.updateMany({
            where: { EnquiryHeaderSid: id, Status: 'A' },
            data: { Status: 'S' }
        })


        // Perform soft delete by updating deletedAt field
        return {
            deletedEnquiry,
            deletedRoutes,
            deletedCargos,
            deletedOthers
        }
    }

    async getAllDepartment(CompanyMasterSid: number) {
        try {
            const customer = await this._db.departmentMaster.findMany({
                where: {
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            });
            return customer;
        } catch (error) {
            throw error
        }
    }


    async getAllCargoTypes(CompanyMasterSid: number) {

        try {
            const customer = await this._db.packageTypeMaster.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid

                }
            });
            return customer;
        } catch (error) {
            throw error
        }
    }


    async getAllContainerTypes() {
        try {
            const container = await this._db.containerTypeMaster.findMany({});
            return container;
        } catch (error) {
            throw error
        }
    }


    async searchEnquiry(params: filterDto) {
        const {
            search = '',
            page = 1,
            pageSize = 10,
            activeCompanyId,
            activeBranchId,
            CustomerMasterSid,
            customerMasterSid,
            DepartmentMasterSid,
            departmentMasterSid,
            POLSid,
            polSid,
            PODSid,
            podSid,
            POL,
            pol,
            POD,
            pod
        } = params;
        const skip = (page - 1) * pageSize;
        const parsedDate = parseDateFromString(search);
        console.log(parsedDate);
        const ports = await this._db.portMaster.findMany({
              where: {
    status: 'A',
    OR: [
      { PortCode: { contains: search, mode: 'insensitive' } },
      { PortName: { contains: search, mode: 'insensitive' } }
    ]
  },
            select: {
                PortMasterSid: true,
            }
        });

        const portWithSearchOnlyIds = ports.map(p => p.PortMasterSid);
        const normalizedCustomerSid = Number(CustomerMasterSid ?? customerMasterSid ?? 0) || null;
        const normalizedDepartmentSid = Number(DepartmentMasterSid ?? departmentMasterSid ?? 0) || null;
        const normalizedPolSid = Number(POLSid ?? polSid ?? 0) || null;
        const normalizedPodSid = Number(PODSid ?? podSid ?? 0) || null;
        const normalizedPolCode = (POL ?? pol ?? '').toString().trim();
        const normalizedPodCode = (POD ?? pod ?? '').toString().trim();

        const where: Prisma.EnquiryHeaderWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(normalizedCustomerSid && { CustomerMasterSid: normalizedCustomerSid }),
            ...(normalizedDepartmentSid && { DepartmentMasterSid: normalizedDepartmentSid }),
            ...((normalizedPolSid || normalizedPodSid) && {
                enquiryRoute: {
                    some: {
                        ...(normalizedPolSid && { POLSid: normalizedPolSid }),
                        ...(normalizedPodSid && { PODSid: normalizedPodSid })
                    }
                }
            }),
            ...(search ?
                {
                    OR: [
                        { EnquiryNumber: { contains: search, mode: 'insensitive' } },
                        { quoteHeader: { is: { QuoteNumber: { contains: search, mode: 'insensitive' } } } },
                        { CustomerName: { contains: search, mode: 'insensitive' } },
                        { ShipmentType: { contains: search, mode: 'insensitive' } },
                        { enquiryRoute :{ some : { POLSid : { in : portWithSearchOnlyIds } } } },
                        { enquiryRoute :{ some : { PODSid : { in : portWithSearchOnlyIds } } } },
                        { status: { contains: search, mode: 'insensitive' } },
                        ...(parsedDate
                            ? [{ ShipmentExpectedDate: { equals: parsedDate } }]
                            : []),
                    ],
                } : {}
            )
        }

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.enquiryHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [
                    { EnquiryDate: 'desc' },
                ],
                include: {
                    enquiryRoute: {
                        select: {
                            POLSid: true,
                            PODSid: true,
                        }
                    },
                    quoteHeader : {
                        select : {
                            QuoteHeaderSid : true,
                            QuoteNumber : true
                        }
                    }
                }
            }),
            this._db.enquiryHeader.count({ where }),
        ]);

        items = await Promise.all(
            items.map(async (item) => {
                const pol = await this._db.portMaster.findFirst({
                    where: {
                        PortMasterSid: item.enquiryRoute[0]?.POLSid
                    }
                })
                const pod = await this._db.portMaster.findFirst({
                    where: {
                        PortMasterSid: item.enquiryRoute[0]?.PODSid
                    }
                })
                return {
                    ...item,
                    POL: pol,
                    POD: pod
                }
            })
        )

        return {
            items,
            totalCount,
        };
    }

    async searchPendingEnquiry(params: filterDto) {
        const {
            search = '',
            page = 1,
            pageSize = 10,
            activeCompanyId,
            activeBranchId,
            CustomerMasterSid,
            customerMasterSid,
            DepartmentMasterSid,
            departmentMasterSid,
            POLSid,
            polSid,
            PODSid,
            podSid,
            POL,
            pol,
            POD,
            pod,
            dateFrom,
            DateFrom,
            dateTo,
            DateTo,
            dateField,
            DateField
        } = params;
        const skip = (page - 1) * pageSize;
        const parsedDate = parseDateFromString(search);
        const normalizedCustomerSid = Number(CustomerMasterSid ?? customerMasterSid ?? 0) || null;
        const normalizedDepartmentSid = Number(DepartmentMasterSid ?? departmentMasterSid ?? 0) || null;
        const normalizedPolSid = Number(POLSid ?? polSid ?? 0) || null;
        const normalizedPodSid = Number(PODSid ?? podSid ?? 0) || null;
        const normalizedPolCode = (POL ?? pol ?? '').toString().trim();
        const normalizedPodCode = (POD ?? pod ?? '').toString().trim();
        const normalizedDateField = (dateField ?? DateField ?? 'EnquiryDate').toString();
        const allowedDateFields = new Set(['EnquiryDate']);
        const selectedDateField = allowedDateFields.has(normalizedDateField) ? normalizedDateField : 'EnquiryDate';
        const dateRange: Prisma.DateTimeFilter = {};

        const fromRaw = dateFrom ?? DateFrom;
        const toRaw = dateTo ?? DateTo;
        if (fromRaw) {
            const parsedFrom = new Date(fromRaw);
            if (!Number.isNaN(parsedFrom.getTime())) {
                dateRange.gte = parsedFrom;
            }
        }
        if (toRaw) {
            const parsedTo = new Date(toRaw);
            if (!Number.isNaN(parsedTo.getTime())) {
                dateRange.lte = parsedTo;
            }
        }

        const [departmentMatches, searchPorts, polPorts, podPorts] = await Promise.all([
            search || normalizedDepartmentSid ? this._db.departmentMaster.findMany({
                where: search
                    ? {
                        departmentName: { contains: search, mode: 'insensitive' },
                        Status: 'A',
                    }
                    : normalizedDepartmentSid
                        ? { DepartmentMasterSid: normalizedDepartmentSid, Status: 'A' }
                        : { Status: 'A' },
                select: { DepartmentMasterSid: true },
            }) : Promise.resolve([]),
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
            normalizedPolCode
                ? this._db.portMaster.findMany({
                    where: { status: 'A', PortCode: normalizedPolCode },
                    select: { PortMasterSid: true }
                })
                : Promise.resolve([]),
            normalizedPodCode
                ? this._db.portMaster.findMany({
                    where: { status: 'A', PortCode: normalizedPodCode },
                    select: { PortMasterSid: true }
                })
                : Promise.resolve([])
        ]);

        const filteredDepartmentIds = departmentMatches.map(dep => dep.DepartmentMasterSid);
        const portWithSearchOnlyIds = searchPorts.map(p => p.PortMasterSid);
        const polPortIds = polPorts.map(p => p.PortMasterSid);
        const podPortIds = podPorts.map(p => p.PortMasterSid);

        const where: Prisma.EnquiryHeaderWhereInput = {
            status: statusWhereClause,
            authorizerStatus: ApprovalStatus.Approved,
            QuoteHeaderSid: null,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(normalizedCustomerSid && { CustomerMasterSid: normalizedCustomerSid }),
            ...(normalizedDepartmentSid && { DepartmentMasterSid: normalizedDepartmentSid }),
            ...(polPortIds.length || podPortIds.length
                ? {
                    enquiryRoute: {
                        some: {
                            ...(polPortIds.length ? { POLSid: { in: polPortIds } } : normalizedPolSid ? { POLSid: normalizedPolSid } : {}),
                            ...(podPortIds.length ? { PODSid: { in: podPortIds } } : normalizedPodSid ? { PODSid: normalizedPodSid } : {})
                        }
                    }
                }
                : {}),
            ...(Object.keys(dateRange).length ? { [selectedDateField]: dateRange } as any : {}),
            ...(search ?
                {
                    OR: [
                        { EnquiryNumber: { contains: search, mode: 'insensitive' } },
                        { CustomerName: { contains: search, mode: 'insensitive' } },
                        ...(filteredDepartmentIds.length ? [{ DepartmentMasterSid: { in: filteredDepartmentIds } }] : []),
                        { enquiryRoute: { some: { POLSid: { in: portWithSearchOnlyIds } } } },
                        { enquiryRoute: { some: { PODSid: { in: portWithSearchOnlyIds } } } },
                        { status: { contains: search, mode: 'insensitive' } },
                        ...(parsedDate
                            ? [{ EnquiryDate: { equals: parsedDate } }]
                            : []),
                    ],
                } : {}
            )
        }

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.enquiryHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { EnquiryHeaderSid: 'desc' },
                include: {
                    enquiryRoute: {
                        include: {
                            enquiryCargo: { orderBy: { EnquiryCargoSid: 'asc' } },
                        }
                    },
                    enquiryOther: true
                }
            }),
            this._db.enquiryHeader.count({ where }),
        ]);

        items = await Promise.all(
            items.map(async (item) => {
                let dept;
                if (item?.DepartmentMasterSid) {
                    dept = await this._db.departmentMaster.findFirst({
                        where: {
                            DepartmentMasterSid: item.DepartmentMasterSid
                        },
                        select: {
                            departmentName: true
                        }
                    })
                }
                const pol = await this._db.portMaster.findFirst({
                    where: {
                        PortMasterSid: item.enquiryRoute[0]?.POLSid
                    },
                    select : {
                        PortName : true,
                        PortCode : true
                    }
                })
                const pod = await this._db.portMaster.findFirst({
                    where: {
                        PortMasterSid: item.enquiryRoute[0]?.PODSid
                    },
                    select : {
                        PortName : true,
                        PortCode : true
                    }
                })
                return {
                    ...item,
                    department : dept,
                    POL: pol,
                    POD: pod,
                }
            })
        )

        return {
            items,
            totalCount,
        };
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


async softDeleteRoute(routeId: number) {
  const existingRoute = await this._db.enquiryRoute.findUnique({
    where: { EnquiryRouteSid: routeId }
  });

  if (!existingRoute) {
    throw new NotFoundException(`Route with ID ${routeId} not found`);
  }

  if (existingRoute.status === 'D') {
    throw new BadRequestException(`Route with ID ${routeId} is already deleted`);
  }

  const deletedRoute = await this._db.enquiryRoute.update({
    where: { EnquiryRouteSid: routeId },
    data: { status: 'D' }
  });

  const deletedCargos = await this._db.enquiryCargo.updateMany({
    where: { EnquiryRouteSid: routeId, status: { not: 'D' } },
    data: { status: 'D' }
  });

  return { deletedRoute, deletedCargos };
}

async softDeleteCargo(cargoId: number) {
  const existingCargo = await this._db.enquiryCargo.findUnique({
    where: { EnquiryCargoSid: cargoId }
  });

  if (!existingCargo) {
    throw new NotFoundException(`Cargo with ID ${cargoId} not found`);
  }

  if (existingCargo.status === 'D') {
    throw new BadRequestException(`Cargo with ID ${cargoId} is already deleted`);
  }

  const deletedCargo = await this._db.enquiryCargo.update({
    where: { EnquiryCargoSid: cargoId },
    data: { status: 'D' }
  });

  return { deletedCargo };
}

}

