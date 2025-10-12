// decorators/dynamic-files-upload.decorator.ts
import { applyDecorators, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import * as fs from "fs";
import * as path from "path";

export function DynamicFilesUploadInterceptor(
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
            try {
              const configService = new ConfigService();
              const baseDestination = configService.get(destinationKey);
              
              // Check if base destination exists
              if (!baseDestination) {
                return cb(
                  new Error(`Configuration key "${destinationKey}" not found`),
                  ""
                );
              }

              // Get component name and record ID from request body
              const componentName = req.body.componentName; // e.g., "Lead"
              const recordId = req.body.recordId; // e.g., "11"

              if (!componentName || !recordId) {
                return cb(
                  new Error("componentName and recordId are required in the request body"),
                  ""
                );
              }

              // Create path: baseDestination/ComponentName/recordId/
              const fullPath = path.join(
                baseDestination,
                componentName,
                recordId.toString()
              );

              // Create directories if they don't exist
              if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
              }

              cb(null, fullPath);
            } catch (error) {
              cb(error as Error, "");
            }
          },
          filename: (req, file, cb) => {
            try {
              const name = file.originalname
                .replace(/[^\w\s.]/g, "")
                .replace(/\s+/g, "_");
              const ext = extname(file.originalname);
              const timestamp = Date.now();
              const rand = Math.floor(1000 + Math.random() * 9000);
              cb(null, `${name.split(".")[0]}_${timestamp}_${rand}${ext}`);
            } catch (error) {
              cb(error as Error, "");
            }
          },
        }),
        fileFilter: (req, file, cb) => {
          const allowedMimes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/csv",
            "image/jpeg",
            "image/png",
            "image/jpg",
          ];
          if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(
              new Error(
                "Only document and image files are allowed! (PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG)"
              ),
              false
            );
          }
        },
        limits: {
          fileSize: 1024 * 1024 * fileSizeMB,
        },
      })
    )
  );
}