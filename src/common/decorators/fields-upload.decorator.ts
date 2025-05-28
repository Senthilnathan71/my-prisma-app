import { applyDecorators, UseInterceptors, Catch } from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
interface FileUploadConfig {
    fieldName: string;
    destinationKey?: string;
    maxFiles?: number;
    fileSize?: number; // Size in MB
}
export function FieldsUpload(fields: FileUploadConfig[]) {
    return applyDecorators(
        UseInterceptors(
            FileFieldsInterceptor(
                fields.map(({ fieldName, maxFiles }) => ({
                    name: fieldName,
                    maxCount: maxFiles ?? 1, // Default to 1 if not provided

                })),
                {
                    storage: diskStorage({
                        destination: (req, file, callback) => {
                            const configService = new ConfigService();
                            let path
                            if (file.fieldname == 'approvalFile')
                                path = 'APPROVAL_FILE_UPLOAD_PATH'
                            else if (file.fieldname == 'logo')
                                path = 'LOGO_FILE_UPLOAD_PATH'
                            const dest: any = configService.get(path);
                            callback(null, dest);
                        },
                        filename: (req, file, callback) => {
                            let convertedName: string = file.originalname;
                            convertedName = convertedName
                                .replace(/[^\w\s.]/g, '')
                                .replace(/\s+/g, '_');
                            const randomFourDigitNumber = Math.floor(
                                1000 + Math.random() * 9000 + 1000,
                            );
                            const fileExtension = convertedName.split('.').pop();
                            const newFilename = `${convertedName.split('.').slice(0, -1).join('.')}_${randomFourDigitNumber}.${fileExtension}`;
                            callback(null, newFilename);
                        },
                    }),
                    limits: {
                        fileSize: fields.reduce((acc, { fileSize }) => acc + (fileSize ?? 50) * 1024 * 1024, 0), // Total size in bytes 50MB
                    },
                },
            ),
        ),
        ApiConsumes('multipart/form-data'),
        ApiBody({
            schema: {
                type: 'object',
                properties: fields.reduce((acc, { fieldName }) => {
                    acc[fieldName] = {
                        type: 'array',
                        items: {
                            type: 'string',
                            format: 'binary',
                        },
                    };
                    return acc;
                }, {}),
            },
        }),
    );
}
