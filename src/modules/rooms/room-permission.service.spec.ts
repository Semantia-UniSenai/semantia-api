import { RoomParticipantRole } from './entities/room.entity';
import { RoomPermissionService } from './room-permission.service';

describe('RoomPermissionService', () => {
  const permissions = new RoomPermissionService();

  it.each([RoomParticipantRole.HOST, RoomParticipantRole.MODERATOR])(
    'allows %s to manage a room',
    (role) => {
      expect(permissions.canManage(role)).toBe(true);
    },
  );

  it.each([RoomParticipantRole.PARTICIPANT, RoomParticipantRole.GUEST, null])(
    'does not allow %s to manage a room',
    (role) => {
      expect(permissions.canManage(role)).toBe(false);
    },
  );
});
