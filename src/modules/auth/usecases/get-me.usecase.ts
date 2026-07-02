import { Injectable, NotFoundException } from '@nestjs/common';
import { UserDto } from '../dtos/auth-response.dto';
import { UserRepository } from '../repositories/user.repository';

/**
 * GetMe — resolves the authenticated user's public profile from their id.
 * Throws 404 if the token references a user that no longer exists.
 */
@Injectable()
export class GetMeUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
