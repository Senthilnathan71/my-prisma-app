import { forwardRef, Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
import { ManifestDocumentController } from './controllers/manifest-document/manifest-document.controller';
import { ManifestDocumentService } from './services/manifest-document/manifest-document.service';
import { HouseJobController } from './controllers/house-job/house-job.controller';
import { HouseJobService } from './services/house-job/house-job.service';
import { SplitbookingService } from './services/splitbooking/splitbooking.service';
import { SplitbookingController } from './controllers/splitbooking/splitbooking.controller';
import { ExcelParserService } from 'src/common/services/excel-parser/excel-parser.service';
import { CreditRequestService } from './services/credit-request/credit-request.service';
import { CreditRequestController } from './controllers/credit-request/credit-request.controller';
import { MenuService } from 'src/settings/services/menu/menu.service';
import { ServiceJobService } from './services/service-job/service-job.service';
import { ServiceJobController } from './controllers/service-job/service-job.controller';
import { CommonModule } from 'src/common/common.module';
import { OperationReportsController } from './controllers/operation-reports/operation-reports.controller';
import { OperationReportsService } from './services/operation-reports/operation-reports.service';
import { ReportExportService } from 'src/common/services/report-export.service';
import { PdfmakeNodeService } from 'src/common/services/report-generators/pdfmake-node.service';
import { BoeController } from './controllers/boe/boe.controller';
import { BoeService } from './services/boe/boe.service';
import { VehicleController } from './controllers/vehicle/vehicle.controller';
import { CustomsController } from './controllers/customs/customs.controller';
import { VehicleService } from './services/vehicle/vehicle.service';
import { CustomsService } from './services/customs/customs.service';
import { EDIManifestService } from './services/edi-manifest/edi-manifest.service';
import { ShipmentMilestoneController } from './controllers/shipment-milestone/shipment-milestone.controller';
import { ShipmentMilestoneService } from './services/shipment-milestone/shipment-milestone.service';
import { SettingsModule } from 'src/settings/settings.module';
import { OutstandingService } from 'src/accounts/services/outstanding/outstanding.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { AgentMasterAirWaybillService } from './services/agent-master-air-waybill/agent-master-air-waybill.service';
import { AgentMasterAirWaybillController } from './controllers/agent-master-air-waybill/agent-master-air-waybill.controller';
import { ProRateService } from './services/pro-rate/pro-rate.service';
import { ProRateController } from './controllers/pro-rate/pro-rate.controller';
import { ShippingInstructionService } from './services/shipping-instruction/shipping-instruction.service';
import { ShippingInstructionController } from './controllers/shipping-instruction/shipping-instruction.controller';
import { AccountsModule } from 'src/accounts/accounts.module';
import { AuditLogService } from './services/audit-log/audit-log.service';
import { AuditLogController } from './controllers/audit-log/audit-log.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrackingController } from './controllers/tracking/tracking.controller';
import { TrackingService } from './services/tracking/tracking.service';

@Module({
	imports: [
		CommonModule,
		forwardRef(() => SettingsModule),
		forwardRef(() => AccountsModule),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => {

				const secret = configService.get<string>('JWT_SECRET');

				if (!secret) {
					throw new Error('❌ JWT_SECRET is not defined in environment variables');
				}
				return {
					secret,
					signOptions: {
						expiresIn: '3h',
					},
				};
			},
			inject: [ConfigService],
		}),
	],
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
		ManifestDocumentService,
		MergeBookingService,
		HouseJobService,
		SplitbookingService,
		ExcelParserService,
		CreditRequestService,
		MenuService,
		ServiceJobService,
		OperationReportsService,
		ReportExportService,
		PdfmakeNodeService,
		BoeService,
		VehicleService,
		CustomsService,
		EDIManifestService,
		ShipmentMilestoneService,
		OutstandingService,
		CompanyConfigService,
		AgentMasterAirWaybillService,
		ProRateService,
		ShippingInstructionService,
		AuditLogService,
		TrackingService,
	],
	controllers: [
		BookingController,
		OperationCommonController,
		MasterJobController,
		CargoreceiptController,
		LoadingPlanController,
		ManifestDocumentController,
		MergeBookingController,
		HouseJobController,
		SplitbookingController,
		CreditRequestController,
		ServiceJobController,
		OperationReportsController,
		BoeController,
		VehicleController,
		CustomsController,
		ShipmentMilestoneController,
		AgentMasterAirWaybillController,
		ProRateController,
		ShippingInstructionController,
		AuditLogController,
		TrackingController
	],
	exports: [ProRateService]
})
export class OperationModule { }
