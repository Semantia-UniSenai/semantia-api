import { ForbiddenException } from '@nestjs/common';
import { Room } from './entities/room.entity';
import { RoomParticipantRole } from './entities/room.entity';
import { RoomPermissionService } from './room-permission.service';
import { RoomRepository } from './repositories/room.repository';
import { CreateRoomUseCase } from './usecases/create-room.usecase';
import { RemoveRoomMemberUseCase } from './usecases/remove-room-member.usecase';
import { UpdateRoomMemberRoleUseCase } from './usecases/update-room-member-role.usecase';
import { UpdateRoomUseCase } from './usecases/update-room.usecase';

const actor = { userId: 'host-1', email: 'host@semantia.app' };
const room = new Room({
  id: 'room-1',
  name: 'Planejamento',
  hostId: actor.userId,
  inviteCode: 'ROOM1234',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const repo = (): jest.Mocked<RoomRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByInviteCode: jest.fn(),
  listAccessible: jest.fn(),
  findMembers: jest.fn(),
  getParticipantRole: jest.fn(),
  addMember: jest.fn(),
  updateName: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
});

describe('room use cases', () => {
  const permissions = new RoomPermissionService();

  it('creates a room for any authenticated account without a global role', async () => {
    const rooms = repo();
    rooms.create.mockResolvedValue(room);
    const result = await new CreateRoomUseCase(rooms).execute(actor, {
      name: ' Planejamento ',
    });
    expect(result).toBe(room);
    expect(rooms.create).toHaveBeenCalledWith({
      name: 'Planejamento',
      hostId: actor.userId,
      inviteCode: expect.any(String),
    });
  });

  it.each([RoomParticipantRole.HOST, RoomParticipantRole.MODERATOR])(
    'allows %s to update room configuration',
    async (role) => {
      const rooms = repo();
      rooms.findById.mockResolvedValue(room);
      rooms.getParticipantRole.mockResolvedValue(role);
      rooms.updateName.mockResolvedValue({ ...room, name: 'Novo nome' });
      await new UpdateRoomUseCase(rooms, permissions).execute(
        actor,
        room.id,
        ' Novo nome ',
      );
      expect(rooms.updateName).toHaveBeenCalledWith(room.id, 'Novo nome');
    },
  );

  it('rejects participant room management', async () => {
    const rooms = repo();
    rooms.findById.mockResolvedValue(room);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.PARTICIPANT);
    await expect(
      new UpdateRoomUseCase(rooms, permissions).execute(actor, room.id, 'Nome'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows only the host to promote a member to moderator', async () => {
    const rooms = repo();
    rooms.findById.mockResolvedValue(room);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.PARTICIPANT);
    await new UpdateRoomMemberRoleUseCase(rooms).execute(
      actor,
      room.id,
      'participant-1',
      RoomParticipantRole.MODERATOR,
    );
    expect(rooms.updateMemberRole).toHaveBeenCalledWith(
      room.id,
      'participant-1',
      RoomParticipantRole.MODERATOR,
    );
  });

  it('does not let a moderator remove another moderator', async () => {
    const rooms = repo();
    rooms.findById.mockResolvedValue(room);
    rooms.getParticipantRole
      .mockResolvedValueOnce(RoomParticipantRole.MODERATOR)
      .mockResolvedValueOnce(RoomParticipantRole.MODERATOR);
    await expect(
      new RemoveRoomMemberUseCase(rooms, permissions).execute(
        { userId: 'mod-1', email: 'mod@semantia.app' },
        room.id,
        'mod-2',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
