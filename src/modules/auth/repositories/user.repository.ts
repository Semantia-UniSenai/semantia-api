import { User } from '../entities/user.entity';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}

export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
  abstract create(data: CreateUserData): Promise<User>;
}
