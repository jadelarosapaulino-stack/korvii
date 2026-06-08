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
          handler.next(options);
        },
      ),
    );
  }

  static const tokenKey = 'ruta_segura_token';
  final FlutterSecureStorage _storage;
  final Dio dio;

  Future<void> saveToken(String token) =>
      _storage.write(key: tokenKey, value: token);
  Future<void> clearToken() => _storage.delete(key: tokenKey);
  Future<bool> hasToken() async => (await _storage.read(key: tokenKey)) != null;
}
