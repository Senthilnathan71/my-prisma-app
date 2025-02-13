import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, isNotEmpty, IsOptional, IsString, isString } from "class-validator" 

export class LoginRequest{
    @ApiProperty({type: String, default: ''})
    @IsString()
    @IsNotEmpty()
    email: string

    @ApiProperty({type: String, default: ''})
    @IsString()
    @IsNotEmpty()
    password: string;
}