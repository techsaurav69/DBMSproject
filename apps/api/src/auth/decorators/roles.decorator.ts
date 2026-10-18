import { SetMetadata } from '@nestjs/common';
import type { user_role_code } from '../role.types';

export const ROLES_KEY = 'requiredRoles';
export const Roles = (...requiredRoles: user_role_code[]) => SetMetadata(ROLES_KEY, requiredRoles);
