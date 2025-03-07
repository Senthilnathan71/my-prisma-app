import { Controller } from "@nestjs/common";
import { Auth } from "src/common/decorators/auth.decorator";
import { QuotationService } from "src/masters/services/quotation/quotation.service";

@Controller('enquiry')
@Auth()
export class QuotationController {
    constructor(private quotationService: QuotationService) { }

}