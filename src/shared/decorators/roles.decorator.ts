import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * @Roles(...) — declares which roles may hit a route. Enforced by
 * `RolesGuard`, which must run AFTER `JwtAuthGuard` (it reads the principal
 * the auth guard attached to the request).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
