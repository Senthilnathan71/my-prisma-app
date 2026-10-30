import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean, IsNotEmpty, isNotEmpty, IsOptional, IsString, isString } from "class-validator"

export class LoginRequest{
    @ApiProperty({type: String, default: ''})
    @IsString()
    @IsNotEmpty()
    email: string

    @ApiProperty({type: String, default: ''})
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiProperty({type: String, default: ''})
    @IsString()
    @IsNotEmpty()
    projectType:string

    @ApiProperty({ type: String, default: 'default', required: false })
    @IsOptional()
    @IsString()
    screenId?: string;

    @ApiProperty({type: String, default: ''})
    @IsString()
    location?: string;

    @ApiProperty({ type: Boolean, default: false, required: false })
    @IsOptional()
    @IsBoolean()
    forceLogin?: boolean;
}