import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { SchoolClass } from '../entities/school-class.entity';
import { ClassRepository } from '../repositories/class.repository';

/**
 * JoinClass — enroll the authenticated user in a class via its invite code.
 * Idempotent: joining a class you already belong to just returns the class.
 * The owning teacher cannot enroll in their own class.
 */
@Injectable()
export class JoinClassUseCase {
  constructor(private readonly classes: ClassRepository) {}

  async execute(actor: AuthUser, inviteCode: string): Promise<SchoolClass> {
    const schoolClass = await this.classes.findByInviteCode(inviteCode);
    if (!schoolClass) {
      throw new NotFoundException('Invalid invite code');
    }

    if (schoolClass.teacherId === actor.userId) {
      throw new ForbiddenException('You cannot join your own class');
    }

    const alreadyMember = await this.classes.isMember(
      schoolClass.id,
      actor.userId,
    );
    if (!alreadyMember) {
      await this.classes.addMember(schoolClass.id, actor.userId);
    }

    return schoolClass;
  }
}
