import { Logger, Module } from '@nestjs/common';
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
import { VoucherService } from 'src/operation/services/voucher/voucher.service';
import { PaymentService } from './services/payment/payment.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';

@Module({
    controllers: [
        CoaController,
        SupplierTdsMappingController,
        SubledgermasterController,
        OutstandingController,
        ReceiptController,
        VoucherPostingController,
        JournalVoucherController,
        TrialBalanceController,
        AccountsReportsController,
        ManagementReportsController,
        PaymentController
    ],
    providers: [
        GlobalConfigService,
        CoaService,
        SupplierTdsMappingService,
        SubledgermasterService,
        OutstandingService,
        ReceiptService,
        PaymentService,
        VoucherPostingService,
        JournalVoucherService,
        TrialBalanceService,
        AccountsReportsService,
        ManagementReportsService,
        ReportExportService,
        Logger,
        VoucherService,
        CompanyConfigService
    ],
    exports: [AccountsReportsService]
})
export class AccountsModule { }
