import { User } from '../entities/user.entity';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}

/**
 * UserRepository — abstract contract usecases depend on. Registered as a DI
 * token (abstract class) so the Prisma implementation can be swapped without
 * touching business logic.
 */
export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
  abstract create(data: CreateUserData): Promise<User>;
}
