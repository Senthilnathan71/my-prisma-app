import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // const httpsOptions = {
  //   key: fs.readFileSync('/var/opt/npm-ssl/privkey.pem'),  // Update path
  //   cert: fs.readFileSync('/var/opt/npm-ssl/fullchain.pem'),   // Update path
  // };
  // console.log("httpOptions::",httpsOptions);



  // const app = await NestFactory.create(AppModule, { httpsOptions });

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
  await app.listen(process.env.PORT ?? 3008);
}
bootstrap();
