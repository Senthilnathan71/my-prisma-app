import { IsNotEmpty, IsString } from "class-validator";

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    userName: string

    @IsString()
    @IsNotEmpty()
    userEmail: string

    @IsString()
    @IsNotEmpty()
    userPassword: string

    @IsString()
    @IsNotEmpty()
    CountryMasterSid: number
}