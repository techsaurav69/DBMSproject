import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { NearbyServicesService } from './nearby-services.service';
import { PlaceNameService } from './place-name.service';

@Module({ imports: [AuthModule], controllers: [IntegrationsController], providers: [IntegrationsService, NearbyServicesService, PlaceNameService], exports: [IntegrationsService] })
export class IntegrationsModule {}
