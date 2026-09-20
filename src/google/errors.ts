export type ErrorKind =
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'rate_limit'
  | 'network'
  | 'schema'
  | 'conflict'
  | 'cancelled'
  | 'unknown';

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly status: number | undefined;
  constructor(kind: ErrorKind, message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof TypeError) return new AppError('network', e.message, undefined, { cause: e });
  return new AppError('unknown', e instanceof Error ? e.message : String(e), undefined, {
    cause: e,
  });
}
