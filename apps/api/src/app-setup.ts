import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { loadAppConfig } from './config/app-config';

export function configureCrisisGridApplication(app: INestApplication): void {
  const config = loadAppConfig();
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: config.webOrigins });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CrisisGrid API')
    .setDescription('CrisisGrid coordination API. This deployment uses fictional data and is not an emergency service.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
}
