import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SearchListDto {
    @IsString()
    searchType: string

    @IsString()
    filterValue: string;
}
