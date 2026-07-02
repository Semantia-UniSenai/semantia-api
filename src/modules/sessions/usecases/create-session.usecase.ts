import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { generateJoinToken } from '../../../shared/utils/random-code.util';
import { ClassRepository } from '../../classes/repositories/class.repository';
import { CreateSessionDto } from '../dtos/create-session.dto';
import { LiveSession } from '../entities/live-session.entity';
import { LiveSessionRepository } from '../repositories/live-session.repository';

/**
 * CreateSession — a PROFESSOR starts a live session, either attached to one
 * of their own classes or ad-hoc (classId null, joined only via token/link).
 */
@Injectable()
export class CreateSessionUseCase {
  constructor(
    private readonly sessions: LiveSessionRepository,
    private readonly classes: ClassRepository,
  ) {}

  async execute(actor: AuthUser, dto: CreateSessionDto): Promise<LiveSession> {
    if (actor.role !== UserRole.PROFESSOR) {
      throw new ForbiddenException('Only teachers can start live sessions');
    }

    if (dto.classId) {
      const schoolClass = await this.classes.findById(dto.classId);
      if (!schoolClass) {
        throw new NotFoundException('Class not found');
      }
      if (schoolClass.teacherId !== actor.userId) {
        throw new ForbiddenException(
          'You can only start sessions for your own classes',
        );
      }
    }

    return this.sessions.create({
      title: dto.title,
      teacherId: actor.userId,
      classId: dto.classId ?? null,
      joinToken: generateJoinToken(),
    });
  }
}
