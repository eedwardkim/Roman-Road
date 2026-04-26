"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  usePlotArea,
  type PlotArea,
} from "recharts";
import { SessionWPMData } from "@/lib/db/sessions";

interface WPMChartProps {
  data: SessionWPMData[];
  onDeleteSession?: (sessionId: string) => void;
  onUpdateSessionWpm?: (sessionId: string, wpm: number) => void | Promise<void>;
  showDevTools?: boolean;
  isDeletingSession?: boolean;
  isUpdatingSessionWpm?: boolean;
}

type SeriesKey = "structured" | "drill" | "freeform";
type SeriesPointKey = "structuredPoint" | "drillPoint" | "freeformPoint";
type SeriesValueKey =
  | "structuredRawWpm"
  | "structuredTrendWpm"
  | "drillRawWpm"
  | "drillTrendWpm"
  | "freeformRawWpm"
  | "freeformTrendWpm";

interface SeriesDefinition {
  key: SeriesKey;
  label: string;
  color: string;
  rawKey: SeriesValueKey;
  trendKey: SeriesValueKey;
  pointKey: SeriesPointKey;
}

const SERIES_DEFINITIONS: SeriesDefinition[] = [
  {
    key: "structured",
    label: "Normal / random structured tests",
    color: "#60a5fa",
    rawKey: "structuredRawWpm",
    trendKey: "structuredTrendWpm",
    pointKey: "structuredPoint",
  },
  {
    key: "drill",
    label: "Drill sessions",
    color: "#f59e0b",
    rawKey: "drillRawWpm",
    trendKey: "drillTrendWpm",
    pointKey: "drillPoint",
  },
  {
    key: "freeform",
    label: "Freeform / system-wide",
    color: "#34d399",
    rawKey: "freeformRawWpm",
    trendKey: "freeformTrendWpm",
    pointKey: "freeformPoint",
  },
];

const ROLLING_WINDOW_SIZE = 3;
const CHART_HEIGHT_PX = 320;

interface SessionPointMeta {
  id: string;
  sessionNumber: number;
  timestamp: number;
  absoluteDate: string;
  relativeTime: string;
  wpm: number;
  seriesKey: SeriesKey;
  seriesLabel: string;
  sourceLabel: string;
  originLabel: string;
  modeLabel: string;
}

type SessionPointSeed = Omit<SessionPointMeta, "sessionNumber">;

interface ChartPoint extends Record<SeriesValueKey, number | null> {
  sessionNumber: number;
  structuredPoint: SessionPointMeta | null;
  drillPoint: SessionPointMeta | null;
  freeformPoint: SessionPointMeta | null;
}

interface HoverTooltipState {
  point: SessionPointMeta;
  color: string;
  clientX: number;
  clientY: number;
}

interface DragState {
  pointId: string;
  pointerId: number;
  color: string;
  startClientY: number;
  startWpm: number;
  previewWpm: number;
  wpmPerPixel: number;
  hasDragged: boolean;
}

const DRAG_THRESHOLD_PX = 3;

function normalizeEditableWpm(wpm: number) {
  if (!Number.isFinite(wpm)) {
    return 0;
  }

  return Math.max(0, Math.round(wpm));
}

function ChartPlotAreaBridge({ onPlotAreaChange }: { onPlotAreaChange: (plotArea: PlotArea | undefined) => void }) {
  const plotArea = usePlotArea();

  useEffect(() => {
    onPlotAreaChange(plotArea);
  }, [onPlotAreaChange, plotArea]);

  return null;
}

