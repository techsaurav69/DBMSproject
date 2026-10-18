import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

type UserSummary = { displayName: string; email: string; id: string; roles: string[] };

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @Roles('administrator')
  @ApiOperation({ summary: 'List user identities and roles for local administration' })
  @ApiForbiddenResponse({ description: 'Administrator role required.' })
  async listUsers(): Promise<UserSummary[]> {
    const result = await this.database.query<{
      display_name: string;
      email: string;
      id: string;
      roles: string[];
    }>(`SELECT u.id, u.email, u.display_name,
        coalesce(array_agg(ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), ARRAY[]::user_role_code[])::text[] AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at ASC`);
    return result.rows.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      roles: user.roles,
    }));
  }
}
