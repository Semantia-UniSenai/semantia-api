import { UserRole } from '../../../shared/enums/user-role.enum';

/**
 * Domain representation of a user. Plain class — no Prisma coupling.
 * Repository implementations map Prisma rows into this shape inline.
 */
export class User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: User) {
    Object.assign(this, props);
  }
}