function formatRelativeTime(timestamp: number, now: number) {
  const elapsedMs = Math.max(0, now - timestamp);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedHours = Math.floor(elapsedMs / 3600000);
  const elapsedDays = Math.floor(elapsedMs / 86400000);

  if (elapsedHours < 1) {
    const minutes = Math.max(1, elapsedMinutes);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

function formatSourceLabel(session: SessionWPMData) {
  return session.capture_source === "system_wide" ? "Free writing" : "Website";
}

function formatOriginLabel(session: SessionWPMData) {
  return session.text_origin === "freeform" ? "Freeform" : "Prompted";
}

function formatModeLabel(mode: string) {
  switch (mode) {
    case "random":
      return "Random";
    case "normal":
      return "Normal";
    case "quote":
      return "Quote";
    case "drill":
      return "Drill";
    case "free":
      return "Freeform";
    case "system_wide":
      return "System-wide";
    case "wpm_test":
      return "WPM test";
    default:
      return mode;
  }
}

function getSeriesDefinition(session: SessionWPMData): SeriesDefinition {
  if (
    session.capture_source === "system_wide" ||
    session.text_origin === "freeform" ||
    session.mode === "free" ||
    session.mode === "system_wide"
  ) {
    return SERIES_DEFINITIONS[2];
  }

  if (session.mode === "drill") {
    return SERIES_DEFINITIONS[1];
  }

  return SERIES_DEFINITIONS[0];
}

function buildRollingAverage(points: SessionPointMeta[]) {
  return points.map((point, index) => {
    const windowStart = Math.max(0, index - ROLLING_WINDOW_SIZE + 1);
    const windowPoints = points.slice(windowStart, index + 1);
    const average =
      windowPoints.reduce((total, entry) => total + entry.wpm, 0) /
      windowPoints.length;

    return Number(average.toFixed(1));
  });
}

function buildProjectedTrend(points: SessionPointMeta[], maxSessionCount: number) {
  if (maxSessionCount === 0) {
    return [] as Array<number | null>;
  }

  const projectedTrend = Array.from({ length: maxSessionCount }, () => null as number | null);

  if (points.length === 0) {
    return projectedTrend;
  }

  const rollingAverage = buildRollingAverage(points);
  points.forEach((point, index) => {
    const chartIndex = point.sessionNumber - 1;

    if (chartIndex >= 0 && chartIndex < maxSessionCount) {
      projectedTrend[chartIndex] = rollingAverage[index];
    }
  });

  const lastDelta =
    rollingAverage.length >= 2
      ? rollingAverage[rollingAverage.length - 1] - rollingAverage[rollingAverage.length - 2]
      : 0;
  const lastPoint = points[points.length - 1];
  let previousValue = rollingAverage[rollingAverage.length - 1] ?? 0;

  for (let index = lastPoint.sessionNumber; index < maxSessionCount; index += 1) {
    previousValue = Math.max(0, previousValue + lastDelta);
    projectedTrend[index] = Number(previousValue.toFixed(1));
  }

  return projectedTrend;
}

function WPMTooltip({ point, color, clientX, clientY }: HoverTooltipState) {
  const placeBelow = clientY < 180;

  if (!point) {
    return null;
  }

  return (
    <div
      className="rounded-lg px-4 py-3 text-sm shadow-lg"
      style={{
        position: "fixed",
        left: clientX + 12,
        top: placeBelow ? clientY + 12 : clientY - 12,
        transform: placeBelow ? "none" : "translateY(-100%)",
        pointerEvents: "none",
        zIndex: 50,
        maxWidth: "18rem",
        backgroundColor: "var(--color-matte-gray)",
        border: "1px solid var(--color-matte-gray-light)",
        color: "#fafafa",
      }}
    >
      <div className="font-medium mb-3">Session {point.sessionNumber}</div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="font-medium">{point.seriesLabel}</div>
        </div>
        <div className="font-medium mb-2">{point.absoluteDate}</div>
        <div style={{ color: "var(--color-text-secondary)" }}>({point.relativeTime})</div>
        <div className="mt-2">wpm : {point.wpm}</div>
        <div>mode : {point.modeLabel}</div>
        <div>source : {point.sourceLabel}</div>
        <div>type : {point.originLabel}</div>
      </div>
    </div>
  );
}

export default function WPMChart({
  data,
  onDeleteSession,
  onUpdateSessionWpm,
  showDevTools = false,
  isDeletingSession = false,
  isUpdatingSessionWpm = false,
}: WPMChartProps) {
  const [now] = useState(() => Date.now());
  const [hoveredTooltip, setHoveredTooltip] = useState<HoverTooltipState | null>(null);
  const [draftWpmBySession, setDraftWpmBySession] = useState<Record<string, number>>({});
  const [dragState, setDragState] = useState<DragState | null>(null);
  const plotAreaRef = useRef<PlotArea | undefined>(undefined);
  const yAxisDomainRef = useRef<[number, number]>([0, 100]);
  const isSessionMutationPending = isDeletingSession || isUpdatingSessionWpm;

  const handlePlotAreaChange = useCallback((plotArea: PlotArea | undefined) => {
    plotAreaRef.current = plotArea;
  }, []);

  const clearDraftWpm = useCallback((sessionId: string) => {
    setDraftWpmBySession((current) => {
      if (!(sessionId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[sessionId];
      return next;
    });
  }, []);

  const handlePointClick = useCallback((point: SessionPointMeta) => {
    if (showDevTools && onDeleteSession && !isSessionMutationPending) {
      if (confirm(`Delete session from ${point.absoluteDate} (${point.wpm} WPM)?`)) {
        onDeleteSession(point.id);
      }
    }
  }, [showDevTools, onDeleteSession, isSessionMutationPending]);

  const commitWpmEdit = useCallback(async (point: SessionPointMeta, wpm: number) => {
    if (!onUpdateSessionWpm) {
      clearDraftWpm(point.id);
      return;
    }

    try {
      await onUpdateSessionWpm(point.id, wpm);
    } finally {
      clearDraftWpm(point.id);
    }
  }, [clearDraftWpm, onUpdateSessionWpm]);

  const handlePointPointerDown = useCallback((point: SessionPointMeta, color: string, event: PointerEvent<SVGGElement>) => {
    if (event.button !== 0 || !showDevTools || isSessionMutationPending) {
      return;
    }

    const plotArea = plotAreaRef.current;
    const yAxisDomain = yAxisDomainRef.current;
    const plotHeight = plotArea && plotArea.height > 0 ? plotArea.height : 320;
    const domainRange = Math.max(1, yAxisDomain[1] - yAxisDomain[0]);
    const startWpm = normalizeEditableWpm(point.wpm);

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
    }

    setDraftWpmBySession((current) => ({
      ...current,
      [point.id]: startWpm,
    }));
    setDragState({
      pointId: point.id,
      pointerId: event.pointerId,
      color,
      startClientY: event.clientY,
      startWpm,
      previewWpm: startWpm,
      wpmPerPixel: domainRange / plotHeight,
      hasDragged: false,
    });
    setHoveredTooltip({
      point: {
        ...point,
        wpm: startWpm,
      },
      color,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, [isSessionMutationPending, showDevTools]);

  const handlePointPointerMove = useCallback((point: SessionPointMeta, event: PointerEvent<SVGGElement>) => {
    if (!dragState || dragState.pointId !== point.id || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - dragState.startClientY;
    const nextWpm = normalizeEditableWpm(dragState.startWpm - deltaY * dragState.wpmPerPixel);
    const hasDragged = dragState.hasDragged || Math.abs(deltaY) >= DRAG_THRESHOLD_PX;

    event.preventDefault();
    event.stopPropagation();

    setDraftWpmBySession((current) => (
      current[point.id] === nextWpm
        ? current
        : {
            ...current,
            [point.id]: nextWpm,
          }
    ));
    setDragState((current) => (
      current && current.pointId === point.id && current.pointerId === event.pointerId
        ? {
            ...current,
            previewWpm: nextWpm,
            hasDragged,
          }
        : current
    ));
    setHoveredTooltip({
      point: {
        ...point,
        wpm: nextWpm,
      },
      color: dragState.color,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, [dragState]);

  const handlePointPointerUp = useCallback((point: SessionPointMeta, event: PointerEvent<SVGGElement>) => {
    if (!dragState || dragState.pointId !== point.id || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
    }

    const completedDrag = dragState;
    setDragState(null);

    if (!completedDrag.hasDragged) {
      clearDraftWpm(point.id);
      handlePointClick(point);
      return;
    }

    if (completedDrag.previewWpm === completedDrag.startWpm) {
      clearDraftWpm(point.id);
      return;
    }

    void commitWpmEdit(point, completedDrag.previewWpm).catch((error) => {
      console.error("Failed to commit WPM edit:", error);
    });
  }, [clearDraftWpm, commitWpmEdit, dragState, handlePointClick]);

  const handlePointPointerCancel = useCallback((point: SessionPointMeta, event: PointerEvent<SVGGElement>) => {
    if (!dragState || dragState.pointId !== point.id || dragState.pointerId !== event.pointerId) {
      return;
    }

    clearDraftWpm(point.id);
    setDragState(null);
  }, [clearDraftWpm, dragState]);

  const handlePointKeyDown = useCallback((point: SessionPointMeta, event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    handlePointClick(point);
  }, [handlePointClick]);

  const handlePointHover = useCallback(
    (point: SessionPointMeta, color: string, event: MouseEvent<SVGElement>) => {
      setHoveredTooltip({
        point,
        color,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    []
  );

  const handlePointLeave = useCallback(() => {
    setHoveredTooltip((current) => (current ? null : current));
  }, []);

  const handleChartMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;

    if (!(target instanceof Element) || !target.closest('[data-session-dot="true"]')) {
      setHoveredTooltip((current) => (current ? null : current));
    }
  }, []);

  const chartData = useMemo(() => {
    const sessionSeeds = data
      .map((session) => {
        const timestamp = new Date(session.started_at).getTime();
        const series = getSeriesDefinition(session);
        const draftWpm = draftWpmBySession[session.id];
        const wpm = typeof draftWpm === "number" ? draftWpm : Number(session.wpm) || 0;

        return {
          id: session.id,
          timestamp,
          absoluteDate: new Date(session.started_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
          relativeTime: formatRelativeTime(timestamp, now),
          wpm,
          seriesKey: series.key,
          seriesLabel: series.label,
          sourceLabel: formatSourceLabel(session),
          originLabel: formatOriginLabel(session),
          modeLabel: formatModeLabel(session.mode),
        } satisfies SessionPointSeed;
      })
      .filter((point) => Number.isFinite(point.timestamp));

    const chronologicalSeries = [...sessionSeeds].sort((a, b) => a.timestamp - b.timestamp);
    const structuredSeries = chronologicalSeries
      .filter((point) => point.seriesKey === "structured")
      .map((point, index) => ({
        ...point,
        sessionNumber: index + 1,
      }));
    const drillSeries = chronologicalSeries
      .filter((point) => point.seriesKey === "drill")
      .map((point, index) => ({
        ...point,
        sessionNumber: index + 1,
      }));
    const freeformSeries = chronologicalSeries
      .filter((point) => point.seriesKey === "freeform")
      .map((point, index) => ({
        ...point,
        sessionNumber: index + 1,
      }));

    const maxSessionCount = Math.max(
      structuredSeries.length,
      drillSeries.length,
      freeformSeries.length,
    );

    if (maxSessionCount === 0) {
      return [] as ChartPoint[];
    }

    const structuredTrend = buildProjectedTrend(structuredSeries, maxSessionCount);
    const drillTrend = buildProjectedTrend(drillSeries, maxSessionCount);
    const freeformTrend = buildProjectedTrend(freeformSeries, maxSessionCount);
    const structuredBySessionNumber = new Map(structuredSeries.map((point) => [point.sessionNumber, point]));
    const drillBySessionNumber = new Map(drillSeries.map((point) => [point.sessionNumber, point]));
    const freeformBySessionNumber = new Map(freeformSeries.map((point) => [point.sessionNumber, point]));

    return Array.from({ length: maxSessionCount }, (_, index) => {
      const sessionNumber = index + 1;
      const structuredPoint = structuredBySessionNumber.get(sessionNumber) ?? null;
      const drillPoint = drillBySessionNumber.get(sessionNumber) ?? null;
      const freeformPoint = freeformBySessionNumber.get(sessionNumber) ?? null;

      return {
        sessionNumber,
        structuredRawWpm: structuredPoint?.wpm ?? null,
        structuredTrendWpm: structuredTrend[index] ?? null,
        drillRawWpm: drillPoint?.wpm ?? null,
        drillTrendWpm: drillTrend[index] ?? null,
        freeformRawWpm: freeformPoint?.wpm ?? null,
        freeformTrendWpm: freeformTrend[index] ?? null,
        structuredPoint,
        drillPoint,
        freeformPoint,
      } satisfies ChartPoint;
    });
  }, [data, draftWpmBySession, now]);

  const yAxisDomain = useMemo<[number, number]>(() => {
    const values: number[] = [];

    chartData.forEach((point) => {
      SERIES_DEFINITIONS.forEach((series) => {
        const rawValue = point[series.rawKey];
        const trendValue = point[series.trendKey];

        if (typeof rawValue === "number") {
          values.push(rawValue);
        }

        if (typeof trendValue === "number") {
          values.push(trendValue);
        }
      });
    });

    if (values.length === 0) {
      return [0, 100];
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(maxValue - minValue, Math.max(10, maxValue * 0.1));
    const lowerPadding = Math.max(2, range * 0.08);
    const upperPadding = Math.max(4, range * 0.12);
    const domainMin = Math.max(0, Math.floor(minValue - lowerPadding));
    const domainMax = Math.ceil(maxValue + upperPadding);

    if (domainMax <= domainMin) {
      return [domainMin, domainMin + 10];
    }

    return [domainMin, domainMax];
  }, [chartData]);
  const xAxisMax = chartData.length > 0 ? chartData[chartData.length - 1].sessionNumber : 1;
  const xAxisTickCount = Math.max(1, Math.min(xAxisMax, 8));

  useEffect(() => {
    yAxisDomainRef.current = yAxisDomain;
  }, [yAxisDomain]);

  // Debug: log the data being rendered
  console.log("WPMChart data:", { raw: data, chartData });

  return (
    <div className="w-full min-w-0">
      <h3 className="text-xl font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        WPM Over Time
      </h3>
      {chartData.length === 0 ? (
        <div className="p-8 rounded-lg text-center" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="text-4xl mb-4">📊</div>
          <h4 className="text-lg font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
            No Data Yet
          </h4>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Complete some typing tests to see your WPM progress over time
          </p>
          <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ backgroundColor: "var(--color-surface-hover)", color: "var(--color-accent)" }}>
            Start a typing test
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="mb-4 flex min-w-0 flex-wrap gap-3 text-sm">
            {SERIES_DEFINITIONS.map((series) => (
              <div
                key={series.key}
                className="flex min-w-0 items-center gap-2 rounded-full px-3 py-1"
                style={{
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text-primary)",
                }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                <span className="min-w-0">{series.label}</span>
              </div>
            ))}
          </div>
          <div className="mb-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Trend lines show a 3-session rolling average. Raw session points are shown with lower opacity.
          </div>
          {showDevTools ? (
            <div className="mb-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              {isSessionMutationPending
                ? "Saving session change..."
                : "Dev mode: drag raw session points up/down to edit WPM. Click without dragging to delete."}
            </div>
          ) : null}
          <div className="w-full min-w-0 pb-2" onMouseLeave={handlePointLeave} onMouseMove={handleChartMouseMove}>
            <div className="w-full min-w-0" style={{ height: CHART_HEIGHT_PX }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <ChartPlotAreaBridge onPlotAreaChange={handlePlotAreaChange} />
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#71717a"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="sessionNumber"
                  type="number"
                  domain={[1, xAxisMax]}
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickCount={xAxisTickCount}
                  minTickGap={24}
                  tickFormatter={(sessionNumber) => `${Number(sessionNumber)}`}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={yAxisDomain}
                  allowDataOverflow={false}
                  label={{ value: "WPM", angle: -90, position: "insideLeft" }}
                />
                {SERIES_DEFINITIONS.map((series) => (
                  <Line
                    key={`${series.key}-raw`}
                    type="linear"
                    dataKey={series.rawKey}
                    stroke={series.color}
                    strokeOpacity={0.18}
                    strokeWidth={1.5}
                    connectNulls
                    name={series.label}
                    legendType="none"
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const value = payload?.[series.rawKey];
                      const point = payload?.[series.pointKey];

                      if (
                        typeof value !== "number" ||
                        !Number.isFinite(value) ||
                        !point ||
                        typeof cx !== "number" ||
                        !Number.isFinite(cx) ||
                        typeof cy !== "number" ||
                        !Number.isFinite(cy)
                      ) {
                        return null;
                      }

                      return (
                        <g
                          data-session-dot="true"
                          role={showDevTools ? "button" : undefined}
                          tabIndex={showDevTools ? 0 : undefined}
                          style={{
                            cursor: showDevTools && !isSessionMutationPending ? "ns-resize" : "default",
                            touchAction: showDevTools ? "none" : undefined,
                          }}
                          onMouseEnter={(event) => handlePointHover(point, series.color, event)}
                          onMouseMove={(event) => handlePointHover(point, series.color, event)}
                          onMouseLeave={handlePointLeave}
                          onPointerDown={(event) => handlePointPointerDown(point, series.color, event)}
                          onPointerMove={(event) => handlePointPointerMove(point, event)}
                          onPointerUp={(event) => handlePointPointerUp(point, event)}
                          onPointerCancel={(event) => handlePointPointerCancel(point, event)}
                          onKeyDown={(event) => handlePointKeyDown(point, event)}
                        >
                          <circle
                            cx={cx}
                            cy={cy}
                            r={showDevTools ? 12 : 8}
                            fill="transparent"
                            pointerEvents="all"
                          />
                          <circle
                            cx={cx}
                            cy={cy}
                            r={hoveredTooltip?.point.id === point.id ? 6 : 3}
                            fill={series.color}
                            fillOpacity={0.4}
                            stroke={series.color}
                            strokeOpacity={0.4}
                            strokeWidth={1}
                            pointerEvents="none"
                          />
                        </g>
                      );
                    }}
                    activeDot={false}
                  />
                ))}
                {SERIES_DEFINITIONS.map((series) => (
                  <Line
                    key={`${series.key}-trend`}
                    type="monotone"
                    dataKey={series.trendKey}
                    stroke={series.color}
                    strokeWidth={3}
                    connectNulls
                    dot={false}
                    activeDot={false}
                    name={series.label}
                  />
                ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {hoveredTooltip ? <WPMTooltip {...hoveredTooltip} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
