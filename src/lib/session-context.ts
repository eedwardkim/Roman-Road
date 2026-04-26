import type { TypingMode } from "@/lib/wordSources";

export type SessionMode = TypingMode | "system_wide" | "wpm_test";
export type SessionCaptureSource = "in_app" | "system_wide";
export type SessionTextOrigin = "prompted" | "freeform";
export type SessionContextKey =
  | "in_app_prompted"
  | "in_app_freeform"
  | "system_wide_prompted"
  | "system_wide_freeform";

export interface SessionContext {
  mode: string;
  captureSource: SessionCaptureSource;
  textOrigin: SessionTextOrigin;
  contextKey: SessionContextKey;
}

export const IN_APP_PROMPTED_CONTEXT: SessionContextKey = "in_app_prompted";
export const IN_APP_FREEFORM_CONTEXT: SessionContextKey = "in_app_freeform";
export const SYSTEM_WIDE_FREEFORM_CONTEXT: SessionContextKey = "system_wide_freeform";

export function buildSessionContextKey(
  captureSource: SessionCaptureSource,
  textOrigin: SessionTextOrigin
): SessionContextKey {
  return `${captureSource}_${textOrigin}` as SessionContextKey;
}

export function getSessionContext(
  mode: string,
  overrides: Partial<Pick<SessionContext, "captureSource" | "textOrigin">> = {}
): SessionContext {
  const captureSource = overrides.captureSource ?? inferCaptureSource(mode);
  const textOrigin = overrides.textOrigin ?? inferTextOrigin(mode, captureSource);

  return {
    mode,
    captureSource,
    textOrigin,
    contextKey: buildSessionContextKey(captureSource, textOrigin),
  };
}

export function isContextAwareRecord(value: {
  context_key?: string;
}): value is { context_key: SessionContextKey } {
  return typeof value.context_key === "string" && value.context_key.length > 0;
}

function inferCaptureSource(mode: string): SessionCaptureSource {
  if (mode === "system_wide") {
    return "system_wide";
  }

  return "in_app";
}

function inferTextOrigin(
  mode: string,
  captureSource: SessionCaptureSource
): SessionTextOrigin {
  if (captureSource === "system_wide" || mode === "free") {
    return "freeform";
  }

  return "prompted";
}
