import {
    IsArray,
    IsDate,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsIn,
    MaxLength,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Search for the house shipment(s) matching a HBL or MBL reference.
 * HBL usually resolves to a single house; MBL may resolve to many.
 */
export class MilestoneTrackerSearchDTO {
    @IsString()
    @IsNotEmpty({ message: 'Reference No is required' })
    @MaxLength(200)
    Ref: string;

    @IsString()
    @IsIn(['hbl', 'mbl', 'masterjob'], {
        message: 'Type must be hbl, mbl or masterjob',
    })
    Type: 'hbl' | 'mbl' | 'masterjob';

    @IsInt()
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    CompanyMasterSid: number;

    @IsInt()
    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    BranchMasterSid: number;
}

/**
 * Fetch the pending + completed milestones for a single resolved house shipment.
 */
export class MilestoneTrackerFetchDTO {
    @IsInt()
    @IsNotEmpty({ message: 'HouseJobSid is required' })
    HouseJobSid: number;

    @IsInt()
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    CompanyMasterSid: number;

    @IsInt()
    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    BranchMasterSid: number;
}

export class MilestoneTrackerSubmitItemDTO {
    @IsInt()
    @IsNotEmpty({ message: 'MilestoneMasterSid is required' })
    MilestoneMasterSid: number;

    @IsString()
    @IsNotEmpty({ message: 'MilestoneName is required' })
    @MaxLength(50)
    MilestoneName: string;

    @Type(() => Date)
    @IsDate({ message: 'MilestoneDate must be a valid date' })
    MilestoneDate: Date;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    Remarks?: string | null;
}

/**
 * Persist the milestones the user filled in on the "Pending" panel.
 * Only items carrying a date reach this DTO (the UI strips empty rows).
 */
export class MilestoneTrackerSubmitDTO {
    @IsOptional()
    @IsString()
    @MaxLength(50)
    ShipmentNo?: string;

    @IsInt()
    @IsNotEmpty({ message: 'HouseJobSid is required' })
    HouseJobSid: number;

    @IsOptional()
    @IsInt()
    BookingHeaderSid?: number | null;

    @IsInt()
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    CompanyMasterSid: number;

    @IsInt()
    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    BranchMasterSid: number;

    @IsString()
    @IsNotEmpty({ message: 'CreatedBy is required' })
    @MaxLength(100)
    CreatedBy: string;

    @IsArray()
    @ArrayMinSize(1, { message: 'At least one milestone is required' })
    @ValidateNested({ each: true })
    @Type(() => MilestoneTrackerSubmitItemDTO)
    Items: MilestoneTrackerSubmitItemDTO[];
}
