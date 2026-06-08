import 'dart:io';

import 'package:dio/dio.dart';

import 'api_client.dart';
import 'models.dart';

class ReportsRepository {
  ReportsRepository(this._api);

  final ApiClient _api;

  Future<ReportPage> list({
    int page = 1,
    int limit = 20,
    String? status,
    ReportCategory? category,
    int? minRisk,
    String? query,
  }) async {
    final response = await _api.dio.get('/reports', queryParameters: {
      'page': page,
      'limit': limit,
      if (status != null && status != 'ALL') 'status': status,
      if (category != null) 'category': category.value,
      if (minRisk != null) 'minRisk': minRisk,
      if (query != null && query.trim().isNotEmpty) 'q': query.trim(),
    });
    return ReportPage.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<ReportPoint>> mapPoints({int limit = 100}) async {
    final response =
        await _api.dio.get('/reports/map', queryParameters: {'limit': limit});
    return (response.data as List<dynamic>)
        .map((item) => ReportPoint.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<CreateReportResult> createReport({
    required String title,
    required ReportCategory category,
    required String description,
    required double latitude,
    required double longitude,
    required int riskLevel,
    String? province,
    String? municipality,
    String? address,
    File? photo,
    List<File> photos = const [],
  }) async {
    final selectedPhotos = [
      ...photos,
      if (photo != null) photo,
    ].take(5).toList();
    final data = FormData.fromMap({
      'title': title,
      'category': category.value,
      'description': description,
      'latitude': latitude,
      'longitude': longitude,
      'riskLevel': riskLevel,
      'source': 'mobile',
      if (province != null) 'province': province,
      if (municipality != null) 'municipality': municipality,
      if (address != null) 'address': address,
      if (selectedPhotos.isNotEmpty)
        'photos': [
          for (final item in selectedPhotos)
            await MultipartFile.fromFile(item.path),
        ],
    });
    final response = await _api.dio.post('/reports', data: data);
    return CreateReportResult.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> logEmergencyCall({
    ReportCategory? category,
    String? title,
    double? latitude,
    double? longitude,
    String? province,
    String? municipality,
    String? address,
    String source = 'mobile-emergency-mode',
  }) {
    return _api.dio.post('/reports/emergency-call-logs', data: {
      'phoneNumber': '911',
      if (category != null) 'category': category.value,
      if (title != null) 'title': title.trim(),
      'latitude': latitude,
      'longitude': longitude,
      'province': province,
      'municipality': municipality,
      'address': address,
      'source': source,
    }).then((_) {});
  }

  Future<void> sendRoadTelemetry({
    required String eventType,
    required double latitude,
    required double longitude,
    double? accelerationMagnitude,
    double? speedBeforeKmh,
    double? speedAfterKmh,
    double? accuracyMeters,
  }) {
    return _api.dio.post('/reports/road-telemetry', data: {
      'eventType': eventType,
      'latitude': latitude,
      'longitude': longitude,
      if (accelerationMagnitude != null)
        'accelerationMagnitude': accelerationMagnitude,
      if (speedBeforeKmh != null) 'speedBeforeKmh': speedBeforeKmh,
      if (speedAfterKmh != null) 'speedAfterKmh': speedAfterKmh,
      if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
      'source': 'mobile-road-telemetry',
    }).then((_) {});
  }
}
