import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassesController } from './classes.controller';
import { ClassRepository } from './repositories/class.repository';
import { PrismaClassRepository } from './repositories/prisma-class.repository';
import { CreateClassUseCase } from './usecases/create-class.usecase';
import { GetClassUseCase } from './usecases/get-class.usecase';
import { JoinClassUseCase } from './usecases/join-class.usecase';
import { ListClassesUseCase } from './usecases/list-classes.usecase';
import { RemoveMemberUseCase } from './usecases/remove-member.usecase';

@Module({
  imports: [AuthModule], // re-exports JwtModule so JwtAuthGuard can verify tokens
  controllers: [ClassesController],
  providers: [
    CreateClassUseCase,
    ListClassesUseCase,
    GetClassUseCase,
    JoinClassUseCase,
    RemoveMemberUseCase,
    { provide: ClassRepository, useClass: PrismaClassRepository },
  ],
  // ClassRepository is exported so SessionsModule can validate class
  // ownership/membership without re-binding the Prisma implementation.
  exports: [ClassRepository],
})
export class ClassesModule {}
