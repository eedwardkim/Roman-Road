"use client";

import { useState } from "react";
import { BigramTableData } from "@/lib/db/sessions";

interface BigramTableProps {
  title: string;
  data: BigramTableData[];
}

type SortColumn = "bigram" | "avg_latency_ms" | "normalized_score" | "sample_count";
type SortDirection = "asc" | "desc";

const getSortIcon = (column: SortColumn, sortColumn: SortColumn, sortDirection: SortDirection): string | null => {
  if (sortColumn !== column) return null;
  return sortDirection === "asc" ? " ↑" : " ↓";
};

export default function BigramTable({ title, data }: BigramTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("normalized_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const formatLatency = (ms: number) => `${ms.toFixed(1)}ms`;
  const formatScore = (score: number) => score.toFixed(2);

  return (
    <div className="w-full min-w-0">
      <h3 className="text-xl font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      {data.length === 0 ? (
        <div className="p-6 rounded-lg text-center" style={{ backgroundColor: "var(--color-surface)" }}>
          <p style={{ color: "var(--color-text-secondary)" }}>No data available yet</p>
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-lg" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <table className="w-full min-w-[34rem] border-collapse table-fixed text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--color-surface-hover)", borderBottom: "1px solid var(--color-border)" }}>
                <th
                  className="px-6 py-4 text-left font-medium cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ color: "var(--color-text-primary)" }}
                  onClick={() => handleSort("bigram")}
                >
                  Bi-grammar{getSortIcon("bigram", sortColumn, sortDirection)}
                </th>
                <th
                  className="px-6 py-4 text-left font-medium cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ color: "var(--color-text-primary)" }}
                  onClick={() => handleSort("avg_latency_ms")}
                >
                  Avg Latency{getSortIcon("avg_latency_ms", sortColumn, sortDirection)}
                </th>
                <th
                  className="px-6 py-4 text-left font-medium cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ color: "var(--color-text-primary)" }}
                  onClick={() => handleSort("normalized_score")}
                >
                  Score{getSortIcon("normalized_score", sortColumn, sortDirection)}
                </th>
                <th
                  className="px-6 py-4 text-left font-medium cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ color: "var(--color-text-primary)" }}
                  onClick={() => handleSort("sample_count")}
                >
                  Sample Count{getSortIcon("sample_count", sortColumn, sortDirection)}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item) => (
                <tr
                  key={item.bigram}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                  className="hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <td className="px-6 py-4 font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {item.bigram}
                  </td>
                  <td className="px-6 py-4" style={{ color: "var(--color-text-secondary)" }}>
                    {formatLatency(item.avg_latency_ms)}
                  </td>
                  <td className="px-6 py-4" style={{ color: "var(--color-text-secondary)" }}>
                    {formatScore(item.normalized_score)}
                  </td>
                  <td className="px-6 py-4" style={{ color: "var(--color-text-secondary)" }}>
                    {item.sample_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
