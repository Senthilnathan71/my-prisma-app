import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";

@Injectable()
export class QuotationService {
    constructor(
        private _db: DatabaseService
    ) { }
}