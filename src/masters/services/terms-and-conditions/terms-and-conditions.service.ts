import { BadRequestException, Injectable } from '@nestjs/common';
import { log } from 'console';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class TermsAndConditionsService {
    constructor(private _db: DatabaseService) { }

    async getAllTermCond() {
        try {
            const allTermConds = await this._db.termsAndConditionsMaster.findMany({
                where: {
                    status: 'A'
                },
                include: {
                    departments: true
                }
            })
            return allTermConds;
        } catch (error) {
            throw error;
        }
    }


    async createNewTermCond(payload) {
        try {
            const {
                departmentOnTerms,
                departmentId,
                departments,
                termsAndConditionDetail,
                termsAndConditionsDetail,
                termsAndConditionsDetails,
                ...termCondInput
            } = payload;

            const rawDepartments = departmentOnTerms ?? departmentId ?? departments ?? [];
            const inputDepartments = Array.isArray(rawDepartments)
                ? rawDepartments
                : rawDepartments ? [rawDepartments] : [];

            const rawDetails =
                termsAndConditionDetail ??
                termsAndConditionsDetail ??
                termsAndConditionsDetails ??
                [];

            const inputDetails = Array.isArray(rawDetails)
                ? rawDetails
                : [rawDetails];

            const normalizedDepartments = inputDepartments
                .map((item: any) => {
                    if (typeof item === 'object' && item !== null) {
                        return Number(item.departmentId ?? item.DepartmentMasterSid);
                    }
                    return Number(item);
                })
                .filter((id: number) => Number.isInteger(id) && id > 0)
                .sort((a, b) => a - b); // sort for exact match comparison

            if (!termCondInput.BranchMasterSid) {
                throw new BadRequestException('BranchMasterSid is required');
            }

            if (!termCondInput.MenuMasterSid) {
                throw new BadRequestException('MenuMasterSid is required');
            }

            const mergedObj = await this._db.$transaction(async (prisma) => {
                const {
                    CompanyMasterSid,
                    BranchMasterSid,
                    MenuMasterSid,
                    POL,
                    POD,
                    Carrier,
                    ...masterInput
                } = termCondInput;

                const formattedPOL = Array.isArray(POL) ? [...POL].sort() : [];
                const formattedPOD = Array.isArray(POD) ? [...POD].sort() : [];

                // 🔎 STRICT DUPLICATE CHECK
                const existingMasters = await prisma.termsAndConditionsMaster.findMany({
                    where: {
                        CompanyMasterSid: Number(CompanyMasterSid),
                        BranchMasterSid: Number(BranchMasterSid),
                        MenuMasterSid: Number(MenuMasterSid),
                        Carrier: Carrier ?? null,
                        status: 'A',
                        POL: { equals: formattedPOL },
                        POD: { equals: formattedPOD },
                    },
                    include: {
                        departments: {
                            where: { status: 'A' }
                        }
                    }
                });

                for (const master of existingMasters) {
                    const existingDeptIds = master.departments
                        .map(d => d.departmentId)
                        .sort((a, b) => a - b);

                    const isSameDepartments =
                        JSON.stringify(existingDeptIds) === JSON.stringify(normalizedDepartments);

                    if (isSameDepartments) {
                        throw new BadRequestException(
                            'Terms & Conditions already exists with same Branch, Menu, Department, POL, POD combination'
                        );
                    }
                }

                // ✅ CREATE MASTER
                const createdTermCond = await prisma.termsAndConditionsMaster.create({
                    data: {
                        ...masterInput,
                        CompanyMasterSid: CompanyMasterSid ? Number(CompanyMasterSid) : null,
                        BranchMasterSid: Number(BranchMasterSid),
                        MenuMasterSid: Number(MenuMasterSid),
                        Carrier: Carrier ?? null,
                        POL: formattedPOL,
                        POD: formattedPOD,
                        status: 'A'
                    }
                });

                // ✅ CREATE DEPARTMENTS (if any)
                let finalDepartments: any[] = [];

                if (normalizedDepartments.length > 0) {
                    await prisma.departmentOnTerms.createMany({
                        data: normalizedDepartments.map((deptId: number) => ({
                            termsId: createdTermCond.TermsAndConditionsMasterSid,
                            departmentId: deptId,
                            status: 'A'
                        }))
                    });

                    finalDepartments = await prisma.departmentOnTerms.findMany({
                        where: {
                            termsId: createdTermCond.TermsAndConditionsMasterSid
                        }
                    });
                }

                // ✅ NORMALIZE DETAILS
                const normalizedDetails = inputDetails
                    .map((item: any) => ({
                        TandC: item?.TandC ?? item?.Terms ?? '',
                        Type: item?.Type ?? null,
                        TypeValue: item?.TypeValue ?? null,
                        IsDefaut: item?.IsDefaut ?? 'A',
                        createdBy: item?.createdBy ?? createdTermCond.createdBy,
                        status: item?.status ?? 'A'
                    }))
                    .filter((item: any) => String(item.TandC).trim().length > 0);

                let detailData: any[] = [];

                if (normalizedDetails.length > 0) {
                    await prisma.termsAndConditionsDetail.createMany({
                        data: normalizedDetails.map((item: any) => ({
                            TermsAndConditionsMasterSid:
                                createdTermCond.TermsAndConditionsMasterSid,
                            TandC: item.TandC,
                            Type: item.Type,
                            TypeValue: item.TypeValue,
                            IsDefaut: item.IsDefaut,
                            createdBy: item.createdBy,
                            status: item.status
                        }))
                    });

                    detailData = await prisma.termsAndConditionsDetail.findMany({
                        where: {
                            TermsAndConditionsMasterSid:
                                createdTermCond.TermsAndConditionsMasterSid,
                            status: 'A'
                        }
                    });
                }

                return {
                    tandCData: createdTermCond,
                    departmentData: finalDepartments,
                    detailData
                };
            });

            return mergedObj;

        } catch (error) {
            throw error;
        }
    }


    async fetchTermCondById(TermsAndConditionsMasterSid: number) {
        try {
            const ourTermCond = await this._db.termsAndConditionsMaster.findUnique({
                where: {
                    TermsAndConditionsMasterSid: TermsAndConditionsMasterSid
                },
                include: {
                    termsAndConditionsDetail: {
                        where: {
                            status: 'A'
                        }
                    },
                    departments: {
                        where: {
                            status: 'A'
                        },
                        include: {
                            department: true
                        }
                    },

                }
            })
            if (!ourTermCond) {
                throw new BadRequestException(`Terms and Conditions with Id : ${TermsAndConditionsMasterSid} not exists`);
            }
            return ourTermCond;
        } catch (error) {
            throw error;
        }
    }

    async updateTermCondById(TermsAndConditionsMasterSid: number, payload) {
        try {
            const exist = await this._db.termsAndConditionsMaster.findUnique({
                where: { TermsAndConditionsMasterSid }
            });

            if (!exist) {
                throw new BadRequestException(
                    `Terms and Conditions with Id : ${TermsAndConditionsMasterSid} not exists`
                );
            }

            const result = await this._db.$transaction(async (prisma) => {

                const {
                    departmentOnTerms,
                    departmentId,
                    departments,
                    termsAndConditionDetail,
                    termsAndConditionsDetail,
                    termsAndConditionsDetails,
                    ...TandCUpdateData
                } = payload;

                const {
                    CompanyMasterSid,
                    BranchMasterSid,
                    MenuMasterSid,
                    POL,
                    POD,
                    Carrier,
                    ...masterInput
                } = TandCUpdateData;

                const formattedPOL = Array.isArray(POL) ? [...POL].sort() : [];
                const formattedPOD = Array.isArray(POD) ? [...POD].sort() : [];

                // ----------------------------
                // 🔎 NORMALIZE DEPARTMENTS
                // ----------------------------
                const rawDepartments = departmentOnTerms ?? departmentId ?? departments ?? [];
                const inputDepartments = Array.isArray(rawDepartments)
                    ? rawDepartments
                    : rawDepartments ? [rawDepartments] : [];

                const normalizedDepartments = inputDepartments
                    .map((item: any) => {
                        if (typeof item === 'object' && item !== null) {
                            return Number(item.departmentId ?? item.DepartmentMasterSid);
                        }
                        return Number(item);
                    })
                    .filter((id: number) => Number.isInteger(id) && id > 0)
                    .sort((a, b) => a - b);

                // ----------------------------
                // 🔴 STRICT DUPLICATE CHECK
                // ----------------------------
                const existingMasters = await prisma.termsAndConditionsMaster.findMany({
                    where: {
                        TermsAndConditionsMasterSid: { not: TermsAndConditionsMasterSid },
                        CompanyMasterSid: Number(CompanyMasterSid),
                        BranchMasterSid: Number(BranchMasterSid),
                        MenuMasterSid: Number(MenuMasterSid),
                        Carrier: Carrier ?? null,
                        status: 'A',
                        POL: { equals: formattedPOL },
                        POD: { equals: formattedPOD },
                    },
                    include: {
                        departments: {
                            where: { status: 'A' }
                        }
                    }
                });

                for (const master of existingMasters) {
                    const existingDeptIds = master.departments
                        .map(d => d.departmentId)
                        .sort((a, b) => a - b);

                    const isSameDepartments =
                        JSON.stringify(existingDeptIds) === JSON.stringify(normalizedDepartments);

                    if (isSameDepartments) {
                        throw new BadRequestException(
                            'Another Terms & Conditions already exists with same Branch, Menu, Department, POL, POD combination'
                        );
                    }
                }

                // ----------------------------
                // ✅ UPDATE MASTER
                // ----------------------------
                const updatedTermCond = await prisma.termsAndConditionsMaster.update({
                    where: { TermsAndConditionsMasterSid },
                    data: {
                        ...masterInput,
                        CompanyMasterSid: CompanyMasterSid ? Number(CompanyMasterSid) : null,
                        BranchMasterSid: BranchMasterSid ? Number(BranchMasterSid) : undefined,
                        MenuMasterSid: MenuMasterSid ? Number(MenuMasterSid) : undefined,
                        Carrier: Carrier ?? null,
                        POL: formattedPOL,
                        POD: formattedPOD,
                    }
                });

                // ----------------------------
                // ✅ UPSERT DEPARTMENTS
                // ----------------------------
                await prisma.departmentOnTerms.deleteMany({
                    where: {
                        termsId: TermsAndConditionsMasterSid
                    }
                });

                // 2️⃣ Insert only newly selected departments
                let finalDepartments: any[] = [];

                if (normalizedDepartments.length > 0) {
                    await prisma.departmentOnTerms.createMany({
                        data: normalizedDepartments.map((deptId) => ({
                            termsId: TermsAndConditionsMasterSid,
                            departmentId: deptId,
                            status: 'A'
                        }))
                    });

                    finalDepartments = normalizedDepartments;
                }

                // ----------------------------
                // ✅ HANDLE DETAILS
                // ----------------------------
                const rawDetails =
                    termsAndConditionDetail ??
                    termsAndConditionsDetail ??
                    termsAndConditionsDetails ??
                    [];

                const inputDetails = Array.isArray(rawDetails)
                    ? rawDetails
                    : [rawDetails];

                const normalizedDetails = inputDetails
                    .map((item: any) => ({
                        TermsAndConditionsDetailSid:
                            item?.TermsAndConditionsDetailSid
                                ? Number(item.TermsAndConditionsDetailSid)
                                : null,
                        TandC: item?.TandC ?? item?.Terms ?? '',
                        Type: item?.Type ?? null,
                        TypeValue: item?.TypeValue ?? null,
                        IsDefaut: item?.IsDefaut ?? 'A',
                        status: item?.status ?? 'A',
                        updatedBy: payload?.updatedBy ?? null
                    }))
                    .filter((item: any) => String(item.TandC).trim().length > 0);

                const finalDetails: any[] = [];

                for (const item of normalizedDetails) {

                    if (item.TermsAndConditionsDetailSid) {
                        const updatedDetail =
                            await prisma.termsAndConditionsDetail.update({
                                where: {
                                    TermsAndConditionsDetailSid:
                                        item.TermsAndConditionsDetailSid
                                },
                                data: {
                                    TandC: item.TandC,
                                    Type: item.Type,
                                    TypeValue: item.TypeValue,
                                    IsDefaut: item.IsDefaut,
                                    status: item.status,
                                    updatedBy: item.updatedBy
                                }
                            });

                        finalDetails.push(updatedDetail);
                    } else {
                        const createdDetail =
                            await prisma.termsAndConditionsDetail.create({
                                data: {
                                    TermsAndConditionsMasterSid,
                                    TandC: item.TandC,
                                    Type: item.Type,
                                    TypeValue: item.TypeValue,
                                    IsDefaut: item.IsDefaut,
                                    createdBy:
                                        payload?.updatedBy ??
                                        updatedTermCond.updatedBy ??
                                        updatedTermCond.createdBy,
                                    status: item.status
                                }
                            });

                        finalDetails.push(createdDetail);
                    }
                }

                return {
                    tandCData: updatedTermCond,
                    departmentData: finalDepartments,
                    detailData: finalDetails
                };
            });

            return result;

        } catch (error) {
            throw error;
        }
    }



    async deleteTermCond(TermsAndConditionsMasterSid: number) {
        try {

            const exist = await this._db.termsAndConditionsMaster.findUnique({
                where: {
                    TermsAndConditionsMasterSid: TermsAndConditionsMasterSid
                }
            });

            if (!exist) {
                throw new BadRequestException(`Terms & Conditions with ID: ${TermsAndConditionsMasterSid} not exists`);
            }

            if (exist.status === 'D') {
                throw new BadRequestException(`Terms & Conditions with ID: ${TermsAndConditionsMasterSid} is already deleted`);
            }

            return await this._db.$transaction(async (tx) => {

                const deletedMaster = await tx.termsAndConditionsMaster.update({
                    where: {
                        TermsAndConditionsMasterSid: TermsAndConditionsMasterSid
                    },
                    data: {
                        status: 'D'
                    }
                });


                const deletedDetails = await tx.termsAndConditionsDetail.updateManyAndReturn({
                    where: {
                        TermsAndConditionsMasterSid: TermsAndConditionsMasterSid,
                        status: 'D'
                    },
                    data: {
                        status: 'D'
                    }
                });


                const deletedTransactions = await tx.tandCTransaction.updateManyAndReturn({
                    where: {
                        TandCMasterSid: TermsAndConditionsMasterSid,
                        status: 'D'
                    },
                    data: {
                        status: 'D'
                    }
                });


                const deletedDepartmentRelations = await tx.departmentOnTerms.updateManyAndReturn({
                    where: {
                        termsId: TermsAndConditionsMasterSid,
                        status: 'D'
                    },
                    data: {
                        status: 'D'
                    }
                });


                return {
                    deletedMaster,
                    deletedDetails,
                    deletedTransactions,
                    deletedDepartmentRelations

                };
            });
        } catch (error) {
            throw new Error(`Terms & Conditions deletion failed: ${error.message}`);
        }
    }


    async searchTermCond(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            "CompanyMasterSid",
            "BranchMasterSid",
            "MenuMasterSid",
            "Carrier",
        ];
        const stringFields = [
            "PrintType",
            "POL",
            "POD",
            "status",
            "Remarks"
        ];

        const acceptedType = [...intFields, ...stringFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {}

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            }
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }

        const searchResults = await this._db.termsAndConditionsMaster.findMany({
            where: {
                ...whereClause,
                status: 'A'
            },
            include: {
                branch: {
                    select: {
                        branchName: true
                    }
                },
                menu: {
                    select: {
                        MenuName: true
                    }
                },
                departments: true
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

    
    async createTandCTransaction(payload: any) {

    const {
        CompanyMasterSid,
        BranchMasterSid,
        MenuMasterSid,
        createdBy,
        TandC,
        IsDefaut,
        POL,
        POD,
        Carrier,
        DepartmentMasterSid,
        DocumentSid
    } = payload;

    if (!CompanyMasterSid || !BranchMasterSid || !MenuMasterSid || !createdBy || !TandC) {
        throw new BadRequestException('Missing required fields');
    }

    return await this._db.$transaction(async (tx) => {

        // ✅ Normalize POL/POD (handles string or array)
        const formattedPOL = Array.isArray(POL)
            ? POL.map(String).sort()
            : POL ? [String(POL)] : [];

        const formattedPOD = Array.isArray(POD)
            ? POD.map(String).sort()
            : POD ? [String(POD)] : [];

        // ✅ Normalize department
        const inputDepartments = DepartmentMasterSid
            ? [Number(DepartmentMasterSid)]
            : [];

        // 🔎 Find matching masters
        const existingMasters = await tx.termsAndConditionsMaster.findMany({
            where: {
                OR: [
   { CompanyMasterSid: Number(CompanyMasterSid) },
   { CompanyMasterSid: null }
],
                BranchMasterSid: Number(BranchMasterSid),
                MenuMasterSid: Number(MenuMasterSid),
                Carrier: Carrier ?? null,
                status: 'A',
                POL: { equals: formattedPOL },
                POD: { equals: formattedPOD }
            },
            include: {
                departments: {
                    where: { status: 'A' }
                }
            }
        });

        let master: any = null;

        for (const record of existingMasters) {

            const existingDeptIds = record.departments
                .map(d => Number(d.departmentId))
                .sort((a, b) => a - b);

            const inputDeptIds = inputDepartments
                .map(d => Number(d))
                .sort((a, b) => a - b);

            const isSameDepartments =
                existingDeptIds.length === inputDeptIds.length &&
                existingDeptIds.every((val, index) => val === inputDeptIds[index]);

            if (isSameDepartments) {
                master = record;
                break;
            }
        }

        // -------------------------
        // CREATE MASTER IF NOT FOUND
        // -------------------------
        if (!master) {

            master = await tx.termsAndConditionsMaster.create({
                data: {
                    CompanyMasterSid: Number(CompanyMasterSid),
                    BranchMasterSid: Number(BranchMasterSid),
                    MenuMasterSid: Number(MenuMasterSid),
                    Carrier: Carrier ?? null,
                    POL: formattedPOL,
                    POD: formattedPOD,
                    createdBy,
                    status: 'A',

                    ...(DepartmentMasterSid && {
                        departments: {
                            create: {
                                departmentId: Number(DepartmentMasterSid),
                                status: 'A'
                            }
                        }
                    })
                }
            });

        }

        // -------------------------
        // CREATE DETAIL
        // -------------------------
        const newDetail = await tx.termsAndConditionsDetail.create({
            data: {
                TermsAndConditionsMasterSid:
                    master.TermsAndConditionsMasterSid,
                TandC,
                IsDefaut,
                createdBy,
                status: 'A'
            }
        });

        // -------------------------
        // CREATE TRANSACTION
        // -------------------------
        await tx.tandCTransaction.create({
            data: {
                CompanyMasterSid: Number(CompanyMasterSid),
                TandCMasterSid: master.TermsAndConditionsMasterSid,
                TandCDetailSid: newDetail.TermsAndConditionsDetailSid,
                Terms: TandC,
                DocumentSid,
                createdBy,
                status: 'A'
            }
        });

        return newDetail;
    });
}

    async getTandCByCondition(payload: TandCPayload) {
  try {

    if (!payload.MenuMasterSid) {
      throw new Error('MenuMasterSid is required');
    }

    const andConditions: any[] = [];

    if (payload.POL) {
      andConditions.push({
        OR: [
          { POL: { has: payload.POL } },
          { POL: { equals: [] } },
        ]
      });
    }

    if (payload.POD) {
      andConditions.push({
        OR: [
          { POD: { has: payload.POD } },
          { POD: { equals: [] } },
        ]
      });
    }

    if (payload.Carrier !== undefined) {
      andConditions.push({
        OR: [
          { Carrier: payload.Carrier },
          { Carrier: null }
        ]
      });
    }

    if (payload.DepartmentMasterSid) {
      andConditions.push({
        OR: [
          {
            departments: {
              some: { departmentId: payload.DepartmentMasterSid }
            }
          },
          {
            departments: {
              none: {}
            }
          }
        ]
      });
    }

    const whereCondition: any = {
      MenuMasterSid: payload.MenuMasterSid,
      status: 'A',
      ...(payload.BranchMasterSid && { BranchMasterSid: payload.BranchMasterSid }),
      ...(andConditions.length && { AND: andConditions })
    };

    const gatheredTandC = await this._db.termsAndConditionsMaster.findMany({
      where: whereCondition,
      include: {
        termsAndConditionsDetail: {
          where: {
            IsDefaut: 'S',
            status: 'A'
          }
        }
      }
    });

    const allDetails = gatheredTandC.flatMap(t => t.termsAndConditionsDetail);

    const unique = new Map();
    allDetails.forEach(detail => {
      unique.set(detail.TermsAndConditionsDetailSid, detail);
    });

    return Array.from(unique.values());

  } catch (error) {
    console.error('Error fetching terms and conditions:', error);
    throw new Error(`Failed to fetch terms and conditions: ${error.message}`);
  }
}

    async getTandCByNCondition(payload: TandCPayload) {
  try {

    if (!payload.MenuMasterSid) {
      throw new Error('MenuMasterSid is required');
    }

    const andConditions: any[] = [];

    if (payload.POL) {
      andConditions.push({
        OR: [
          { POL: { has: payload.POL } },
          { POL: { equals: [] } },
        ]
      });
    }

    if (payload.POD) {
      andConditions.push({
        OR: [
          { POD: { has: payload.POD } },
          { POD: { equals: [] } },
        ]
      });
    }

    if (payload.Carrier !== undefined) {
      andConditions.push({
        OR: [
          { Carrier: payload.Carrier },
          { Carrier: null }
        ]
      });
    }

    if (payload.DepartmentMasterSid) {
      andConditions.push({
        OR: [
          {
            departments: {
              some: { departmentId: payload.DepartmentMasterSid }
            }
          },
          {
            departments: {
              none: {}
            }
          }
        ]
      });
    }

    const whereCondition: any = {
      MenuMasterSid: payload.MenuMasterSid,
      status: 'A',
      ...(payload.BranchMasterSid && { BranchMasterSid: payload.BranchMasterSid }),
      ...(andConditions.length && { AND: andConditions })
    };

    const gatheredTandC = await this._db.termsAndConditionsMaster.findMany({
      where: whereCondition,
      include: {
        termsAndConditionsDetail: {
          where: {
            IsDefaut: 'N',
            status: 'A'
          }
        }
      }
    });

    const allDetails = gatheredTandC.flatMap(t => t.termsAndConditionsDetail);

    const unique = new Map();
    allDetails.forEach(detail => {
      unique.set(detail.TermsAndConditionsDetailSid, detail);
    });

    return Array.from(unique.values());

  } catch (error) {
    console.error('Error fetching terms and conditions:', error);
    throw new Error(`Failed to fetch terms and conditions: ${error.message}`);
  }
}

    async getAllMenus() {
    try {

        const allowedMenuCodes = [
            'BKN','AMA','RET','HBL','JV','PA','HJB','MA1','MA2',
            'RV','CN','SC2','VI','VCN','RAT','QUA'
        ];

       

        const menuList = await this._db.menuMaster.findMany({
            where: {
                status: 'A',
                MenuCode: { in: allowedMenuCodes },
            }
        });

        return menuList;

    } catch (error) {
        console.error('getAllMenus error:', error);
        throw error;
    }
}
}

interface TandCPayload {
    BranchMasterSid?: number;
    MenuMasterSid: number;
    POL?: string;
    POD?: string;
    Carrier?: number;
    DepartmentMasterSid?: number;
}
