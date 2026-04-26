"use client";

import { useMemo } from "react";

type CharacterStatus = "untyped" | "correct" | "incorrect" | "cursor";

interface CharacterData {
  char: string;
  status: CharacterStatus;
}

interface TypingDisplayProps {
  targetText: string;
  typedText: string;
  cursorPosition: number;
  cursorRef?: React.RefObject<HTMLSpanElement | null>;
  showCursor?: boolean;
}

export default function TypingDisplay({ targetText, typedText, cursorRef, showCursor = true }: TypingDisplayProps) {
  const characters = useMemo(() => {
    const result: CharacterData[] = [];
    
    for (let i = 0; i < targetText.length; i++) {
      const targetChar = targetText[i];
      const typedChar = typedText[i];
      
      let status: CharacterStatus;
      
      if (i < typedText.length) {
        // Character has been typed
        if (typedChar === targetChar) {
          status = "correct";
        } else {
          status = "incorrect";
        }
      } else if (i === typedText.length) {
        // Current cursor position
        status = "cursor";
      } else {
        // Not yet typed
        status = "untyped";
      }
      
      result.push({ char: targetChar, status });
    }
    
    return result;
  }, [targetText, typedText]);

  const characterGroups = useMemo(() => {
    const groups: { type: "word" | "space"; characters: CharacterData[] }[] = [];
    let currentWord: CharacterData[] = [];

    characters.forEach((charData) => {
      if (charData.char === " ") {
        if (currentWord.length > 0) {
          groups.push({ type: "word", characters: currentWord });
          currentWord = [];
        }

        groups.push({ type: "space", characters: [charData] });
        return;
      }

      currentWord.push(charData);
    });

    if (currentWord.length > 0) {
      groups.push({ type: "word", characters: currentWord });
    }

    return groups;
  }, [characters]);

  const getCharStyle = (status: CharacterStatus) => {
    switch (status) {
      case "untyped":
        return { color: "var(--color-text-muted)" };
      case "correct":
        return { color: "var(--color-text-primary)" };
      case "incorrect":
        return { color: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)" };
      case "cursor":
        return { 
          color: "var(--color-text-muted)",
        };
    }
  };

  const renderCursor = () => (
    <span
      ref={cursorRef}
      className="cursor-blink inline-block w-0.5 h-[1.2em] ml-px align-[-0.18em]"
      style={{ backgroundColor: "var(--color-accent)" }}
    />
  );

  return (
    <div
      className="font-mono text-lg leading-relaxed tracking-wide select-none"
      style={{
        color: "var(--color-text-primary)",
        wordBreak: "keep-all",
        whiteSpace: "normal",
        overflowWrap: "normal",
      }}
    >
      {characterGroups.map((group, groupIndex) => {
        if (group.type === "word") {
          return (
            <span
              key={groupIndex}
              className="inline-block"
              style={{
                wordBreak: "keep-all",
                whiteSpace: "nowrap",
                overflowWrap: "normal",
              }}
            >
              {group.characters.map((charData, charIndex) => {
                const style = getCharStyle(charData.status);

                return (
                  <span key={charIndex} style={style}>
                    {charData.status === "cursor" && showCursor && (
                      renderCursor()
                    )}
                    {charData.char}
                  </span>
                );
              })}
            </span>
          );
        }

        const charData = group.characters[0];
        const style = getCharStyle(charData.status);
        
        // Handle spaces specially
        return (
          <span key={groupIndex} style={style}>
            {charData.status === "cursor" && showCursor && (
              renderCursor()
            )}
            {" "}
          </span>
        );
      })}
      {/* Show cursor at the end if all text is typed */}
      {typedText.length >= targetText.length && showCursor && (
        renderCursor()
      )}
    </div>
  );
}
