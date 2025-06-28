import { applyDecorators, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";

export function FilesUploadInterceptor(
  fieldName: string,
  destinationKey: string,
  maxFiles = 10,
  fileSizeMB = 20
) {
  return applyDecorators(
    UseInterceptors(
      FilesInterceptor(fieldName, maxFiles, {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const configService = new ConfigService();
            const dest = configService.get(destinationKey);
            cb(null, dest);
          },
          filename: (req, file, cb) => {
            const name = file.originalname
              .replace(/[^\w\s.]/g, "")
              .replace(/\s+/g, "_");
            const ext = extname(file.originalname);
            const rand = Math.floor(1000 + Math.random() * 9000);
            cb(null, `${name.split(".")[0]}_${rand}${ext}`);
          },
        }),
        fileFilter: (req, file, cb) => {
          const allowedMimes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ];
          if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error("Only document files are allowed!"), false);
          }
        },
        limits: {
          fileSize: 1024 * 1024 * fileSizeMB,
        },
      })
    )
  );
}
