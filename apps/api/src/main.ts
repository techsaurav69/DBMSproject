import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadAppConfig } from './config/app-config';
import { configureCrisisGridApplication } from './app-setup';

async function bootstrap(): Promise<void> {
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule);
  configureCrisisGridApplication(app);

  await app.listen(config.port);
}

void bootstrap();

