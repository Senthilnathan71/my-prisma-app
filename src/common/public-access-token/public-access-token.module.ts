import { Global, Module } from '@nestjs/common';
import { PublicAccessTokenService } from './public-access-token.service';

@Global()
@Module({
  providers: [PublicAccessTokenService],
  exports: [PublicAccessTokenService],
})
export class PublicAccessTokenModule {}
