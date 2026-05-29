import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateBoeDto, UpdateBoeDto } from 'src/operation/DTO/boe-create.dto';


@Injectable()
export class BoeService {
  constructor(private prisma: DatabaseService) {}

  async create(dto: CreateBoeDto) {
    const boe = await this.prisma.houseJobBOE.create({
      data: {
        CompanyMasterSid: dto.CompanyMasterSid,
        HouseJobSid: dto.HouseJobSid,
        Sno: dto.Sno ?? 1,
        DeclarationNo: dto.DeclarationNo ?? '',
        BOENo: dto.BOENo ?? '',
        BOEDate: dto.BOEDate ? new Date(dto.BOEDate) : null,
        BOEValue: dto.BOEValue ?? null,
        BOEInvoiceValue: dto.BOEInvoiceValue ?? null,
        GrossWeight: dto.GrossWeight ?? null,
        Volume: dto.Volume ?? null,
        TransactionType: dto.TransactionType ?? '',
        Amount: dto.Amount ?? null,
        ProcessDate: dto.ProcessDate ? new Date(dto.ProcessDate) : null,
        ReceivedDate: dto.ReceivedDate ? new Date(dto.ReceivedDate) : null,
        AckNumber: dto.AckNumber ?? '',
        AckDate: dto.AckDate ? new Date(dto.AckDate) : null,
        AckStatus: dto.AckStatus ?? '',
        Remarks: dto.Remarks ?? '',
        CreatedBy: dto.CreatedBy,
        UpdatedBy: dto.CreatedBy,
      },
    });
    return boe;
  }

  async findAll() {
    return this.prisma.houseJobBOE.findMany({
      where: { Status: 'A' },
      orderBy: { HouseJobBOESid: 'asc' },
    });
  }

  async findOne(id: number) {
    const boe = await this.prisma.houseJobBOE.findUnique({
      where: { HouseJobBOESid: id },
    });
    if (!boe) throw new NotFoundException(`BOE record with ID ${id} not found`);
    return boe;
  }

async update(id: number, dto: UpdateBoeDto) {
  const existing = await this.prisma.houseJobBOE.findUnique({
    where: { HouseJobBOESid: id },
  });
  if (!existing) throw new NotFoundException(`BOE record with ID ${id} not found`);

  // ✅ Helper function to clean decimal fields
  const cleanDecimal = (value: any) =>
    value === '' || value === undefined || value === null ? null : new Prisma.Decimal(value);

  // ✅ Clean dates (convert string → Date or keep existing)
  const cleanDate = (value: any, existingDate: Date | null) =>
    value ? new Date(value) : existingDate;

  return this.prisma.houseJobBOE.update({
    where: { HouseJobBOESid: id },
    data: {
      DeclarationNo: dto.DeclarationNo ?? existing.DeclarationNo,
      BOENo: dto.BOENo ?? existing.BOENo,
      BOEDate: cleanDate(dto.BOEDate, existing.BOEDate),
      BOEValue: cleanDecimal(dto.BOEValue ?? existing.BOEValue),
      BOEInvoiceValue: cleanDecimal(dto.BOEInvoiceValue ?? existing.BOEInvoiceValue),
      GrossWeight: cleanDecimal(dto.GrossWeight ?? existing.GrossWeight),
      Volume: cleanDecimal(dto.Volume ?? existing.Volume),
      TransactionType: dto.TransactionType ?? existing.TransactionType,
      Amount: cleanDecimal(dto.Amount ?? existing.Amount),
      ProcessDate: cleanDate(dto.ProcessDate, existing.ProcessDate),
      ReceivedDate: cleanDate(dto.ReceivedDate, existing.ReceivedDate),
      AckNumber: dto.AckNumber ?? existing.AckNumber,
      AckDate: cleanDate(dto.AckDate, existing.AckDate),
      AckStatus: dto.AckStatus ?? existing.AckStatus,
      Remarks: dto.Remarks ?? existing.Remarks,
      UpdatedBy: dto.UpdatedBy ?? existing.UpdatedBy,
      UpdatedOn: new Date(),
    },
  });
}

  async remove(id: number, updatedBy: string) {
    const existing = await this.prisma.houseJobBOE.findUnique({
      where: { HouseJobBOESid: id },
    });
    if (!existing) throw new NotFoundException(`BOE record with ID ${id} not found`);

    return this.prisma.houseJobBOE.update({
      where: { HouseJobBOESid: id },
      data: {
        Status: 'D',
        UpdatedBy: updatedBy,
        UpdatedOn: new Date(),
      },
    });
  }
}
