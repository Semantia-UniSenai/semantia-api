import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { GetMeUseCase } from './get-me.usecase';
import { SignInUseCase } from './sign-in.usecase';
import { SignUpUseCase } from './sign-up.usecase';

const repo = (): jest.Mocked<UserRepository> => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
});

const user = new User({
  id: 'user-1',
  name: 'Ana Souza',
  email: 'ana@semantia.app',
  passwordHash: bcrypt.hashSync('sup3rsecret', 4),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('account authentication without global roles', () => {
  it('signs up an account and emits no role claim', async () => {
    const users = repo();
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('jwt'),
    } as unknown as JwtService;
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(user);
    const result = await new SignUpUseCase(users, jwt).execute({
      name: ' Ana Souza ',
      email: 'ana@semantia.app',
      password: 'sup3rsecret',
    });
    expect(result.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    expect(jwt.signAsync as jest.Mock).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      kind: 'account',
    });
    expect(users.create.mock.calls[0][0]).not.toHaveProperty('role');
  });

  it('rejects duplicate signup', async () => {
    const users = repo();
    users.findByEmail.mockResolvedValue(user);
    await expect(
      new SignUpUseCase(users, {} as JwtService).execute({
        name: 'Ana',
        email: user.email,
        password: 'sup3rsecret',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('signs in with normalized email and no global role', async () => {
    const users = repo();
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('jwt'),
    } as unknown as JwtService;
    users.findByEmail.mockResolvedValue(user);
    const result = await new SignInUseCase(users, jwt).execute({
      email: ' ANA@SEMANTIA.APP ',
      password: 'sup3rsecret',
    });
    expect(result.user).not.toHaveProperty('role');
    expect(users.findByEmail).toHaveBeenCalledWith('ana@semantia.app');
  });

  it('uses one unauthorized response for unknown account or wrong password', async () => {
    const users = repo();
    users.findByEmail.mockResolvedValue(null);
    await expect(
      new SignInUseCase(users, {} as JwtService).execute({
        email: 'missing@semantia.app',
        password: 'wrongpass',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the account profile without a role', async () => {
    const users = repo();
    users.findById.mockResolvedValue(user);
    await expect(new GetMeUseCase(users).execute(user.id)).resolves.toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });
});
