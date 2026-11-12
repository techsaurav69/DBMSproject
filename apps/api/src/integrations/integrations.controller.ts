import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { NearbyServicesService } from './nearby-services.service';
import { PlaceNameService } from './place-name.service';
import { LocalConditionsService } from './local-conditions.service';
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
  constructor(private readonly integrations: IntegrationsService, private readonly nearby: NearbyServicesService, private readonly places: PlaceNameService, private readonly conditions: LocalConditionsService) {}

  @Get('local-conditions')
  @ApiOperation({ summary: 'Get current modelled weather and US AQI for the live user location' })
  localConditions(@Query('latitude') latitude: string, @Query('longitude') longitude: string) {
    return this.conditions.current(latitude?.trim() ? Number(latitude) : NaN, longitude?.trim() ? Number(longitude) : NaN);
  }

  @Get('place-name')
  @ApiOperation({ summary: 'Resolve the user location to an approximate locality name' })
  placeName(@Query('latitude') latitude: string, @Query('longitude') longitude: string) {
    return this.places.reverse(latitude?.trim() ? Number(latitude) : NaN, longitude?.trim() ? Number(longitude) : NaN);
  }

  @Get('place-search')
  @ApiOperation({ summary: 'Search an explicitly submitted place name and let the reporter select the correct location' })
  placeSearch(@Query('query') query: string) { return this.places.search(query); }

  @Get('nearby-services')
  @ApiOperation({ summary: 'Find mapped rescue services within a radius of the map centre' })
  nearbyServices(@Query('latitude') latitude: string, @Query('longitude') longitude: string, @Query('radius') radius: string, @Query('category') category?: string) {
    return this.nearby.search(latitude?.trim() ? Number(latitude) : NaN, longitude?.trim() ? Number(longitude) : NaN, radius?.trim() ? Number(radius) : NaN, category);
  }

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
