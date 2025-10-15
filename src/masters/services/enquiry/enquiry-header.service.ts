import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, LeadStatus, Prisma } from '@prisma/client';
import { contains } from 'class-validator';
import * as moment from 'moment-timezone';
import { parseDateFromString, statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class EnquiryHeaderService {
    constructor(
        private _db: DatabaseService, private logger: Logger
    ) { }

    async createEnquiry(payload) {
        try {
            return await this._db.$transaction(async (prisma) => {
                const dateString = moment().format('YYYYMMDD')
                const count = await this._db.enquiryHeader.count({
                    where: {
                        EnquiryNumber: {
                            contains: dateString
                        }
                    }
                })
               
                const enquiryNumber = `enquiry-${dateString}-${(count + 1).toString().padStart(3, '0')}`
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
                    status: payload.status || "A",
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    UserMasterSid: payload.UserMasterSid,
                    createdBy: payload.createdBy,
                    CustomerRef:payload.CustomerRef,
                    // EnquiryNumber: "",
                    EnquiryDate: new Date(),
                    authorizerStatus: payload.authorizerStatus || "Pending"
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
                        GrossWeight: parseFloat(cargo.GrossWeight) || 0,    // LCL , FCL
                        NetWeight: parseFloat(cargo.NetWeight),            // LCL , FCL
                        ShipmentTerms: cargo.ShipmentTerms,            // LCL , FCL
                        Volume: parseFloat(cargo.cbm),                      // LCL
                        ContainerType: cargo.ContainerType,             // FCL , AIR
                        ChargeableWeight: cargo.ChargeableWeight,      // AIR
                        length: Number(cargo.length),
                        width: Number(cargo.width),
                        height: Number(cargo.height),
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
                    }
                })
                if (enquiryHeader && payload.LeadOrCustomer === "L") {
                    await this._db.preCustomerMaster.update({
                        where: {
                            PreCustomerMasterSid: payload.PreCustomerMasterSid
                        }, data: {
                            leadStatus: LeadStatus.EnquiryGenerated
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
                        include: {
                            enquiryCargo: true
                        }
                    },
                    enquiryOther: true
                }
            });
        } catch (error) {
            throw error;
        }
    }


    async updateEnquiry(enquiryHeaderSid: number, payload) {
        try {
            // Step 1: Update Enquiry Header
            const statusUpdate = payload.status === "A" ? "A" : "S";

            let authLogUpdate;

            if (payload.approvalStatusChange && payload.authorizerStatus !== "Pending") {



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
                        DocumentSid: enquiryHeaderSid,
                        AuthorityDetailSid: authorityDetail.AuthorityDetailSid,
                        ApprovalStatus: payload.authorizerStatus,
                        AuthorisedDate: new Date(),
                        Remarks: payload.AuthorizerRemarks,
                    },
                });

                if (authorityDetail.FinalAuthority === 'Y' || payload.authorizerStatus === "Rejected") {

                    await this._db.enquiryHeader.update({
                        where: { EnquiryHeaderSid: enquiryHeaderSid },
                        data: {
                            authorizerStatus: payload.authorizerStatus,
                            AuthorizerRemarks: payload.AuthorizerRemarks,
                        },
                    });
                }
            }
            const updatedEnquiryHeader = await this._db.enquiryHeader.update({
                where: { EnquiryHeaderSid: enquiryHeaderSid },
                data: {
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
                    status: statusUpdate,
                    updatedBy: payload.updatedBy,
                    updatedOn: new Date(),
                    
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
                                    ContainerType: cargoItem.ContainerType,
                                    length: Number(cargoItem.length),
                                    width: Number(cargoItem.width),
                                    height: Number(cargoItem.height),
                                }
                            });
                        } else {
                            createCargoData = await this._db.enquiryCargo.create({
                                data: {
                                    CargoType: cargoItem.CargoType,
                                    ProductName: cargoItem.ProductName,
                                    CargoDescription: cargoItem.CargoDescription,
                                    PackageType: cargoItem.PackageType,
                                    Qty: Number(cargoItem.Qty) || 0,
                                    WeightUnitSid: cargoItem.WeightUnitSid,
                                    GrossWeight: parseFloat(cargoItem.GrossWeight) || 0,
                                    NetWeight: parseFloat(cargoItem.NetWeight),
                                    ShipmentTerms: cargoItem.ShipmentTerms,
                                    Volume: parseFloat(cargoItem.cbm),
                                    ContainerType: cargoItem.ContainerType,
                                    ChargeableWeight: cargoItem.ChargeableWeight,
                                    length: Number(cargoItem.length),
                                    width: Number(cargoItem.width),
                                    height: Number(cargoItem.height),
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
        const { search = '', page = 1, pageSize = 10, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;
        const parsedDate = parseDateFromString(search);
        console.log(parsedDate);
        const where: Prisma.EnquiryHeaderWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(search ?
                {
                    OR: [
                        { EnquiryNumber: { contains: search, mode: 'insensitive' } },
                        { quoteHeader: { some: { QuoteNumber: { contains: search, mode: 'insensitive' } } } },
                        { CustomerName: { contains: search, mode: 'insensitive' } },
                        { ShipmentType: { contains: search, mode: 'insensitive' } },
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
                orderBy: { EnquiryHeaderSid: 'desc' },
                include: {
                    enquiryRoute: {
                        select: {
                            POLSid: true,
                            PODSid: true,
                        }
                    }
                }
            }),
            this._db.enquiryHeader.count({ where }),
        ]);

        items = await Promise.all(
            items.map(async (item) => {
                const quote = await this._db.quoteHeader.findFirst({
                    where: {
                        EnquirySid: item.EnquiryHeaderSid
                    },
                    select : {
                        QuoteHeaderSid : true,
                        QuoteNumber : true
                    }
                })
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
                    POD: pod,
                    quoteNo: quote?.QuoteNumber
                }
            })
        )

        return {
            items,
            totalCount,
        };
    }

    async searchPendingEnquiry(params: filterDto) {
        const { search = '', page = 1, pageSize = 10, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;
        const parsedDate = parseDateFromString(search);

        const allDepartmentWithName = await this._db.departmentMaster.findMany({
            where: {
                departmentName: { contains: search, mode: 'insensitive' },
                Status: 'A',
            },
            select: {
                DepartmentMasterSid: true,
            }
        });

        const filteredDepartmentIds = allDepartmentWithName.map(dep => dep.DepartmentMasterSid);

        const ports = await this._db.portMaster.findMany({
            where: {
                PortCode: { contains: search, mode: 'insensitive' },
                status: 'A'
            },
            select: {
                PortMasterSid: true,
            }
        });

        const portWithSearchOnlyIds = ports.map(p => p.PortMasterSid);

        const where: Prisma.EnquiryHeaderWhereInput = {
            status: statusWhereClause,
            authorizerStatus: ApprovalStatus.Pending,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(search ?
                {
                    OR: [
                        { EnquiryNumber: { contains: search, mode: 'insensitive' } },
                        { CustomerName: { contains: search, mode: 'insensitive' } },
                        { DepartmentMasterSid: { in: filteredDepartmentIds } },
                        { enquiryRoute: { some: { POLSid: { in: portWithSearchOnlyIds } } } },
                        { enquiryRoute: { some: { PODSid: { in: portWithSearchOnlyIds } } } },
                        { status: { contains: search, mode: 'insensitive' } },
                        ...(parsedDate
                            ? [
                                { EnquiryDate: { equals: parsedDate } },
                            ]
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
                            enquiryCargo: true,
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
                        PortCode : true
                    }
                })
                const pod = await this._db.portMaster.findFirst({
                    where: {
                        PortMasterSid: item.enquiryRoute[0]?.PODSid
                    },
                    select : {
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
}