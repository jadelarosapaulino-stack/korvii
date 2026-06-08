import 'api_client.dart';
import 'models.dart';

class EducationRepository {
  EducationRepository(this._api);

  final ApiClient _api;

  Future<List<Lesson>> lessons() async {
    final response = await _api.dio.get('/education/lessons');
    return (response.data as List<dynamic>)
        .map((item) => Lesson.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> completeLesson(String id, {int score = 100}) {
    return _api.dio.post('/education/lessons/$id/complete',
        data: {'score': score}).then((_) {});
  }
}
