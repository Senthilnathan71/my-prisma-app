import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class DuplicateCheckDTO {
  @IsNotEmpty({ message: 'CompanyMasterSid is required}' })
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty({ message: 'BranchMasterSid is required' })
  @IsInt()
  BranchMasterSid: number;

  @IsNotEmpty({ message: 'DepartmentMasterSid is required' })
  @IsInt()
  DepartmentMasterSid: number;

  @IsNotEmpty({ message: 'BookingDateTime is required' })
  BookingDateTime: Date;

  @IsNotEmpty({ message: 'CustomerMasterSid is required' })
  @IsInt()
  CustomerMasterSid: number;

  @IsNotEmpty({ message: 'POL is required' })
  @IsString()
  @Length(3, 5)
  POL: string;

  @IsNotEmpty({ message: 'POD is required}' })
  @IsString()
  @Length(3, 5)
  POD: string;

  @IsOptional()
  @IsBoolean()
  isEditMode: boolean;

  @ValidateIf((o) => o.isEditMode === true)
  @IsNotEmpty({ message: 'BookingHeaderSid is required in edit mode' })
  @IsInt()
  BookingHeaderSid?: number;
}
