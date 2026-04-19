import axios from 'axios';

/** Classify axios/fetch failures for user-facing copy. */

export class AppError extends Error {
  public readonly code: string;
  public readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error') {
    super(message, 'NETWORK');
    this.name = 'NetworkError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required', status = 401) {
    super(message, 'AUTH', status);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AppError {
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION', 422);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class ServerError extends AppError {
  constructor(message = 'Server error', status = 500) {
    super(message, 'SERVER', status);
    this.name = 'ServerError';
  }
}

export function classifyAxiosError(err: unknown): AppError {
  // Our own synthetic "service not configured" error (see api/client.ts).
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'SERVICE_UNAVAILABLE'
  ) {
    return new AppError(
      (err as Error).message ?? 'This service is not configured yet.',
      'SERVICE_UNAVAILABLE',
    );
  }
  if (axios.isAxiosError(err)) {
    const ax = err;
    const status = ax.response?.status;
    const data = ax.response?.data as Record<string, unknown> | undefined;
    const detail =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      (Array.isArray((data as { errors?: unknown })?.errors) &&
        ((data as { errors: { message?: string }[] }).errors[0]?.message ??
          null)) ||
      null;
    const message = detail ?? ax.message ?? 'Request failed';
    if (!status) return new NetworkError(message);
    if (status === 401) return new AuthError(message, 401);
    if (status === 409) return new ConflictError(message);
    if (status === 422) return new ValidationError(message);
    if (status >= 500) return new ServerError(message, status);
    return new AppError(message, 'HTTP', status);
  }
  if (err instanceof Error) return new AppError(err.message, 'UNKNOWN');
  return new AppError('Unknown error', 'UNKNOWN');
}
