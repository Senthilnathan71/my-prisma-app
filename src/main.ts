import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  
  // swagger setup
  const options = new DocumentBuilder()
    .setTitle('CRM-MOBILE-API')
    .setDescription('CRM mobile application API')
    .addBearerAuth()
    .setVersion('1.0')
    .build()

  const document = SwaggerModule.createDocument(app,options);
  SwaggerModule.setup('api', app, document)

  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
