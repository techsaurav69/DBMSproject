import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CoordinationService, type CoordinationCandidates, type SupplyTracking } from './coordination.service';
import { DispatchVehicleDto, ReserveInventoryDto, ReserveShelterDto, UpdateAssignmentStatusDto } from './dto/coordination.dto';

@ApiTags('coordination')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator', 'coordinator', 'provider_operator', 'citizen')
@Controller('coordination')
export class CoordinationController {
  constructor(private readonly coordination: CoordinationService) {}
  @Get('requests/:id/candidates') @ApiOperation({ summary: 'Find nearby eligible vehicles and reservable local resources' })
  candidates(@Param('id') id: string, @Query('radiusMeters') radiusMeters?: string): Promise<CoordinationCandidates> { return this.coordination.candidates(id, radiusMeters); }
  @Post('dispatches') @ApiOperation({ summary: 'Dispatch one eligible vehicle through a row-locked transaction' })
  dispatch(@CurrentUser() actor: AuthenticatedUser, @Body() dto: DispatchVehicleDto) { return this.coordination.dispatch(actor, dto); }
  @Post('inventory-reservations') @ApiOperation({ summary: 'Reserve supply inventory through a row-locked transaction' })
  reserveInventory(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ReserveInventoryDto) { return this.coordination.reserveInventory(actor, dto); }
  @Post('shelter-reservations') @ApiOperation({ summary: 'Reserve shelter spaces through a row-locked transaction' })
  reserveShelter(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ReserveShelterDto) { return this.coordination.reserveShelter(actor, dto); }
  @Get('supply-tracking') @ApiOperation({ summary: 'Show active local vehicle deliveries with simulated progress' })
  supplyTracking(): Promise<SupplyTracking> { return this.coordination.supplyTracking(); }
  @Patch('assignments/:id/status') @ApiOperation({ summary: 'Advance a simulated local delivery status and record a vehicle location' })
  updateAssignmentStatus(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateAssignmentStatusDto) { return this.coordination.updateAssignmentStatus(actor, id, dto); }
}
