import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { CreateCustomsDto, UpdateCustomsDto } from 'src/operation/DTO/customs.dto';

@Injectable()
export class CustomsService {
  constructor(private prisma: DatabaseService) {}

async create(dto: CreateCustomsDto) {
  return this.prisma.houseJobCustoms.create({
    data: {
      CompanyMasterSid: dto.CompanyMasterSid,
      HouseJobSid: dto.HouseJobSid ?? null,
      MasterJobSid: dto.MasterJobSid ?? null,

      LineCode: dto.LineCode ?? '',
      VoyageAgentCode: dto.VoyageAgentCode ?? '',
      RotationNumber: dto.RotationNumber ?? '',
      ManifestSequence: dto.ManifestSequence ?? '',

      CargoCode: dto.CargoCode ?? 'F',
      StorageRequest: dto.StorageRequest ?? 'D',
      PackageTypeCode: dto.PackageTypeCode ?? '',

      FreightTonne: dto.FreightTonne
        ? new Prisma.Decimal(dto.FreightTonne)
        : null,

      NoOfPallets: dto.NoOfPallets ?? null,
      SLACIndicator: dto.SLACIndicator ?? '',
      ImporterCode: dto.ImporterCode ?? '',
      SerialNumber: dto.SerialNumber ?? null,
      UsedOrNew: dto.UsedOrNew ?? '',
      UNHSCode: dto.UNHSCode ?? '',
      UNNumber: dto.UNNumber ?? '',
      FlashPoints: dto.FlashPoints ?? null,
      TemperatureUnit: dto.TemperatureUnit ?? '',
      HazStorageRequest: dto.HazStorageRequest ?? '',
      RefrigerationRequired: dto.RefrigerationRequired ?? '',

      MinTemperature: dto.MinTemperature
        ? new Prisma.Decimal(dto.MinTemperature)
        : null,

      MaxTemperature: dto.MaxTemperature
        ? new Prisma.Decimal(dto.MaxTemperature)
        : null,

      RefTemperatureUnit: dto.RefTemperatureUnit ?? '',

      CreatedBy: dto.CreatedBy,
      UpdatedBy: dto.CreatedBy,
    },
  });
}

  async findAll() {
    return this.prisma.houseJobCustoms.findMany({
      where: { Status: 'A' },
      orderBy: { HouseJobCustomsSid: 'asc' },
    });
  }

  async findByHouseJobSid(houseJobSid: number) {
    return this.prisma.houseJobCustoms.findMany({
      where: { HouseJobSid: houseJobSid, Status: 'A' },
      orderBy: { HouseJobCustomsSid: 'asc' },
    });
  }

  async findByMasterJobSid(masterJobSid: number) {
    return this.prisma.houseJobCustoms.findMany({
      where: { MasterJobSid: masterJobSid, Status: 'A' },
      orderBy: { HouseJobCustomsSid: 'asc' },
    });
  }

  async findOne(id: number) {
    const customs = await this.prisma.houseJobCustoms.findUnique({
      where: { HouseJobCustomsSid: id },
    });

    if (!customs) throw new NotFoundException(`Customs ID ${id} not found`);
    return customs;
  }

  async update(id: number, dto: UpdateCustomsDto) {
  const existing = await this.findOne(id);

  const cleanDecimal = (value: any, oldValue: any) =>
    value === '' || value === undefined || value === null
      ? oldValue
      : new Prisma.Decimal(value);

  return this.prisma.houseJobCustoms.update({
    where: { HouseJobCustomsSid: id },
    data: {
      LineCode: dto.LineCode ?? existing.LineCode,
      VoyageAgentCode: dto.VoyageAgentCode ?? existing.VoyageAgentCode,
      RotationNumber: dto.RotationNumber ?? existing.RotationNumber,
      ManifestSequence: dto.ManifestSequence ?? existing.ManifestSequence,

      CargoCode: dto.CargoCode ?? existing.CargoCode,
      StorageRequest: dto.StorageRequest ?? existing.StorageRequest,
      PackageTypeCode: dto.PackageTypeCode ?? existing.PackageTypeCode,

      FreightTonne: cleanDecimal(dto.FreightTonne, existing.FreightTonne),
      NoOfPallets: dto.NoOfPallets ?? existing.NoOfPallets,
      SLACIndicator: dto.SLACIndicator ?? existing.SLACIndicator,
      ImporterCode: dto.ImporterCode ?? existing.ImporterCode,
      SerialNumber: dto.SerialNumber ?? existing.SerialNumber,
      UsedOrNew: dto.UsedOrNew ?? existing.UsedOrNew,
      UNHSCode: dto.UNHSCode ?? existing.UNHSCode,
      UNNumber: dto.UNNumber ?? existing.UNNumber,
      FlashPoints: dto.FlashPoints ?? existing.FlashPoints,
      TemperatureUnit: dto.TemperatureUnit ?? existing.TemperatureUnit,
      HazStorageRequest: dto.HazStorageRequest ?? existing.HazStorageRequest,
      RefrigerationRequired: dto.RefrigerationRequired ?? existing.RefrigerationRequired,

      MinTemperature: cleanDecimal(dto.MinTemperature, existing.MinTemperature),
      MaxTemperature: cleanDecimal(dto.MaxTemperature, existing.MaxTemperature),

      RefTemperatureUnit: dto.RefTemperatureUnit ?? existing.RefTemperatureUnit,

      UpdatedBy: dto.UpdatedBy ?? existing.UpdatedBy,
      UpdatedOn: new Date(),
    },
  });
}


  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.houseJobCustoms.update({
      where: { HouseJobCustomsSid: id },
      data: {
        Status: 'S',
        UpdatedOn: new Date(),
      },
    });
  }
}
