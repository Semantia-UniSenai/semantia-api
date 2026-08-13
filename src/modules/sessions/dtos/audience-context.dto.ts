import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AudienceContextDto {
  @ApiProperty({
    required: false,
    enum: ['escola', 'empresa', 'palestra', 'evento', 'comunidade'],
    enumName: 'MeetingType',
    example: 'escola',
  })
  @IsOptional()
  @IsEnum(['escola', 'empresa', 'palestra', 'evento', 'comunidade'])
  meetingType?: string;

  @ApiProperty({
    required: false,
    enum: ['criancas', 'adolescentes', 'adultos', 'misto'],
    enumName: 'AgeRange',
    example: 'adolescentes',
  })
  @IsOptional()
  @IsEnum(['criancas', 'adolescentes', 'adultos', 'misto'])
  ageRange?: string;

  @ApiProperty({
    required: false,
    enum: ['baixa', 'media', 'alta'],
    enumName: 'PortugueseFamiliarity',
    example: 'media',
    description: 'Familiaridade da plateia com português escrito',
  })
  @IsOptional()
  @IsEnum(['baixa', 'media', 'alta'])
  portugueseFamiliarity?: string;

  @ApiProperty({
    required: false,
    example: 'Matemática — equações do segundo grau',
    description: 'Assunto ou domínio da reunião (livre)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  domain?: string;

  @ApiProperty({
    required: false,
    enum: ['leve', 'moderada', 'alta'],
    enumName: 'SimplificationLevel',
    example: 'moderada',
    description: 'Nível desejado de simplificação pelo agente de IA',
  })
  @IsOptional()
  @IsEnum(['leve', 'moderada', 'alta'])
  simplificationLevel?: string;

  @ApiProperty({
    required: false,
    description: 'Se true, participantes precisam de aprovação antes de entrar',
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}
