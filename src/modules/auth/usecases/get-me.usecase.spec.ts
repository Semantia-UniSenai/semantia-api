import { NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { GetMeUseCase } from './get-me.usecase';

describe('GetMeUseCase', () => {
  let useCase: GetMeUseCase;
  let users: jest.Mocked<UserRepository>;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    useCase = new GetMeUseCase(users);
  });

  it('returns the public profile of an existing user', async () => {
    // Arrange
    users.findById.mockResolvedValue(
      new User({
        id: 'user-1',
        name: 'Ana Souza',
        email: 'ana@semantia.app',
        passwordHash: 'hashed',
        role: UserRole.PROFESSOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    // Act
    const result = await useCase.execute('user-1');

    // Assert — passwordHash must never leak
    expect(result).toEqual({
      id: 'user-1',
      name: 'Ana Souza',
      email: 'ana@semantia.app',
      role: UserRole.PROFESSOR,
    });
  });

  it('throws NotFoundException when the user does not exist', async () => {
    // Arrange
    users.findById.mockResolvedValue(null);

    // Act / Assert
    await expect(useCase.execute('ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
