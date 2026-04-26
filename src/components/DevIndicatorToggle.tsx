"use client";

import { useEffect } from "react";

/**
 * Toggles the Next.js dev indicator (the "Issues" badge) when the user
 * presses V + 4 simultaneously. Hidden by default via CSS in globals.css.
 */
export default function DevIndicatorToggle() {
  useEffect(() => {
    const pressed = new Set<string>();

    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      pressed.add(e.key.toLowerCase());
      if (pressed.has("v") && pressed.has("4")) {
        document.documentElement.classList.toggle("show-dev-indicator");
        pressed.clear();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.key.toLowerCase());
    };

    const onBlur = () => pressed.clear();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return null;
}
