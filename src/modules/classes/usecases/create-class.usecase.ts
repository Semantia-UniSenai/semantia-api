import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { generateInviteCode } from '../../../shared/utils/random-code.util';
import { CreateClassDto } from '../dtos/create-class.dto';
import { SchoolClass } from '../entities/school-class.entity';
import { ClassRepository } from '../repositories/class.repository';

const MAX_CODE_ATTEMPTS = 5;

/**
 * CreateClass — a PROFESSOR creates a class (turma) with a fresh, unique,
 * human-readable invite code. The role is also enforced by RolesGuard at the
 * controller; the check here keeps the business rule framework-independent.
 */
@Injectable()
export class CreateClassUseCase {
  constructor(private readonly classes: ClassRepository) {}

  async execute(actor: AuthUser, dto: CreateClassDto): Promise<SchoolClass> {
    if (actor.role !== UserRole.PROFESSOR) {
      throw new ForbiddenException('Only teachers can create classes');
    }

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const inviteCode = generateInviteCode();
      const taken = await this.classes.findByInviteCode(inviteCode);
      if (!taken) {
        return this.classes.create({
          name: dto.name,
          teacherId: actor.userId,
          inviteCode,
        });
      }
    }

    // 31^8 combinations — colliding five times in a row means something is off.
    throw new ConflictException('Could not allocate a unique invite code');
  }
}
