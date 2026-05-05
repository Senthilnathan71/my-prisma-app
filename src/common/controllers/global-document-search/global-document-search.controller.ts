import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { GlobalDocumentSearchService } from 'src/common/services/global-document-search/global-document-search.service';

@Auth()
@ApiTags('Global Document Search')
@Controller('global-search')
export class GlobalDocumentSearchController {
    constructor(private readonly searchService: GlobalDocumentSearchService) {}

    @ApiOperation({ summary: 'Search documents globally across bookings, jobs, enquiries, quotations, and vouchers' })
    @HttpCode(HttpStatus.OK)
    @Post('documents')
    async searchDocuments(
        @Body() payload: { search: string; CompanyMasterSid: number; BranchMasterSid: number; limit?: number },
    ) {
        const output = new ResponseData();
        try {
            output.data = await this.searchService.searchDocuments(payload);
            output.message = 'Search completed successfully';
        } catch (error) {
            output.status = false;
            output.message = error.message || 'Search failed';
        }
        return output;
    }
}
