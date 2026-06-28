import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/guards/jwt-auth.guard';
import { AuthResponseDto, UserDto } from './dtos/auth-response.dto';
import { SignInDto } from './dtos/sign-in.dto';
import { SignUpDto } from './dtos/sign-up.dto';
import { GetMeUseCase } from './usecases/get-me.usecase';
import { SignInUseCase } from './usecases/sign-in.usecase';
import { SignUpUseCase } from './usecases/sign-up.usecase';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly signUpUseCase: SignUpUseCase,
    private readonly signInUseCase: SignInUseCase,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  @Post('signup')
  @ApiOperation({ operationId: 'signUp', summary: 'Register a new account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  signUp(@Body() dto: SignUpDto): Promise<AuthResponseDto> {
    return this.signUpUseCase.execute(dto);
  }

  @Post('signin')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'signIn',
    summary: 'Authenticate and get a token',
  })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  signIn(@Body() dto: SignInDto): Promise<AuthResponseDto> {
    return this.signInUseCase.execute(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getMe', summary: 'Get the current user' })
  @ApiResponse({ status: 200, type: UserDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  getMe(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.getMeUseCase.execute(user.userId);
  }
}
