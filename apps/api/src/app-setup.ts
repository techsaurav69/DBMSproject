import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { loadAppConfig } from './config/app-config';
import { json, type NextFunction, type Request, type Response } from 'express';

export function configureCrisisGridApplication(app: INestApplication): void {
  const config = loadAppConfig();
  app.setGlobalPrefix('api/v1');
  // Two optional 512 KB raster images, encoded as JSON, only on community routes.
  const communityJson = json({ limit: '1500kb' });
  // Wrap the scoped parser so Nest still installs its default parser for all other routes.
  app.use('/api/v1/community', (request: Request, response: Response, next: NextFunction) => communityJson(request, response, next));
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
