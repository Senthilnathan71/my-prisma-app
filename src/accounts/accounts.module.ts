import { forwardRef, Logger, Module } from '@nestjs/common';
import { CoaController } from './controllers/coa/coa.controller';
import { CoaService } from './services/coa/coa.service';
import { SupplierTdsMappingController } from './controllers/supplier-tds-mapping/supplier-tds-mapping.controller';
import { SupplierTdsMappingService } from './services/supplier-tds-mapping/supplier-tds-mapping.service';
import { SubledgermasterController } from './controllers/subledgermaster/subledgermaster.controller';
import { SubledgermasterService } from './services/subledgermaster/subledgermaster.service';
import { OutstandingController } from './controllers/outstanding/outstanding.controller';
import { OutstandingService } from './services/outstanding/outstanding.service';
import { ReceiptController } from './controllers/receipt/receipt.controller';
import { ReceiptService } from './services/receipt/receipt.service';
import { PaymentController } from './controllers/payment/payment.controller';
import { VoucherPostingController } from './controllers/voucher-posting/voucher-posting.controller';
import { VoucherPostingService } from './services/voucher-posting/voucher-posting.service';
import { JournalVoucherController } from './controllers/journal-voucher/journal-voucher.controller';
import { JournalVoucherService } from './services/journal-voucher/journal-voucher.service';
import { TrialBalanceController } from './controllers/trial-balance/trial-balance.controller';
import { TrialBalanceService } from './services/trial-balance/trial-balance.service';
import { AccountsReportsController } from './controllers/accounts-reports/accounts-reports.controller';
import { AccountsReportsService } from './services/accounts-reports/accounts-reports.service';
import { ManagementReportsController } from './controllers/management-reports/management-reports.controller';
import { ManagementReportsService } from './services/management-reports/management-reports.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { ReportExportService } from 'src/common/services/report-export.service';
import { PdfmakeNodeService } from 'src/common/services/report-generators/pdfmake-node.service';
import { PaymentService } from './services/payment/payment.service';
import { BankReconciliationService } from './services/bank-reconciliation/bank-reconciliation.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { OperationModule } from 'src/operation/operation.module';
import { BankReconciliationController } from './controllers/bank-reconciliation/bank-reconciliation.controller';
import { InvoiceController } from './controllers/invoice/invoice.controller';
import { InvoiceService } from './services/invoice/invoice.service';
import { InvoiceNonJobController } from './controllers/invoice-non-job.controller';
import { InvoiceNonJobService } from './services/invoice-non-job.service';
import { CreditNoteNonJobController } from './controllers/credit-note-non-job/credit-note-non-job.controller';
import { CreditNoteNonJobService } from './services/credit-note-non-job/credit-note-non-job.service';
import { VoucherPeriodController } from './controllers/voucher-period/voucher-period.controller';
import { VoucherPeriodService } from './services/voucher-period/voucher-period.service';
import { EmailModule } from 'src/email/email.module';
import { DocumentService } from './services/document/document.service';
import { VendorInvoiceService } from './services/vendor-invoice/vendor-invoice.service';
import { CreditNoteService } from './services/credit-note/credit-note.service';
import { DocVendorInvoiceService } from './services/document/doc-vendorinvoice.service';
import { VendorCreditNoteService } from './services/vendor-credit-note/vendor-credit-note.service';
import { ReverseVoucherService } from './services/reverse-voucher/reverse-voucher.service';
import { VoucherMatchingService } from './services/voucher-matching/voucher-matching.service';
import { VoucherCorrectionService } from './services/voucher-correction/voucher-correction.service';
import { PaymentRequestService } from './services/payment-request/payment-request.service';
import { DocumentController } from './controllers/document/document.controller';
import { VoucherController } from './controllers/voucher/voucher.controller';
import { VendorInvoiceController } from './controllers/vendor-invoice/vendor-invoice.controller';
import { CreditNoteController } from './controllers/credit-note/credit-note.controller';
import { DocVendorInvoiceController } from './controllers/document/doc-vendorinvoice.controller';
import { VendorCreditNoteController } from './controllers/vendor-credit-note/vendor-credit-note.controller';
import { ReverseVoucherController } from './controllers/reverse-voucher/reverse-voucher.controller';
import { VoucherMatchingController } from './controllers/voucher-matching/voucher-matching.controller';
import { VoucherCorrectionController } from './controllers/voucher-correction/voucher-correction.controller';
import { PaymentRequestController } from './controllers/payment-request/payment-request.controller';
import { VoucherService } from './services/voucher/voucher.service';
import { SettingsModule } from 'src/settings/settings.module';
import { TdsCalculationService } from './services/tds-calculation/tds-calculation.service';
import { InterBranchController } from './controllers/inter-branch/inter-branch.controller';
import { InterBranchService } from './services/inter-branch/inter-branch.service';

@Module({
    imports: [
        EmailModule,
        forwardRef(() => SettingsModule),
        forwardRef(() => OperationModule)
    ],
    controllers: [
        InvoiceController,
        InvoiceNonJobController,
        CreditNoteNonJobController,
        CoaController,
        CreditNoteController,
        DocumentController,
        DocVendorInvoiceController,
        SupplierTdsMappingController,
        SubledgermasterController,
        OutstandingController,
        InterBranchController,
        ReceiptController,
        ReverseVoucherController,
        VoucherPostingController,
        JournalVoucherController,
        TrialBalanceController,
        AccountsReportsController,
        ManagementReportsController,
        PaymentController,
        PaymentRequestController,
        BankReconciliationController,
        VendorInvoiceController,
		VendorCreditNoteController,
        VoucherController,
        VoucherCorrectionController,
        VoucherMatchingController,
        VoucherPeriodController,
    ],
    providers: [
        DocumentService,
        GlobalConfigService,
        InvoiceService,
        InvoiceNonJobService,
        CreditNoteNonJobService,
        CoaService,
        CreditNoteService,
        DocVendorInvoiceService,
        SupplierTdsMappingService,
        SubledgermasterService,
        OutstandingService,
        InterBranchService,
        ReceiptService,
        PaymentService,
        BankReconciliationService,
        VoucherPostingService,
        JournalVoucherService,
        TrialBalanceService,
        AccountsReportsService,
        ManagementReportsService,
        PaymentRequestService,
        ReverseVoucherService,
        ReportExportService,
        PdfmakeNodeService,
        Logger,
        VoucherService,
        CompanyConfigService,
        VendorInvoiceService,
        VendorCreditNoteService,
        VoucherCorrectionService,
        VoucherMatchingService,
        VoucherPeriodService,
        TdsCalculationService
    ],
    exports: [AccountsReportsService, VoucherPeriodService, VoucherService, TdsCalculationService]
})
export class AccountsModule { }

