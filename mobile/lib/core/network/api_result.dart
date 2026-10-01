/// Résultat typé pour toutes les opérations réseau.
/// Remplace les `catch (_) {}` silencieux par un type explicite.
///
/// Usage :
/// ```dart
/// final result = await repo.getMovies();
/// switch (result) {
///   case ApiSuccess(:final data):  // utiliser data
///   case ApiFailure(:final error): // afficher error.message
/// }
/// ```
sealed class ApiResult<T> {
  const ApiResult();
}

final class ApiSuccess<T> extends ApiResult<T> {
  final T data;
  const ApiSuccess(this.data);
}

final class ApiFailure<T> extends ApiResult<T> {
  final AppError error;
  const ApiFailure(this.error);
}

/// Erreur applicative unifiée.
class AppError {
  final String message;
  final int? statusCode;
  final AppErrorType type;

  const AppError({
    required this.message,
    this.statusCode,
    this.type = AppErrorType.unknown,
  });

  factory AppError.network(String message, {int? statusCode}) => AppError(
        message: message,
        statusCode: statusCode,
        type: AppErrorType.network,
      );

  factory AppError.unauthorized() => const AppError(
        message: 'Session expirée. Veuillez vous reconnecter.',
        statusCode: 401,
        type: AppErrorType.unauthorized,
      );

  factory AppError.notFound() => const AppError(
        message: 'Ressource introuvable.',
        statusCode: 404,
        type: AppErrorType.notFound,
      );

  factory AppError.timeout() => const AppError(
        message: 'La requête a pris trop de temps. Vérifiez votre connexion.',
        type: AppErrorType.timeout,
      );

  factory AppError.parse(String message) => AppError(
        message: 'Erreur de format : $message',
        type: AppErrorType.parse,
      );

  factory AppError.unknown([String? message]) => AppError(
        message: message ?? 'Une erreur inattendue s\'est produite.',
        type: AppErrorType.unknown,
      );

  @override
  String toString() => 'AppError[$type] $message (status: $statusCode)';
}

enum AppErrorType { network, unauthorized, notFound, timeout, parse, unknown }
