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

  Future<Lesson> lesson(String id) async {
    final response = await _api.dio.get('/education/lessons/$id');
    return Lesson.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<LessonProgress>> myProgress() async {
    final response = await _api.dio.get('/education/progress/me');
    return (response.data as List<dynamic>)
        .map((item) => LessonProgress.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<LessonProgress> completeLesson(String id, {int score = 100}) async {
    final response = await _api.dio
        .post('/education/lessons/$id/complete', data: {'score': score});
    return LessonProgress.fromJson(response.data as Map<String, dynamic>);
  }

  Future<LessonProgress> saveLessonProgress(
      String id, int progressPercent) async {
    final response = await _api.dio.post('/education/lessons/$id/progress',
        data: {'progressPercent': progressPercent});
    return LessonProgress.fromJson(response.data as Map<String, dynamic>);
  }
}
