export type MeetingType =
  'escola' | 'empresa' | 'palestra' | 'evento' | 'comunidade';
export type AgeRange = 'criancas' | 'adolescentes' | 'adultos' | 'misto';
export type PortugueseFamiliarity = 'baixa' | 'media' | 'alta';
export type SimplificationLevel = 'leve' | 'moderada' | 'alta';

export interface AudienceContext {
  meetingType: MeetingType;
  ageRange: AgeRange;
  portugueseFamiliarity: PortugueseFamiliarity;
  domain: string;
  simplificationLevel: SimplificationLevel;
}

export interface AudienceContextSnapshot {
  context: AudienceContext | null;
  contextVersion: number;
}
