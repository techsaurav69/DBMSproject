import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IntegrationsService, type AdvisoryEarthquakeFeed, type GdacsEvents, type NasaNaturalEvents, type OsirisHazards, type WeatherSnapshot } from './integrations.service';

@ApiTags('advisory data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator', 'coordinator', 'provider_operator', 'responder', 'citizen')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('weather')
  @ApiOperation({ summary: 'Get advisory weather for the fictional demo operations point' })
  weather(): Promise<WeatherSnapshot> { return this.integrations.weather(); }

  @Get('earthquakes')
  @ApiOperation({ summary: 'Get advisory global earthquake feed; not imported as incidents' })
  earthquakes(): Promise<AdvisoryEarthquakeFeed> { return this.integrations.earthquakes(); }

  @Get('osiris-hazards')
  @ApiOperation({ summary: 'Get normalized advisory global hazards from the public OSIRIS API' })
  osirisHazards(): Promise<OsirisHazards> { return this.integrations.osirisHazards(); }

  @Get('nasa-natural-events')
  @ApiOperation({ summary: 'Get NASA EONET open natural events; advisory data only' })
  nasaNaturalEvents(): Promise<NasaNaturalEvents> { return this.integrations.nasaNaturalEvents(); }

  @Get('gdacs-events')
  @ApiOperation({ summary: 'Get GDACS global disaster events; advisory data only' })
  gdacsEvents(): Promise<GdacsEvents> { return this.integrations.gdacsEvents(); }
}
