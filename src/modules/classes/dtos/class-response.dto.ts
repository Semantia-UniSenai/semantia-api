import { ApiProperty } from '@nestjs/swagger';

export class ClassDto {
  @ApiProperty({ example: 'c3a1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'Turma A — Informática 2026' })
  name: string;

  @ApiProperty({ example: 'b3c1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  teacherId: string;

  @ApiProperty({ example: 'K7MP2XQ9' })
  inviteCode: string;

  @ApiProperty({ example: '2026-07-01T12:00:00.000Z' })
  createdAt: Date;
}

export class ClassSummaryDto extends ClassDto {
  @ApiProperty({
    required: false,
    example: 23,
    description: 'Number of enrolled students (present for teachers)',
  })
  memberCount?: number;

  @ApiProperty({
    required: false,
    example: 'Carlos Lima',
    description: "Teacher's display name (present for students)",
  })
  teacherName?: string;
}

export class ClassMemberDto {
  @ApiProperty({ example: 'b3c1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  userId: string;

  @ApiProperty({ example: 'Ana Souza' })
  name: string;

  @ApiProperty({ example: 'ana@semantia.app' })
  email: string;

  @ApiProperty({ example: '2026-07-01T12:00:00.000Z' })
  joinedAt: Date;
}

export class ClassDetailDto extends ClassDto {
  @ApiProperty({ type: [ClassMemberDto] })
  members: ClassMemberDto[];
}
