import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, LiveKitAPI, TrackSource } from 'livekit-server-sdk';
import {
  MediaRoomProvider,
  type IssueMediaCredentialsInput,
  type MediaCredentials,
} from '../contracts/media-room.provider';
import { MediaError } from '../errors/media.errors';

const DEFAULT_TOKEN_TTL_SECONDS = 600;
const MAX_PARTICIPANTS = 50;
const EMPTY_TIMEOUT_SECONDS = 60;

interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  tokenTtlSeconds: number;
}

function providerCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  return String(error.code).toLowerCase();
}

function hasProviderCode(
  error: unknown,
  numeric: number,
  textual: string,
): boolean {
  const code = providerCode(error);
  return code === String(numeric) || code === textual;
}

@Injectable()
export class LiveKitMediaRoomProvider extends MediaRoomProvider {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async issueCredentials(
    input: IssueMediaCredentialsInput,
  ): Promise<MediaCredentials> {
    const config = this.readConfig();
    if (!config) {
      throw new MediaError(
        'MEDIA_UNAVAILABLE',
        'Audio and video are unavailable',
      );
    }

    const roomName = this.roomName(input.sessionId);
    const api = this.createApi(config);
    try {
      await api.room.createRoom({
        name: roomName,
        maxParticipants: MAX_PARTICIPANTS,
        emptyTimeout: EMPTY_TIMEOUT_SECONDS,
      });
    } catch (error) {
      if (!hasProviderCode(error, 6, 'already_exists')) {
        throw new MediaError(
          'MEDIA_UNAVAILABLE',
          'Audio and video are unavailable',
          { cause: error },
        );
      }
    }

    try {
      const token = new AccessToken(config.apiKey, config.apiSecret, {
        identity: input.participant.participantId,
        name: input.participant.name,
        metadata: JSON.stringify({ role: input.participant.role }),
        ttl: config.tokenTtlSeconds,
      });
      token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA],
      });
      return {
        serverUrl: config.url,
        participantToken: await token.toJwt(),
        expiresInSeconds: config.tokenTtlSeconds,
      };
    } catch (error) {
      throw new MediaError(
        'MEDIA_UNAVAILABLE',
        'Audio and video are unavailable',
        { cause: error },
      );
    }
  }

  async closeRoom(sessionId: string): Promise<void> {
    const config = this.readConfig();
    if (!config) return;

    try {
      await this.createApi(config).room.deleteRoom(this.roomName(sessionId));
    } catch (error) {
      if (!hasProviderCode(error, 5, 'not_found')) {
        throw new MediaError(
          'MEDIA_CLEANUP_FAILED',
          'The media room could not be closed',
          { cause: error },
        );
      }
    }
  }

  private createApi(config: LiveKitConfig): LiveKitAPI {
    return new LiveKitAPI({
      host: config.url,
      apiKey: config.apiKey,
      secret: config.apiSecret,
    });
  }

  private readConfig(): LiveKitConfig | null {
    const url = this.configService.get<string>('LIVEKIT_URL')?.trim();
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY')?.trim();
    const apiSecret = this.configService
      .get<string>('LIVEKIT_API_SECRET')
      ?.trim();
    if (!url || !apiKey || !apiSecret) return null;

    const configuredTtl = Number(
      this.configService.get<string>('LIVEKIT_TOKEN_TTL_SECONDS') ??
        DEFAULT_TOKEN_TTL_SECONDS,
    );
    const tokenTtlSeconds =
      Number.isInteger(configuredTtl) && configuredTtl > 0
        ? configuredTtl
        : DEFAULT_TOKEN_TTL_SECONDS;

    return { url, apiKey, apiSecret, tokenTtlSeconds };
  }

  private roomName(sessionId: string): string {
    return `semantia:${sessionId}`;
  }
}
