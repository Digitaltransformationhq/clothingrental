/**
 * Typed application errors.
 *
 * Two audiences read an error: the member, who needs to know what to do next,
 * and the operator, who needs to know what actually happened. These classes
 * carry both, separately — `message` is written for the member and is safe to
 * render, while `cause` and any internal detail stay on the server.
 *
 * That separation is why nothing in this codebase renders a caught error's raw
 * message. A Prisma constraint violation contains table names, column names and
 * sometimes the offending values; showing it to a member is both incompre-
 * hensible and an information leak.
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "UNAVAILABLE"
  | "PAYMENT_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Field-level problems, keyed by form field name. */
  readonly fields?: Readonly<Record<string, string>>;
  readonly status: number;

  constructor(
    code: ErrorCode,
    message: string,
    options: { fields?: Record<string, string>; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.fields = options.fields;
    this.status = STATUS_BY_CODE[code];
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  UNAVAILABLE: 409,
  PAYMENT_FAILED: 402,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/**
 * Constructors for the errors that occur often enough to be worth naming.
 * The copy lives here rather than at each call site so the same situation reads
 * the same way wherever a member meets it.
 */
export const errors = {
  unauthenticated: (message = "Sign in to continue.") => new AppError("UNAUTHENTICATED", message),

  forbidden: (message = "That isn't yours to change.") => new AppError("FORBIDDEN", message),

  notFound: (what = "page") =>
    new AppError("NOT_FOUND", `We couldn't find that ${what}. It may have been removed.`),

  validation: (message: string, fields?: Record<string, string>) =>
    new AppError("VALIDATION", message, { fields }),

  conflict: (message: string) => new AppError("CONFLICT", message),

  unavailable: (message: string) => new AppError("UNAVAILABLE", message),

  paymentFailed: (message = "The payment didn't go through. You haven't been charged.") =>
    new AppError("PAYMENT_FAILED", message),

  rateLimited: (message = "That's a few too many attempts. Try again in a minute.") =>
    new AppError("RATE_LIMITED", message),

  internal: (cause?: unknown) =>
    new AppError(
      "INTERNAL",
      "Something went wrong at our end. Nothing has been charged, and we've been told about it.",
      { cause },
    ),
};

/**
 * Converts anything thrown into something safe to send to a client.
 *
 * Unrecognised errors are logged in full and reported as a generic internal
 * error, because an unexpected exception is exactly the kind that carries
 * details we do not want to publish.
 */
export function toClientError(error: unknown): {
  code: ErrorCode;
  message: string;
  fields?: Readonly<Record<string, string>>;
} {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.fields && { fields: error.fields }),
    };
  }

  console.error("[almirah] unhandled error:", error);
  const generic = errors.internal(error);
  return { code: generic.code, message: generic.message };
}

/** The shape every server action returns. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: ErrorCode; message: string; fields?: Readonly<Record<string, string>> };
    };

export function actionOk(): ActionResult<void>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function actionFailed(error: unknown): ActionResult<never> {
  return { ok: false, error: toClientError(error) };
}

/**
 * Wraps a server action so that a thrown error becomes a typed result rather
 * than an unhandled rejection and a blank screen.
 *
 * Next.js redirect and notFound signals are re-thrown untouched: they are
 * control flow implemented as exceptions, and swallowing them would break
 * navigation.
 */
export async function guard<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return actionOk(await operation());
  } catch (error) {
    if (isFrameworkSignal(error)) throw error;
    return actionFailed(error);
  }
}

function isFrameworkSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" && (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE")
  );
}
