import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { PrismaUserRepository } from './repositories/prisma-user.repository';
import { UserRepository } from './repositories/user.repository';
import { GetMeUseCase } from './usecases/get-me.usecase';
import { SignInUseCase } from './usecases/sign-in.usecase';
import { SignUpUseCase } from './usecases/sign-up.usecase';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    SignUpUseCase,
    SignInUseCase,
    GetMeUseCase,
    { provide: UserRepository, useClass: PrismaUserRepository },
  ],
  // UserRepository is exported so the live gateway can resolve display names
  // for socket principals without re-binding the Prisma implementation.
  exports: [JwtModule, UserRepository],
})
export class AuthModule {}
