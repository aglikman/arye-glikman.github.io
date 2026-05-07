"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ProgressPoint } from "@betterfly/shared";

const DOMAIN_COLORS: Record<string, string> = {
  anxiety:   "#ea580c",
  mood:      "#dc2626",
  sleep:     "#2563eb",
  attention: "#7c3aed",
  impairment:"#ca8a04",
};

interface ProgressChartProps {
  data: ProgressPoint[];
}

export function ProgressChart({ data }: ProgressChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        Progress chart will appear after the second assessment
      </div>
    );
  }

  const domains = Object.keys(DOMAIN_COLORS).filter((d) =>
    data.some((p) => p[d as keyof ProgressPoint] !== undefined)
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {domains.map((d) => (
          <Line
            key={d}
            type="monotone"
            dataKey={d}
            stroke={DOMAIN_COLORS[d]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
