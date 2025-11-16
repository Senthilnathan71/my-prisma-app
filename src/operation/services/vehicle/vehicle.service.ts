import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { CreateVehicleDto, UpdateVehicleDto } from 'src/operation/DTO/vehicle.dto';

@Injectable()
export class VehicleService {
  constructor(private prisma: DatabaseService) {}

async create(dto: CreateVehicleDto) {
  return this.prisma.houseJobVehicle.create({
    data: {
      CompanyMasterSid: dto.CompanyMasterSid,
      HouseJobSid: dto.HouseJobSid,

      VehicleIndicator: dto.VehicleIndicator ?? 'V',
      UsedNew: dto.UsedNew ?? 'U',
      ChassisNo: dto.ChassisNo ?? '',
      CaseNo: dto.CaseNo ?? '',
      Make: dto.Make ?? '',
      Model: dto.Model ?? '',
      EngineNo: dto.EngineNo ?? '',
      YearBuilt: dto.YearBuilt ?? '',
      Color: dto.Color ?? '',
      Rolling: dto.Rolling ?? 'R',
      GoodsDescription: dto.GoodsDescription ?? '',

      Weight: dto.Weight ? new Prisma.Decimal(dto.Weight) : null,
      Volume: dto.Volume ? new Prisma.Decimal(dto.Volume) : null,

      Remarks: dto.Remarks ?? '',

      CreatedBy: dto.CreatedBy,
      UpdatedBy: dto.CreatedBy,
    },
  });
}


  async findAll() {
    return this.prisma.houseJobVehicle.findMany({
      where: { Status: 'A' },
      orderBy: { HouseJobVehicleSid: 'asc' },
    });
  }

  async findOne(id: number) {
    const vehicle = await this.prisma.houseJobVehicle.findUnique({
      where: { HouseJobVehicleSid: id },
    });

    if (!vehicle) throw new NotFoundException(`Vehicle ID ${id} not found`);
    return vehicle;
  }

async update(id: number, dto: UpdateVehicleDto) {
  const existing = await this.findOne(id);

  const cleanDecimal = (value: any, oldValue: any) =>
    value === '' || value === undefined || value === null
      ? oldValue
      : new Prisma.Decimal(value);

  return this.prisma.houseJobVehicle.update({
    where: { HouseJobVehicleSid: id },
    data: {
      VehicleIndicator: dto.VehicleIndicator ?? existing.VehicleIndicator,
      UsedNew: dto.UsedNew ?? existing.UsedNew,
      ChassisNo: dto.ChassisNo ?? existing.ChassisNo,
      CaseNo: dto.CaseNo ?? existing.CaseNo,
      Make: dto.Make ?? existing.Make,
      Model: dto.Model ?? existing.Model,
      EngineNo: dto.EngineNo ?? existing.EngineNo,
      YearBuilt: dto.YearBuilt ?? existing.YearBuilt,
      Color: dto.Color ?? existing.Color,
      Rolling: dto.Rolling ?? existing.Rolling,
      GoodsDescription: dto.GoodsDescription ?? existing.GoodsDescription,

      Weight: cleanDecimal(dto.Weight, existing.Weight),
      Volume: cleanDecimal(dto.Volume, existing.Volume),

      Remarks: dto.Remarks ?? existing.Remarks,

      UpdatedBy: dto.UpdatedBy ?? existing.UpdatedBy,
      UpdatedOn: new Date(),
    },
  });
}

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.houseJobVehicle.update({
      where: { HouseJobVehicleSid: id },
      data: {
        Status: 'S',
        UpdatedOn: new Date(),
      },
    });
  }
}
