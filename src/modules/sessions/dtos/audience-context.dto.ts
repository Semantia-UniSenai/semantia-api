import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class AudienceContextDto {
  @ApiProperty({
    enum: ['escola', 'empresa', 'palestra', 'evento', 'comunidade'],
    enumName: 'MeetingType',
    example: 'escola',
  })
  @IsEnum(['escola', 'empresa', 'palestra', 'evento', 'comunidade'])
  meetingType: string;

  @ApiProperty({
    enum: ['criancas', 'adolescentes', 'adultos', 'misto'],
    enumName: 'AgeRange',
    example: 'adolescentes',
  })
  @IsEnum(['criancas', 'adolescentes', 'adultos', 'misto'])
  ageRange: string;

  @ApiProperty({
    enum: ['baixa', 'media', 'alta'],
    enumName: 'PortugueseFamiliarity',
    example: 'media',
    description: 'Familiaridade da plateia com português escrito',
  })
  @IsEnum(['baixa', 'media', 'alta'])
  portugueseFamiliarity: string;

  @ApiProperty({
    example: 'Matemática — equações do segundo grau',
    description: 'Assunto ou domínio da reunião (livre)',
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  domain: string;

  @ApiProperty({
    enum: ['leve', 'moderada', 'alta'],
    enumName: 'SimplificationLevel',
    example: 'moderada',
    description: 'Nível desejado de simplificação pelo agente de IA',
  })
  @IsEnum(['leve', 'moderada', 'alta'])
  simplificationLevel: string;
}
