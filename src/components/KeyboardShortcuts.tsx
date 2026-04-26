"use client";

import { useState } from "react";

type OS = "mac" | "windows" | "unknown";

interface Shortcut {
  action: string;
  mac: string;
  windows: string;
}

const SHORTCUTS: Shortcut[] = [
  { action: "Copy", mac: "⌘ C", windows: "Ctrl C" },
  { action: "Paste", mac: "⌘ V", windows: "Ctrl V" },
  { action: "Cut", mac: "⌘ X", windows: "Ctrl X" },
  { action: "Undo", mac: "⌘ Z", windows: "Ctrl Z" },
  { action: "Select All", mac: "⌘ A", windows: "Ctrl A" },
  { action: "Find", mac: "⌘ F", windows: "Ctrl F" },
  { action: "Save", mac: "⌘ S", windows: "Ctrl S" },
  { action: "New Tab", mac: "⌘ T", windows: "Ctrl T" },
  { action: "Close Tab", mac: "⌘ W", windows: "Ctrl W" },
  { action: "Zoom In", mac: "⌘ +", windows: "Ctrl +" },
  { action: "Zoom Out", mac: "⌘ -", windows: "Ctrl -" },
  { action: "Switch Apps", mac: "⌘ Tab", windows: "Alt Tab" },
  { action: "Screenshot", mac: "⌘ Shift 4", windows: "Win Shift S" },
  { action: "Refresh", mac: "⌘ R", windows: "F5" },
  { action: "New Window", mac: "⌘ N", windows: "Ctrl N" },
  { action: "Reopen Closed Tab", mac: "⌘ Shift T", windows: "Ctrl Shift T" },
];

export default function KeyboardShortcuts() {
  const [os] = useState<OS>(() => {
    if (typeof window !== "undefined") {
      const platform = navigator.platform;
      if (/Mac|iPhone|iPad|iPod/.test(platform)) {
        return "mac";
      } else if (/Win/.test(platform)) {
        return "windows";
      }
    }
    return "unknown";
  });
  const [isOpen, setIsOpen] = useState(false);

  const getShortcut = (shortcut: Shortcut): string => {
    if (os === "mac") return shortcut.mac;
    if (os === "windows") return shortcut.windows;
    return shortcut.mac; // Default to Mac
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 rounded-lg shadow-lg transition-all duration-150 text-sm font-medium"
        style={{ 
          backgroundColor: "var(--color-surface)", 
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border)"
        }}
      >
        {isOpen ? "Hide" : "Shortcuts"}
      </button>

      {/* Collapsible Drawer */}
      {isOpen && (
        <div 
          className="absolute bottom-12 right-0 w-72 rounded-lg shadow-2xl p-4 animate-fade-in"
          style={{ 
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)"
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
              Keyboard Shortcuts ({os === "mac" ? "Mac" : os === "windows" ? "Windows" : "Mac"})
            </h3>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {SHORTCUTS.map((shortcut, index) => (
              <div
                key={index}
                className="flex justify-between items-center text-sm"
              >
                <span style={{ color: "var(--color-text-secondary)" }}>{shortcut.action}</span>
                <kbd 
                  className="px-2 py-1 rounded font-mono text-xs"
                  style={{ 
                    backgroundColor: "var(--color-surface-hover)", 
                    color: "var(--color-text-primary)" 
                  }}
                >
                  {getShortcut(shortcut)}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
