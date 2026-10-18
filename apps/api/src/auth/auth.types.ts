import type { user_role_code } from './role.types';

export type AuthenticatedUser = {
  email: string;
  roles: user_role_code[];
  sub: string;
};
