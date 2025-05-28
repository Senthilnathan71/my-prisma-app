import { applyDecorators, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";

export function FilesUploadInterceptor(
    fieldName: string,
    destinationKey: string,
    maxFiles: number = 20,
    fileSize = 500 //MB
) {
    return applyDecorators(
        UseInterceptors(
            FilesInterceptor(fieldName, maxFiles, {
                storage: diskStorage({
                    destination: (req, file, callback) => {
                        const configService = new ConfigService();
                        const dest: any = configService.get(destinationKey);
                        callback(null, dest);
                    },
                    filename: (req, file, callback) => {
                        let convertedName: string = file.originalname;
                        convertedName = convertedName.replace(/[^\w\s.]/g, '')
                            .replace(/\s+/g, '_');
                        const randomFourDigitNumber = Math.floor(
                            1000 + Math.random() * 9000 + 1000,
                        );
                        const fileExtension = convertedName.split('.').pop();
                        const newFileName = `${convertedName.split('.').slice(0, -1).join('.')}_${randomFourDigitNumber}.${fileExtension}`
                        callback(null, `${newFileName}`)
                    }
                }),
                limits: {
                    fieldSize: 1024 * 1024 * fileSize
                }
            })
        )
    )
}