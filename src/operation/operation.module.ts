import { Logger, Module } from '@nestjs/common';
import { BookingController } from './controllers/booking/booking.controller';
import { BookingService } from './services/booking/booking.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { OperationCommonController } from './controllers/operation-common/operation-common.controller';
import { OperationCommonService } from './services/operation-common/operation-common.service';
import { CurrencyExchangeService } from 'src/masters/services/currency-exchange/currency-exchange.service';
import { MasterJobController } from './controllers/master-job/master-job.controller';
import { MasterJobService } from './services/master-job/master-job.service';
import { CargoreceiptService } from './services/cargoreceipt/cargoreceipt.service';
import { CargoreceiptController } from './controllers/cargoreceipt/cargoreceipt.controller';
import { EmailService } from 'src/email/email.service';
import { LoadingPlanController } from './controllers/loading-plan/loading-plan.controller';
import { LoadingPlanService } from './services/loading-plan/loading-plan.service';
import { MergeBookingController } from './controllers/merge-booking/merge-booking.controller';
import { MergeBookingService } from './services/merge-booking/merge-booking.service';
import { InvoiceService } from './services/invoice/invoice.service';
import { InvoiceController } from './controllers/invoice/invoice.controller';
import { DocumentController } from './controllers/document/document.controller';
import { DocumentService } from './services/document/document.service';
import { ManifestDocumentController } from './controllers/manifest-document/manifest-document.controller';
import { ManifestDocumentService } from './services/manifest-document/manifest-document.service';
import { HouseJobController } from './controllers/house-job/house-job.controller';
import { HouseJobService } from './services/house-job/house-job.service';
import { SplitbookingService } from './services/splitbooking/splitbooking.service';
import { SplitbookingController } from './controllers/splitbooking/splitbooking.controller';
import { VoucherService } from './services/voucher/voucher.service';
import { VoucherController } from './controllers/voucher/voucher.controller';
import { VendorInvoiceService } from './services/vendor-invoice/vendor-invoice.service';
import { VendorInvoiceController } from './controllers/vendor-invoice/vendor-invoice.controller';
import { ExcelParserService } from 'src/common/services/excel-parser/excel-parser.service';
import { CreditRequestService } from './services/credit-request/credit-request.service';
import { CreditRequestController } from './controllers/credit-request/credit-request.controller';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { ServiceJobService } from './services/service-job/service-job.service';
import { ServiceJobController } from './controllers/service-job/service-job.controller';
import { CommonModule } from 'src/common/common.module';
import { CreditNoteService } from './services/credit-note/credit-note.service';
import { CreditNoteController } from './controllers/credit-note/credit-note.controller';
import { DocVendorInvoiceService } from './services/document/doc-vendorinvoice.service';
import { DocVendorInvoiceController } from './controllers/document/doc-vendorinvoice.controller';
import { OperationReportsController } from './controllers/operation-reports/operation-reports.controller';
import { OperationReportsService } from './services/operation-reports/operation-reports.service';
import { ReportExportService } from 'src/common/services/report-export.service';
import { BoeController } from './controllers/boe/boe.controller';
import { BoeService } from './services/boe/boe.service';
import { VendorCreditNoteService } from './services/vendor-credit-note/vendor-credit-note.service';
import { VendorCreditNoteController } from './controllers/vendor-credit-note/vendor-credit-note.controller';
import { VehicleController } from './controllers/vehicle/vehicle.controller';
import { CustomsController } from './controllers/customs/customs.controller';
import { VehicleService } from './services/vehicle/vehicle.service';
import { CustomsService } from './services/customs/customs.service';
import { ReverseVoucherService } from './services/reverse-voucher/reverse-voucher.service';
import { ReverseVoucherController } from './controllers/reverse-voucher/reverse-voucher.controller';
import { EDIManifestService } from './services/edi-manifest/edi-manifest.service';
import { VoucherMatchingService } from './services/voucher-matching/voucher-matching.service';
import { VoucherMatchingController } from './controllers/voucher-matching/voucher-matching.controller';
import { ShipmentMilestoneController } from './controllers/shipment-milestone/shipment-milestone.controller';
import { ShipmentMilestoneService } from './services/shipment-milestone/shipment-milestone.service';
import { SettingsModule } from 'src/settings/settings.module';
import { VoucherPeriodService } from 'src/masters/services/voucher-period/voucher-period.service';
import { OutstandingService } from 'src/accounts/services/outstanding/outstanding.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { VoucherCorrectionController } from './controllers/voucher-correction/voucher-correction.controller';
import { VoucherCorrectionService } from './services/voucher-correction/voucher-correction.service';
import { AgentMasterAirWaybillService } from './services/agent-master-air-waybill/agent-master-air-waybill.service';
import { AgentMasterAirWaybillController } from './controllers/agent-master-air-waybill/agent-master-air-waybill.controller';

@Module({
        imports: [CommonModule, SettingsModule],
        providers: [
                Logger,
                EmailService,
                GlobalConfigService,
                BookingService,
                OperationCommonService,
                CurrencyExchangeService,
                MasterJobService,
                CargoreceiptService,
                LoadingPlanService,
                InvoiceService,
                DocumentService,
                ManifestDocumentService,
                MergeBookingService,
                HouseJobService,
                SplitbookingService,
                VoucherService,
                VendorInvoiceService,
                ExcelParserService,
                CreditRequestService,
                MenuService,
                ServiceJobService,
                CreditNoteService,
                DocVendorInvoiceService,
                OperationReportsService,
                ReportExportService,
                BoeService,
                VendorCreditNoteService,
                VehicleService,
                CustomsService,
                ReverseVoucherService,
                EDIManifestService,
                VoucherMatchingService,
                ShipmentMilestoneService,
                VoucherPeriodService,
                OutstandingService,
                CompanyConfigService,
                VoucherCorrectionService,
                AgentMasterAirWaybillService,
        ],
        controllers: [
                BookingController,
                OperationCommonController,
                MasterJobController,
                CargoreceiptController,
                LoadingPlanController,
                InvoiceController,
                ManifestDocumentController,
                MergeBookingController,
                DocumentController,
                HouseJobController,
                SplitbookingController,
                VoucherController,
                VendorInvoiceController,
                CreditRequestController,
                ServiceJobController,
                CreditNoteController,
                DocVendorInvoiceController,
                OperationReportsController,
                BoeController,
                VendorCreditNoteController,
                VehicleController,
                CustomsController,
                ReverseVoucherController,
                VoucherMatchingController,
                ShipmentMilestoneController,
                VoucherCorrectionController,
                AgentMasterAirWaybillController
        ]
})
export class OperationModule { }
