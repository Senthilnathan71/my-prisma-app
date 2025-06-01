import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { ProductService } from 'src/masters/services/product/product.service';



@Controller('product')
export class ProductController {
    constructor(private productService: ProductService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Product' })
    @ApiCreatedResponse({
        description: 'Create new Product',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewProduct(@Body() newData:any) {
        let resp = new ResponseData();
        try {
            let res = await this.productService.createNewProduct(newData);
            this.logger.log(`New Product Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Product is successfully created"
        } catch (error) {
            this.logger.warn(`Product Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Products' })
    @ApiCreatedResponse({
        description: 'Get All Products',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllProduct() {
        let resp = new ResponseData();
        try {
            let res = await this.productService.getAllProducts();
            this.logger.log(`All Products Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Products are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Products Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Product by Id' })
    @ApiCreatedResponse({
        description: 'Get Product by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:ProductMasterSId')
    async getProductById(@Param('ProductMasterSId', ParseIntPipe) ProductMasterSId: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Product with id : ${ProductMasterSId}`);
            let res = await this.productService.fetchProductById(ProductMasterSId);
            this.logger.debug(`Fetched Product : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Product with id : ${ProductMasterSId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Product by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Product by Id' })
    @ApiCreatedResponse({
        description: 'Update Product by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:ProductMasterSid')
    async updateProductById(@Param('ProductMasterSid', ParseIntPipe) ProductMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Product with id : ${ProductMasterSid}`);
            let res = await this.productService.updateProductById(ProductMasterSid, payload);
            this.logger.debug(`Updated Product : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Product with id : ${ProductMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Product Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Product by Id' })
    @ApiCreatedResponse({
        description: 'Delete Product by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:ProductMasterSId')
    async deleteProductById(@Param('ProductMasterSId', ParseIntPipe) ProductMasterSId: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Product with id : ${ProductMasterSId}`);
            let res = await this.productService.deleteProduct(ProductMasterSId);
            this.logger.debug(`Deleted Product : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Product with id : ${ProductMasterSId} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Product Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Products' })
    @ApiCreatedResponse({
        description: 'Search List of Products',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchProducts(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.productService.searchProducts(searchData);
            this.logger.log(`Products Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Products Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Products Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

}