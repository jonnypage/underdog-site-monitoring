"use client";

import { ResponsiveLine } from "@nivo/line";

type Point = { x: string | Date; y: number };

export function SensorLineChart({ data }: { data: Array<{ id: string; data: Point[] }> }) {
  const series = data
    .map((s) => ({
      id: s.id,
      data: s.data
        .map((p) => ({
          x: p.x instanceof Date ? p.x : new Date(String(p.x)),
          y: Number(p.y)
        }))
        .filter((p) => !Number.isNaN(p.x.getTime()) && Number.isFinite(p.y))
    }))
    .filter((s) => s.data.length > 0);

  if (series.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No measurements in this time range. Send ingest data or choose a wider range.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveLine
        data={series}
        margin={{ top: 20, right: 20, bottom: 60, left: 50 }}
        xScale={{ type: "time", precision: "minute" }}
        xFormat="time:%Y-%m-%d %H:%M"
        yScale={{ type: "linear", min: "auto", max: "auto", stacked: false, reverse: false }}
        axisBottom={{ format: "%m/%d %H:%M", tickRotation: -35 }}
        axisLeft={{ legendOffset: -40 }}
        pointSize={4}
        pointBorderWidth={1}
        useMesh
      />
    </div>
  );
}
