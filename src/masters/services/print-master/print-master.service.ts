import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreatePrintMasterDto, PrintMasterSearchDto, UpdatePrintMasterDto } from 'src/masters/DTO/print-master.dto';

@Injectable()
export class PrintMasterService {
    constructor(private _db: DatabaseService) {}

    async create(dto: CreatePrintMasterDto) {
        try {
            const existing = await this._db.printMaster.findFirst({
                where: {
                    Name: dto.Name,
                    PrintMail: dto.PrintMail,
                    MenuMasterSid: dto.MenuMasterSid,
                    Status: 'A'
                }
            });
            if (existing) {
                throw new BadRequestException(
                    `A print entry with Name "${dto.Name}" and Action "${dto.PrintMail}" already exists for this menu.`
                );
            }
            return await this._db.printMaster.create({
                data: {
                    Name: dto.Name,
                    PrintMail: dto.PrintMail,
                    MenuMasterSid: dto.MenuMasterSid,
                    Status: 'A',
                    CreatedBy: dto.CreatedBy,
                    UpdatedBy: dto.CreatedBy,
                    UpdatedOn: new Date()
                }
            });
        } catch (error) {
            throw error;
        }
    }

    async searchList(dto: PrintMasterSearchDto) {
        try {
            const { search = '', page = 1, pageSize = 10, MenuMasterSid } = dto;
            const skip = (page - 1) * pageSize;

            const where: Prisma.PrintMasterWhereInput = {
                Status: { in: ['A', 'S'] },
                ...(MenuMasterSid ? { MenuMasterSid } : {}),
                ...(search ? {
                    OR: [
                        { Name: { contains: search, mode: 'insensitive' } },
                        { PrintMail: { contains: search, mode: 'insensitive' } },
                        { MenuMaster: { MenuName: { contains: search, mode: 'insensitive' } } }
                    ]
                } : {})
            };

            const [items, totalCount] = await this._db.$transaction([
                this._db.printMaster.findMany({
                    where,
                    skip,
                    take: pageSize,
                    orderBy: { PrintMasterSid: 'desc' },
                    include: {
                        MenuMaster: { select: { MenuName: true } }
                    }
                }),
                this._db.printMaster.count({ where })
            ]);

            return {
                items,
                totalCount
            };
        } catch (error) {
            throw error;
        }
    }

    async fetchById(PrintMasterSid: number) {
        try {
            const record = await this._db.printMaster.findUnique({
                where: { PrintMasterSid },
                include: { MenuMaster: { select: { MenuName: true } } }
            });
            if (!record) throw new BadRequestException('Print Master record not found.');
            return record;
        } catch (error) {
            throw error;
        }
    }

    async update(PrintMasterSid: number, dto: UpdatePrintMasterDto) {
        try {
            const record = await this._db.printMaster.findUnique({ where: { PrintMasterSid } });
            if (!record) throw new BadRequestException('Print Master record not found.');

            const nameToCheck = dto.Name ?? record.Name;
            const printMailToCheck = dto.PrintMail ?? record.PrintMail;
            const menuToCheck = dto.MenuMasterSid ?? record.MenuMasterSid;

            const existing = await this._db.printMaster.findFirst({
                where: {
                    Name: nameToCheck,
                    PrintMail: printMailToCheck,
                    MenuMasterSid: menuToCheck,
                    Status: 'A',
                    NOT: { PrintMasterSid }
                }
            });
            if (existing) {
                throw new BadRequestException(
                    `A print entry with this Name and Action already exists for this menu.`
                );
            }

            return await this._db.printMaster.update({
                where: { PrintMasterSid },
                data: {
                    ...(dto.Name !== undefined && { Name: dto.Name }),
                    ...(dto.PrintMail !== undefined && { PrintMail: dto.PrintMail }),
                    ...(dto.MenuMasterSid !== undefined && { MenuMasterSid: dto.MenuMasterSid }),
                    ...(dto.Status !== undefined && { Status: dto.Status }),
                    UpdatedBy: dto.UpdatedBy,
                    UpdatedOn: new Date()
                }
            });
        } catch (error) {
            throw error;
        }
    }

    async getByMenu(MenuMasterSid: number) {
        try {
            return await this._db.printMaster.findMany({
                where: {
                    MenuMasterSid,
                    Status: 'A'
                },
                select: {
                    PrintMasterSid: true,
                    Name: true,
                    PrintMail: true
                },
                orderBy: [{ Name: 'asc' }, { PrintMail: 'asc' }]
            });
        } catch (error) {
            throw error;
        }
    }
}
