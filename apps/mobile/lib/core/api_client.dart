import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'app_config.dart';

class ApiClient {
  ApiClient(this._storage)
      : dio = Dio(
          BaseOptions(
            baseUrl: AppConfig.apiBaseUrl,
            connectTimeout: const Duration(seconds: 20),
            receiveTimeout: const Duration(seconds: 20),
          ),
        ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          options.headers['X-Ruta-Platform'] = 'mobile';
          final token = await _storage.read(key: tokenKey);
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          if (options.method.toUpperCase() == 'GET') {
            final ttl = _ttlFor(options.path);
            final key = _cacheKey(options);
            final cached = _cache[key];
            if (ttl != null &&
                cached != null &&
                cached.expiresAt.isAfter(DateTime.now())) {
              return handler.resolve(cached.toResponse(options));
            }
            if (cached != null) _cache.remove(key);
          } else {
            _cache.clear();
          }

          handler.next(options);
        },
        onResponse: (response, handler) {
          final options = response.requestOptions;
          if (options.method.toUpperCase() == 'GET' &&
              response.statusCode == 200) {
            final ttl = _ttlFor(options.path);
            if (ttl != null) {
              _cache[_cacheKey(options)] = _CachedResponse(
                data: response.data,
                headers: Headers.fromMap(response.headers.map),
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                expiresAt: DateTime.now().add(ttl),
              );
            }
          }
          handler.next(response);
        },
      ),
    );
  }

  static const tokenKey = 'ruta_segura_token';
  final FlutterSecureStorage _storage;
  final Dio dio;
  final Map<String, _CachedResponse> _cache = {};

  Future<void> saveToken(String token) async {
    _cache.clear();
    await _storage.write(key: tokenKey, value: token);
  }

  Future<void> clearToken() async {
    _cache.clear();
    await _storage.delete(key: tokenKey);
  }

  Future<bool> hasToken() async => (await _storage.read(key: tokenKey)) != null;

  String _cacheKey(RequestOptions options) {
    final token = options.headers['Authorization'] ?? 'anonymous';
    return '$token|${options.uri}';
  }

  Duration? _ttlFor(String path) {
    if (path == '/auth/social/config') return const Duration(minutes: 5);
    if (path == '/education/categories') return const Duration(minutes: 10);
    if (path == '/education/lessons') return const Duration(minutes: 3);
    if (RegExp(r'^/education/lessons/[^/]+$').hasMatch(path)) {
      return const Duration(minutes: 5);
    }
    if (path == '/feature-flags') return const Duration(minutes: 2);
    if (path == '/role-permissions') return const Duration(minutes: 2);
    if (path == '/gamification/settings') return const Duration(minutes: 5);
    if (path == '/reports/map') return const Duration(seconds: 15);
    if (path == '/reports/admin/metrics') return const Duration(seconds: 30);
    if (path == '/analytics/summary') return const Duration(seconds: 30);
    if (path == '/analytics/intelligence') return const Duration(seconds: 45);
    if (path == '/traffic-lights/settings') return const Duration(minutes: 5);
    if (path == '/traffic-lights/green-light-insights') {
      return const Duration(minutes: 1);
    }
    if (path == '/traffic-lights') return const Duration(minutes: 1);
    if (path == '/institutions') return const Duration(minutes: 5);
    return null;
  }
}

class _CachedResponse {
  const _CachedResponse({
    required this.data,
    required this.headers,
    required this.statusCode,
    required this.statusMessage,
    required this.expiresAt,
  });

  final dynamic data;
  final Headers headers;
  final int? statusCode;
  final String? statusMessage;
  final DateTime expiresAt;

  Response<dynamic> toResponse(RequestOptions requestOptions) {
    return Response<dynamic>(
      data: data,
      headers: headers,
      statusCode: statusCode,
      statusMessage: statusMessage,
      requestOptions: requestOptions,
    );
  }
}
