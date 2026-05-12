"use client";

import { ResponsiveLine } from "@nivo/line";
import dayjs from "dayjs";

type Point = { x: string | Date; y: number };

export function HistoricalLineChart({ 
  data, 
  min, 
  max,
  unit,
  timeRange
}: { 
  data: Point[]; 
  min?: number; 
  max?: number;
  unit: string;
  timeRange: "LAST_24H" | "LAST_7D" | "LAST_30D";
}) {
  const points = data
    .map((p) => ({
      x: p.x instanceof Date ? p.x : new Date(String(p.x)),
      y: Number(p.y)
    }))
    .filter((p) => !Number.isNaN(p.x.getTime()) && Number.isFinite(p.y))
    .sort((a, b) => a.x.getTime() - b.x.getTime());

  if (points.length < 2) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-muted-foreground italic border border-dashed border-border rounded-md">
        Not enough historical data to display a chart.
      </div>
    );
  }

  const formatXAxis = (date: Date) => {
    if (timeRange === "LAST_24H") {
      return dayjs(date).format("HH:mm");
    } else if (timeRange === "LAST_7D") {
      return dayjs(date).format("MMM D, HH:mm");
    } else {
      return dayjs(date).format("MMM D");
    }
  };

  const tickValues = timeRange === "LAST_24H" ? "every 3 hours" : timeRange === "LAST_7D" ? "every 1 day" : "every 3 days";

  return (
    <div className="h-[400px] w-full">
      <ResponsiveLine
        data={[{ id: "trend", data: points }]}
        margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
        xScale={{ type: "time", precision: "minute" }}
        yScale={{ 
          type: "linear", 
          min: min ?? "auto", 
          max: max ?? "auto", 
          stacked: false 
        }}
        curve="monotoneX"
        axisTop={null}
        axisRight={null}
        axisBottom={{
          format: formatXAxis,
          tickValues: tickValues,
          tickSize: 5,
          tickPadding: 5,
          tickRotation: -45,
          legend: 'Time',
          legendOffset: 50,
          legendPosition: 'middle'
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: unit,
          legendOffset: -45,
          legendPosition: 'middle'
        }}
        enableGridX={true}
        enableGridY={true}
        enablePoints={true}
        pointSize={6}
        pointColor={{ theme: 'background' }}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        enableArea={true}
        areaOpacity={0.1}
        colors={["#0f766e"]}
        useMesh={true}
        theme={{
          grid: { line: { stroke: "hsl(var(--border))", strokeDasharray: "4 4" } },
          axis: { 
            ticks: { text: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } },
            legend: { text: { fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 } }
          },
          tooltip: {
            container: {
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            }
          }
        }}
        animate={true}
      />
    </div>
  );
}
