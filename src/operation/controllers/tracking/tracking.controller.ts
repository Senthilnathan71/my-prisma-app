import { Controller, Get, HttpCode, HttpStatus, Logger, Param, Query, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { TrackingService } from 'src/operation/services/tracking/tracking.service';

@Auth()
@ApiTags('Tracking')
@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly logger: Logger,
  ) {}

  @ApiOperation({ summary: 'Track shipment by any reference number' })
  @ApiCreatedResponse({ description: 'Tracking details fetched successfully', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Get('search/:referenceNo')
  search(@Param('referenceNo') referenceNo: string, @Query() query: any) {
    return this.wrap(() => this.trackingService.search(referenceNo, query), referenceNo);
  }

  @Get('booking/:bookingNo')
  getByBooking(@Param('bookingNo') bookingNo: string, @Query() query: any) {
    return this.wrap(() => this.trackingService.getByBooking(bookingNo, query), bookingNo);
  }

  @Get('hbl/:hblNo')
  getByHbl(@Param('hblNo') hblNo: string, @Query() query: any) {
    return this.wrap(() => this.trackingService.getByHbl(hblNo, query), hblNo);
  }

  @Get('mbl/:mblNo')
  getByMbl(@Param('mblNo') mblNo: string, @Query() query: any) {
    return this.wrap(() => this.trackingService.getByMbl(mblNo, query), mblNo);
  }

  @Get('container/:containerNo')
  getByContainer(@Param('containerNo') containerNo: string, @Query() query: any) {
    return this.wrap(() => this.trackingService.getByContainer(containerNo, query), containerNo);
  }

  @Get('job/:jobNo')
  getByJob(@Param('jobNo') jobNo: string, @Query() query: any) {
    return this.wrap(() => this.trackingService.getByJob(jobNo, query), jobNo);
  }

  @Get('document/:attachDocumentSid')
  async downloadDocument(@Param('attachDocumentSid') attachDocumentSid: string, @Res() response: any) {
    const file = await this.trackingService.getDocumentFile(Number(attachDocumentSid));
    return response.download(file.absolutePath, file.fileName);
  }

  private async wrap(handler: () => Promise<any>, referenceNo: string) {
    const response = new ResponseData();
    try {
      response.data = await handler();
      response.message = `Tracking details fetched for ${referenceNo}`;
    } catch (error) {
      this.logger.warn(`Tracking lookup failed for ${referenceNo}: ${error?.message || error}`);
      response.status = false;
      response.message = error?.message || 'Internal Server Error';
    }
    return response;
  }
}
