import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import { json, urlencoded } from 'express';

async function bootstrap() {

  const ENV = process.env.ENVIRONMENT || 'Development';
  let app;
  
  //Dont comment this code and commit the code while merge
  // const httpsOptions = {
  //   key: fs.readFileSync('/var/opt/npm-ssl/privkey.pem'),  // Update path
  //   cert: fs.readFileSync('/var/opt/npm-ssl/fullchain.pem'),   // Update path
  // };



  //Dont comment this code and commit the code while merge
  // app = await NestFactory.create(AppModule,
  //   { httpsOptions }
  // );

  console.log(`🚀 Starting Nest App in ${ENV} mode...`);

  if (ENV === 'Production') {
    // Path to your SSL certificate files
    const sslKeyPath = '/var/opt/npm-ssl/privkey.pem';
    const sslCertPath = '/var/opt/npm-ssl/fullchain.pem';

    // Validate file existence (optional but safe)
    if (!fs.existsSync(sslKeyPath) || !fs.existsSync(sslCertPath)) {
      console.error('❌ SSL certificate files missing!');
      process.exit(1);
    }

    const httpsOptions = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath),
    };

    // ---- PRODUCTION HTTPS ----
    app = await NestFactory.create(AppModule, { httpsOptions });
    console.log('🔐 HTTPS enabled for production');
  } else {
    // ---- DEVELOPMENT HTTP ----
    app = await NestFactory.create(AppModule);
    console.log('🌐 HTTP enabled for development');
  }


  // Use below for local test
  
  // const app = await NestFactory.create(AppModule,
  //   // {  }
  // );

  app.enableCors({
    origin: process.env.FRONTEND_DESKTOP_URL || process.env.FRONTEND_MOBILE_URL,
    credentials: true,
  });
  
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

  console.log(`LISTENING PORT IS ${process.env.PORT}}` );
  await app.listen(process.env.PORT ?? 3008);
}
bootstrap();
