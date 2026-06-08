import 'api_client.dart';

class ActivityRepository {
  ActivityRepository(this._api);

  final ApiClient _api;

  Future<void> track({
    required String eventType,
    required String action,
    String? screen,
    String? element,
    Map<String, Object?> metadata = const {},
  }) {
    return _api.dio.post('/activity/events', data: {
      'eventType': eventType,
      'action': action,
      'platform': 'mobile',
      if (screen != null) 'screen': screen,
      if (element != null) 'element': element,
      if (metadata.isNotEmpty) 'metadata': metadata,
    }).then((_) {});
  }
}
