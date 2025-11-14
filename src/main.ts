import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import { json, urlencoded } from 'express';

async function bootstrap() {


  //Dont comment this code and commit the code while merge
  const httpsOptions = {
    key: fs.readFileSync('/var/opt/npm-ssl/privkey.pem'),  // Update path
    cert: fs.readFileSync('/var/opt/npm-ssl/fullchain.pem'),   // Update path
  };



  //Dont comment this code and commit the code while merge
  const app = await NestFactory.create(AppModule,
    { httpsOptions }
  );


  // Use below for local test
  
  // const app = await NestFactory.create(AppModule,
  //   // {  }
  // );

  app.enableCors();
  app.use(json({ limit: '200mb' }));
  app.use(urlencoded({ extended: true, limit: '200mb' }));
  // swagger setup
  const options = new DocumentBuilder()
    .setTitle('CRM-MOBILE-API')
    .setDescription('CRM mobile application API')
    .addBearerAuth()
    .setVersion('1.0')
    .addTag('crm')
    .build()

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('documentation', app, document)

  app.enableCors();
  await app.listen(process.env.PORT ?? 3008);
}
bootstrap();
