import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { ClassDetailDto } from '../dtos/class-response.dto';
import { ClassRepository } from '../repositories/class.repository';

/**
 * GetClass — class detail with the member list. Visible only to the owning
 * teacher or an enrolled student.
 */
@Injectable()
export class GetClassUseCase {
  constructor(private readonly classes: ClassRepository) {}

  async execute(actor: AuthUser, classId: string): Promise<ClassDetailDto> {
    const schoolClass = await this.classes.findById(classId);
    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    const isOwner = schoolClass.teacherId === actor.userId;
    if (!isOwner && !(await this.classes.isMember(classId, actor.userId))) {
      throw new ForbiddenException('You do not have access to this class');
    }

    const members = await this.classes.findMembers(classId);
    return { ...schoolClass, members };
  }
}
