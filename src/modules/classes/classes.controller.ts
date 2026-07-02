import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/enums/user-role.enum';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import {
  ClassDetailDto,
  ClassDto,
  ClassSummaryDto,
} from './dtos/class-response.dto';
import { CreateClassDto } from './dtos/create-class.dto';
import { JoinClassDto } from './dtos/join-class.dto';
import {
  StudentClassSummary,
  TeacherClassSummary,
} from './entities/school-class.entity';
import { CreateClassUseCase } from './usecases/create-class.usecase';
import { GetClassUseCase } from './usecases/get-class.usecase';
import { JoinClassUseCase } from './usecases/join-class.usecase';
import { ListClassesUseCase } from './usecases/list-classes.usecase';
import { RemoveMemberUseCase } from './usecases/remove-member.usecase';

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('classes')
export class ClassesController {
  constructor(
    private readonly createClassUseCase: CreateClassUseCase,
    private readonly listClassesUseCase: ListClassesUseCase,
    private readonly getClassUseCase: GetClassUseCase,
    private readonly joinClassUseCase: JoinClassUseCase,
    private readonly removeMemberUseCase: RemoveMemberUseCase,
  ) {}

  @Post()
  @Roles(UserRole.PROFESSOR)
  @ApiOperation({
    operationId: 'createClass',
    summary: 'Create a class (teacher only)',
  })
  @ApiResponse({ status: 201, type: ClassDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Caller is not a teacher' })
  createClass(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClassDto,
  ): Promise<ClassDto> {
    return this.createClassUseCase.execute(user, dto);
  }

  @Get()
  @ApiOperation({
    operationId: 'listClasses',
    summary: 'List my classes (created if teacher, joined if student)',
  })
  @ApiResponse({ status: 200, type: [ClassSummaryDto] })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  listClasses(
    @CurrentUser() user: AuthUser,
  ): Promise<TeacherClassSummary[] | StudentClassSummary[]> {
    return this.listClassesUseCase.execute(user);
  }

  @Post('join')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'joinClass',
    summary: 'Join a class by invite code (idempotent)',
  })
  @ApiResponse({ status: 200, type: ClassDto })
  @ApiResponse({ status: 403, description: 'Teacher joining their own class' })
  @ApiResponse({ status: 404, description: 'Invalid invite code' })
  joinClass(
    @CurrentUser() user: AuthUser,
    @Body() dto: JoinClassDto,
  ): Promise<ClassDto> {
    return this.joinClassUseCase.execute(user, dto.inviteCode);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getClass',
    summary: 'Class detail with member list (owner or member only)',
  })
  @ApiResponse({ status: 200, type: ClassDetailDto })
  @ApiResponse({ status: 403, description: 'Not the owner nor a member' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  getClass(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClassDetailDto> {
    return this.getClassUseCase.execute(user, id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'removeClassMember',
    summary: 'Remove a student from the class (owning teacher only)',
  })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 403, description: 'Caller is not the owning teacher' })
  @ApiResponse({ status: 404, description: 'Class or member not found' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.removeMemberUseCase.execute(user, id, userId);
  }
}
