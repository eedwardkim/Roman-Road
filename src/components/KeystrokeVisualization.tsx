"use client";

import { useEffect, useRef } from "react";

interface KeystrokeVisualizationProps {
  keystrokes: number[];
  isActive: boolean;
}

export default function KeystrokeVisualization({
  keystrokes,
  isActive,
}: KeystrokeVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 100;
      }
    };
    
    resizeCanvas();
    const handleResize = () => resizeCanvas();
    window.addEventListener("resize", handleResize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isActive || keystrokes.length === 0) {
        // Draw idle state
        ctx.strokeStyle = "rgba(163, 163, 175, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        return;
      }

      // Draw keystroke rhythm visualization
      const recentKeystrokes = keystrokes.slice(-50);
      const maxLatency = Math.max(...recentKeystrokes, 100);
      const minLatency = Math.min(...recentKeystrokes, 0);

      ctx.strokeStyle = "rgba(16, 185, 129, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      recentKeystrokes.forEach((latency, index) => {
        const x = (index / recentKeystrokes.length) * canvas.width;
        const normalizedLatency = (latency - minLatency) / (maxLatency - minLatency || 1);
        const y = canvas.height - (normalizedLatency * canvas.height * 0.8 + canvas.height * 0.1);

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw dots at each point
      ctx.fillStyle = "rgba(16, 185, 129, 1)";
      recentKeystrokes.forEach((latency, index) => {
        const x = (index / recentKeystrokes.length) * canvas.width;
        const normalizedLatency = (latency - minLatency) / (maxLatency - minLatency || 1);
        const y = canvas.height - (normalizedLatency * canvas.height * 0.8 + canvas.height * 0.1);

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    draw();
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [keystrokes, isActive]);

  return (
    <div
      className="border p-4"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="border-b pb-2 mb-3" style={{ borderColor: "var(--color-border)" }}>
        <h3 className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
          Typing Rhythm
        </h3>
      </div>
      <canvas ref={canvasRef} className="w-full" style={{ height: "100px" }} />
    </div>
  );
}
