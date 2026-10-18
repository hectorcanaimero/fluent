import 'dart:convert';

import 'package:fluent_mobile/features/group_session/domain/group_session_dto.dart';
import 'package:flutter_test/flutter_test.dart';

/// `toJson()` no serializa los DTOs anidados a `Map` (el default de
/// `json_serializable` sin `explicitToJson`, igual que el resto de
/// `core/api/models.dart`): deja que `jsonEncode` los convierta, como pasa
/// de verdad en el cuerpo HTTP que lee `fromJson`.
Map<String, dynamic> _overTheWire(Map<String, dynamic> json) =>
    jsonDecode(jsonEncode(json)) as Map<String, dynamic>;

void main() {
  // docs/arch/002-sesion-grupal.md §Interfaces: los campos de cada DTO
  // calcan ese bloque; estos tests fijan que `toJson`/`fromJson` no pierdan
  // ni inventen ninguno.

  test('GroupSessionDto: ida y vuelta por JSON', () {
    const dto = GroupSessionDto(
      id: 'gs-1',
      kind: 'free_topic',
      topic: 'Travel plans',
      initiator: GroupInitiatorDto(id: 'u-1', name: 'Ana'),
      status: 'active',
      startedAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T10:30:00.000Z',
      participants: [
        ParticipantDto(
          userId: 'u-1',
          name: 'Ana',
          avatarUrl: 'https://example.com/a.png',
          active: true,
          shareCorrections: false,
        ),
      ],
    );

    final roundTripped = GroupSessionDto.fromJson(_overTheWire(dto.toJson()));

    expect(roundTripped, dto);
  });

  test('GroupSessionDto: `topic` y `avatarUrl` nulos sobreviven la ida y vuelta', () {
    const dto = GroupSessionDto(
      id: 'gs-1',
      kind: 'roleplay',
      initiator: GroupInitiatorDto(id: 'u-1', name: 'Ana'),
      status: 'active',
      startedAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T10:30:00.000Z',
      participants: [
        ParticipantDto(userId: 'u-1', name: 'Ana', active: true, shareCorrections: false),
      ],
    );

    final roundTripped = GroupSessionDto.fromJson(_overTheWire(dto.toJson()));

    expect(roundTripped.topic, isNull);
    expect(roundTripped.participants.single.avatarUrl, isNull);
    expect(roundTripped, dto);
  });

  test('GroupMessageDto: ida y vuelta, con y sin los campos opcionales', () {
    const withOptionals = GroupMessageDto(
      id: 42,
      role: 'tutor',
      authorId: null,
      text: 'Nice work!',
      systemEvent: null,
      hasAudio: true,
      audioMs: 1500,
      createdAt: '2026-01-01T10:05:00.000Z',
      clientId: 'client-abc',
    );
    expect(GroupMessageDto.fromJson(_overTheWire(withOptionals.toJson())), withOptionals);

    const systemMessage = GroupMessageDto(
      id: 43,
      role: 'system',
      text: 'Ana joined the room',
      systemEvent: 'joined',
      hasAudio: false,
      createdAt: '2026-01-01T10:06:00.000Z',
    );
    final roundTripped = GroupMessageDto.fromJson(_overTheWire(systemMessage.toJson()));
    expect(roundTripped, systemMessage);
    expect(roundTripped.authorId, isNull);
    expect(roundTripped.audioMs, isNull);
    expect(roundTripped.clientId, isNull);
  });

  test('GroupCorrectionDto: ida y vuelta', () {
    const dto = GroupCorrectionDto(
      messageId: 42,
      authorId: 'u-1',
      original: 'I go yesterday',
      corrected: 'I went yesterday',
      category: 'verb_tense',
      note: 'Use past tense for past events.',
    );

    expect(GroupCorrectionDto.fromJson(_overTheWire(dto.toJson())), dto);
  });

  test('GroupRecapDto: ida y vuelta', () {
    const dto = GroupRecapDto(
      topics: ['travel', 'food'],
      highlights: [
        GroupRecapHighlightDto(userId: 'u-1', quote: 'I would love to visit Japan someday.'),
      ],
    );

    expect(GroupRecapDto.fromJson(_overTheWire(dto.toJson())), dto);
  });

  test('GroupSessionDetailDto: ida y vuelta, con recap y xp presentes', () {
    const dto = GroupSessionDetailDto(
      id: 'gs-1',
      kind: 'news',
      topic: 'Climate summit',
      initiator: GroupInitiatorDto(id: 'u-1', name: 'Ana'),
      status: 'ended',
      startedAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T10:30:00.000Z',
      participants: [
        ParticipantDto(userId: 'u-1', name: 'Ana', active: false, shareCorrections: true),
      ],
      messages: [
        GroupMessageDto(
          id: 1,
          role: 'user',
          authorId: 'u-1',
          text: 'Hello everyone',
          hasAudio: false,
          createdAt: '2026-01-01T10:01:00.000Z',
          clientId: 'client-1',
        ),
      ],
      corrections: [
        GroupCorrectionDto(
          messageId: 1,
          authorId: 'u-1',
          original: 'Hello everyone',
          corrected: 'Hello, everyone',
          category: 'punctuation',
          note: 'Add a comma after a greeting.',
        ),
      ],
      recap: GroupRecapDto(
        topics: ['climate'],
        highlights: [GroupRecapHighlightDto(userId: 'u-1', quote: 'Great discussion today.')],
      ),
      xp: [GroupXpEntryDto(userId: 'u-1', xp: 15)],
    );

    expect(GroupSessionDetailDto.fromJson(_overTheWire(dto.toJson())), dto);
  });

  test('GroupSessionDetailDto: `recap` y `xp` ausentes siguen siendo null tras la ida y vuelta', () {
    const dto = GroupSessionDetailDto(
      id: 'gs-1',
      kind: 'free_topic',
      initiator: GroupInitiatorDto(id: 'u-1', name: 'Ana'),
      status: 'active',
      startedAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T10:30:00.000Z',
      participants: [],
      messages: [],
      corrections: [],
    );

    final roundTripped = GroupSessionDetailDto.fromJson(_overTheWire(dto.toJson()));

    expect(roundTripped.recap, isNull);
    expect(roundTripped.xp, isNull);
    expect(roundTripped, dto);
  });
}
