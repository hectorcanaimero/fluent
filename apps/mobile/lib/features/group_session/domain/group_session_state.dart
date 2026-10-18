import 'group_session_dto.dart';

/// Estado de `GroupSessionController`: el snapshot fundido con los eventos
/// del stream, más el mensaje del tutor "en curso" (acumulado de
/// `tutor_token`, todavía sin `message` final que lo reemplace).
class GroupSessionState {
  const GroupSessionState({
    this.detail,
    this.tutorDraft,
    this.loading = true,
    this.error,
  });

  final GroupSessionDetailDto? detail;
  final String? tutorDraft;
  final bool loading;
  final Object? error;

  GroupSessionState copyWith({
    GroupSessionDetailDto? detail,
    String? tutorDraft,
    bool clearTutorDraft = false,
    bool? loading,
    Object? error,
    bool clearError = false,
  }) {
    return GroupSessionState(
      detail: detail ?? this.detail,
      tutorDraft: clearTutorDraft ? null : (tutorDraft ?? this.tutorDraft),
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}
