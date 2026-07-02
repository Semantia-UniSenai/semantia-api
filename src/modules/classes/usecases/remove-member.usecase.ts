import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { ClassRepository } from '../repositories/class.repository';

/**
 * RemoveMember — the owning teacher removes a student from their class.
 */
@Injectable()
export class RemoveMemberUseCase {
  constructor(private readonly classes: ClassRepository) {}

  async execute(
    actor: AuthUser,
    classId: string,
    userId: string,
  ): Promise<void> {
    const schoolClass = await this.classes.findById(classId);
    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    if (schoolClass.teacherId !== actor.userId) {
      throw new ForbiddenException(
        'Only the owning teacher can remove members',
      );
    }

    const removed = await this.classes.removeMember(classId, userId);
    if (!removed) {
      throw new NotFoundException('User is not a member of this class');
    }
  }
}
