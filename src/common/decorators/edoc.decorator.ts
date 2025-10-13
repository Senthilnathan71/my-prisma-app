import { applyDecorators, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

export function DynamicFilesUploadInterceptor(
  fieldName: string,
  maxFiles = 10,
  fileSizeMB = 20
) {
  return applyDecorators(
    UseInterceptors(
      FilesInterceptor(fieldName, maxFiles, {
        storage: memoryStorage(), // Store files in memory first
        limits: {
          fileSize: 1024 * 1024 * fileSizeMB,
        },
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
      })
    )
  );
}
