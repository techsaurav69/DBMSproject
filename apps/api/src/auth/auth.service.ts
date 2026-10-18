import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedUser } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { user_role_code } from './role.types';

type UserRow = {
  display_name: string;
  email: string;
  id: string;
  password_hash: string;
  roles: user_role_code[];
};

export type AuthResponse = {
  accessToken: string;
  user: Omit<AuthenticatedUser, 'sub'> & { id: string; displayName: string };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.findUserByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.createAuthResponse(user);
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const inserted = await client.query<Pick<UserRow, 'display_name' | 'email' | 'id' | 'password_hash'>>(
        `INSERT INTO users (email, display_name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name, password_hash`,
        [dto.email.trim().toLowerCase(), dto.displayName.trim(), passwordHash],
      );
      const user = inserted.rows[0];
      await client.query('INSERT INTO user_roles (user_id, role_code) VALUES ($1, $2)', [user.id, 'citizen']);
      await client.query('COMMIT');
      return this.createAuthResponse({ ...user, roles: ['citizen'] });
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrentUser(userId: string): Promise<AuthResponse['user']> {
    const result = await this.database.query<UserRow>(this.userQuery('WHERE u.id = $1'), [userId]);
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('The account linked to this token is unavailable.');
    return this.toPublicUser(user);
  }

  private async findUserByEmail(email: string): Promise<UserRow | undefined> {
    const result = await this.database.query<UserRow>(this.userQuery('WHERE u.email = $1'), [email.trim().toLowerCase()]);
    return result.rows[0];
  }

  private userQuery(condition: string): string {
    return `SELECT u.id, u.email, u.display_name, u.password_hash,
      coalesce(array_agg(ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), ARRAY[]::user_role_code[])::text[] AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      ${condition}
      GROUP BY u.id`;
  }

  private async createAuthResponse(user: UserRow): Promise<AuthResponse> {
    const principal: AuthenticatedUser = { sub: user.id, email: user.email, roles: user.roles };
    return { accessToken: await this.jwtService.signAsync(principal), user: this.toPublicUser(user) };
  }

  private toPublicUser(user: UserRow): AuthResponse['user'] {
    return { id: user.id, email: user.email, displayName: user.display_name, roles: user.roles };
  }

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}
