import {
    IsInt,
    IsString,
    IsOptional,
    IsDate,
    IsNotEmpty,
    MaxLength,
    IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export class ShipmentMilestoneCreateDTO {

    @IsString()
    @IsNotEmpty({ message: 'Shipment No is required' })
    @MaxLength(20)
    ShipmentNo: string;

    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    @IsInt()
    CompanyMasterSid: number;

    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    @IsInt()
    BranchMasterSid: number;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    CreatedOn?: Date;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    CreatedBy: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    UpdatedOn?: Date | null;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    UpdatedBy?: string | null;

    @IsOptional()
    @IsString()
    @IsIn(['A', 'S', 'D'], {
        message: 'Status must be Active(A), Suspended(S), or Deleted(D)'
    })
    Status?: string | null;

    @IsInt()
    @IsNotEmpty({ message: 'MilestoneMasterSid is required' })
    MilestoneMasterSid: number;

    @IsString()
    @IsNotEmpty({ message: 'MilestoneName is required' })
    @MaxLength(50)
    MilestoneName: string;

    @Type(() => Date)
    @IsDate()
    MilestoneDate: Date;

    @IsString()
    @IsIn(['Y', 'N'], {
        message: 'AutoCapture must be Yes(Y) or No(N)'
    })
    AutoCaptured: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    Remarks?: string | null;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    deletedAt?: Date | null;

    @IsOptional()
    @IsInt()
    HouseJobSid?: number | null;

    @IsOptional()
    @IsInt()
    BookingHeaderSid?: number | null;
}

export class ShipmentMilestoneFetchDTO {
    @IsNotEmpty({ message: 'Shipment No is required' })
    @MaxLength(20)
    ShipmentNo: string;

    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    @IsInt()
    CompanyMasterSid: number;

    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    @IsInt()
    BranchMasterSid: number;
}

export class ShipmentMilestoneResponseDTO extends PartialType(ShipmentMilestoneCreateDTO) {
    @IsNotEmpty({ message: 'ShipmentMilestoneSid is required' })
    @IsInt()
    ShipmentMilestoneSid: number;
}

export class ShipmentMilestoneUpdateDTO extends PartialType(ShipmentMilestoneCreateDTO) {
    @IsString()
    @IsNotEmpty({ message: 'UpdatedBy is required for update' })
    @MaxLength(100)
    UpdatedBy: string;
}

export class ShipmentMilestoneFetchWithCodeDTO {
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    @IsInt()
    CompanyMasterSid: number;

    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    @IsInt()
    BranchMasterSid: number;

    @IsNotEmpty({ message: 'Department Name is required' })
    @IsString()
    DepartmentName: string;

    @IsNotEmpty({ message: 'Job Type is required' })
    @IsString()
    @IsIn(['Transhipment', 'Export', 'Import'], {
        message: 'Job Type must be Transhipment, Export or Import'
    })
    JobType: string;

    @IsNotEmpty({ message: 'Milestone Code is required' })
    @IsString()
    @MaxLength(30)
    MilestoneCode: string;
}

export class ShipmentMilestoneCheckExistDTO {
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    @IsInt()
    CompanyMasterSid: number;

    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    @IsInt()
    BranchMasterSid: number;

    @IsNotEmpty({ message: 'Shipment No is required' })
    @IsString()
    @MaxLength(20)
    ShipmentNo: string;

    @IsNotEmpty({ message: 'MilestoneMasterSid is required' })
    @IsInt()
    MilestoneMasterSid: number;
}

export class ShipmentMilestoneSafeInsertDTO {
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    @IsInt()
    CompanyMasterSid: number;

    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    @IsInt()
    BranchMasterSid: number;

    @IsNotEmpty({ message: 'Department Name is required' })
    @IsString()
    @MaxLength(50)
    DepartmentName: string;

    @IsNotEmpty({ message: 'Job Type is required' })
    @IsString()
    @IsIn(['Transhipment', 'Export', 'Import'], {
        message: 'Job Type must be Transhipment, Export or Import'
    })
    JobType: string;

    @IsNotEmpty({ message: 'createdBy is required' })
    @IsString()
    @MaxLength(100)
    createdBy: string;

    @IsNotEmpty({ message: 'Milestone Code is required' })
    @IsString()
    @MaxLength(30)
    MilestoneCode: string;

    @IsNotEmpty({ message: 'Shipment No is required' })
    @IsString()
    @MaxLength(50)
    ShipmentNo: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    MilestoneDate?: Date;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    Remarks?: string | null;

    @IsOptional()
    @IsInt()
    BookingHeaderSid?: number | null;   // anchor booking-stage milestones (e.g. EXDO) on the booking
}

export class ShipmentMilestoneInsertByMasterJobDTO {
    @IsNotEmpty({ message: 'MasterJobSid is required' })
    @IsInt()
    MasterJobSid: number;

    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    @IsInt()
    CompanyMasterSid: number;

    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    @IsInt()
    BranchMasterSid: number;

    @IsNotEmpty({ message: 'Milestone Code is required' })
    @IsString()
    @MaxLength(30)
    MilestoneCode: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    MilestoneDate?: Date;

    @IsNotEmpty({ message: 'createdBy is required' })
    @IsString()
    @MaxLength(100)
    createdBy: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    Remarks?: string | null;
}
