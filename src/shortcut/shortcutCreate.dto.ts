import { ShortCut } from "@prisma/client";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class ShortcutDto implements Omit<ShortCut, 'shortCutId' | 'userId' | 'createdOn' | 'updatedOn' | 'status' | 'deletedAt'> {

    @IsString()
    @IsOptional()
    description:string;

    @IsString()
    label: string;

    @IsString()
    link: string;

    @IsBoolean()
    useRouter: boolean;
}

export class  ShortCutUpdateDto extends ShortcutDto {}