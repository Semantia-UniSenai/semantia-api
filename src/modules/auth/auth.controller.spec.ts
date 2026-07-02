import { UserRole } from '../../shared/enums/user-role.enum';
import { AuthController } from './auth.controller';
import { AuthResponseDto, UserDto } from './dtos/auth-response.dto';
import { GetMeUseCase } from './usecases/get-me.usecase';
import { SignInUseCase } from './usecases/sign-in.usecase';
import { SignUpUseCase } from './usecases/sign-up.usecase';

describe('AuthController', () => {
  let controller: AuthController;
  let signUp: jest.Mocked<SignUpUseCase>;
  let signIn: jest.Mocked<SignInUseCase>;
  let getMe: jest.Mocked<GetMeUseCase>;

  beforeEach(() => {
    signUp = { execute: jest.fn() } as unknown as jest.Mocked<SignUpUseCase>;
    signIn = { execute: jest.fn() } as unknown as jest.Mocked<SignInUseCase>;
    getMe = { execute: jest.fn() } as unknown as jest.Mocked<GetMeUseCase>;
    controller = new AuthController(signUp, signIn, getMe);
  });

  it('delegates signup to SignUpUseCase', async () => {
    const dto = { name: 'Ana', email: 'a@a.com', password: 'secret1' };
    const response: AuthResponseDto = {
      accessToken: 't',
      user: { id: '1', name: 'Ana', email: 'a@a.com', role: UserRole.ALUNO },
    };
    signUp.execute.mockResolvedValue(response);

    await expect(controller.signUp(dto)).resolves.toBe(response);
    expect(signUp.execute).toHaveBeenCalledWith(dto);
  });

  it('delegates signin to SignInUseCase', async () => {
    const dto = { email: 'a@a.com', password: 'secret1' };
    signIn.execute.mockResolvedValue({} as AuthResponseDto);

    await controller.signIn(dto);
    expect(signIn.execute).toHaveBeenCalledWith(dto);
  });

  it('delegates me to GetMeUseCase with the current user id', async () => {
    const user: UserDto = {
      id: 'user-1',
      name: 'Ana',
      email: 'a@a.com',
      role: UserRole.ALUNO,
    };
    getMe.execute.mockResolvedValue(user);

    await expect(
      controller.getMe({
        userId: 'user-1',
        email: 'a@a.com',
        role: UserRole.ALUNO,
      }),
    ).resolves.toBe(user);
    expect(getMe.execute).toHaveBeenCalledWith('user-1');
  });
});
