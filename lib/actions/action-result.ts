/**
 * lib/actions/action-result.ts
 *
 * Every Server Action in lib/actions/* returns an ActionResult<T> instead
 * of throwing. This keeps the client-side call sites (React Hook Form
 * submit handlers, TanStack Query mutations) able to render field-level
 * and form-level errors without try/catch boilerplate everywhere, and
 * keeps unexpected exceptions from leaking internal error details to
 * the client.
 */

import { ZodError } from "zod";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T = never>(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<T> {
  return { success: false, error, fieldErrors };
}

/**
 * Normalizes anything thrown inside a Server Action (Zod validation
 * errors, Postgres/PostgREST errors, plain Errors) into an ActionResult.
 * Postgres error codes we specifically translate to friendly messages:
 *   23505 unique_violation, 23503 foreign_key_violation,
 *   23514 check_violation, 42501 insufficient_privilege (RLS denial).
 */
export function toActionError<T = never>(err: unknown): ActionResult<T> {
  if (err instanceof ZodError) {
    return fail("Validation failed.", err.flatten().fieldErrors as Record<string, string[]>);
  }

  if (isPostgrestError(err)) {
    switch (err.code) {
      case "23505":
        return fail("A record with that value already exists.");
      case "23503":
        return fail("This action references a record that no longer exists.");
      case "23514":
        return fail("That value doesn't satisfy a required constraint.");
      case "42501":
        return fail("You don't have permission to perform this action.");
      default:
        return fail(err.message || "Database error.");
    }
  }

  if (err instanceof Error) {
    return fail(err.message);
  }

  return fail("An unexpected error occurred.");
}

interface PostgrestLikeError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

function isPostgrestError(err: unknown): err is PostgrestLikeError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  );
}
