import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  ClassMemberInfo,
  SchoolClass,
  StudentClassSummary,
  TeacherClassSummary,
} from '../entities/school-class.entity';
import { ClassRepository, CreateClassData } from './class.repository';

/** Prisma-backed ClassRepository. The only place classes touch the database. */
@Injectable()
export class PrismaClassRepository extends ClassRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateClassData): Promise<SchoolClass> {
    const row = await this.prisma.schoolClass.create({ data });
    return new SchoolClass(row);
  }

  async findById(id: string): Promise<SchoolClass | null> {
    const row = await this.prisma.schoolClass.findUnique({ where: { id } });
    return row ? new SchoolClass(row) : null;
  }

  async findByInviteCode(inviteCode: string): Promise<SchoolClass | null> {
    const row = await this.prisma.schoolClass.findUnique({
      where: { inviteCode },
    });
    return row ? new SchoolClass(row) : null;
  }

  async findByTeacher(teacherId: string): Promise<TeacherClassSummary[]> {
    const rows = await this.prisma.schoolClass.findMany({
      where: { teacherId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(
      ({ _count, ...row }) =>
        new TeacherClassSummary({ ...row, memberCount: _count.members }),
    );
  }

  async findByMember(userId: string): Promise<StudentClassSummary[]> {
    const rows = await this.prisma.classMember.findMany({
      where: { userId },
      include: { class: { include: { teacher: { select: { name: true } } } } },
      orderBy: { joinedAt: 'desc' },
    });
    return rows.map(
      ({ class: { teacher, ...cls } }) =>
        new StudentClassSummary({ ...cls, teacherName: teacher.name }),
    );
  }

  async findMembers(classId: string): Promise<ClassMemberInfo[]> {
    const rows = await this.prisma.classMember.findMany({
      where: { classId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map(
      (row) =>
        new ClassMemberInfo({
          userId: row.userId,
          name: row.user.name,
          email: row.user.email,
          joinedAt: row.joinedAt,
        }),
    );
  }

  async isMember(classId: string, userId: string): Promise<boolean> {
    const row = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
      select: { id: true },
    });
    return row !== null;
  }

  async addMember(classId: string, userId: string): Promise<void> {
    await this.prisma.classMember.upsert({
      where: { classId_userId: { classId, userId } },
      create: { classId, userId },
      update: {},
    });
  }

  async removeMember(classId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.classMember.deleteMany({
      where: { classId, userId },
    });
    return result.count > 0;
  }
}
