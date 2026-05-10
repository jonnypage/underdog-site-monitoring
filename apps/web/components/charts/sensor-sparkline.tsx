"use client";

import { ResponsiveLine } from "@nivo/line";

type Point = { x: string | Date; y: number };

export function SensorSparkline({ 
  data, 
  min, 
  max 
}: { 
  data: Point[]; 
  min?: number; 
  max?: number;
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
      <div className="h-16 flex items-center justify-center text-[10px] text-muted-foreground italic border border-dashed border-border/50 rounded mt-2">
        Not enough trend data
      </div>
    );
  }

  return (
    <div className="h-16 w-full mt-2">
      <ResponsiveLine
        data={[{ id: "trend", data: points }]}
        margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
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
        axisBottom={null}
        axisLeft={null}
        enableGridX={false}
        enableGridY={false}
        enablePoints={false}
        enableArea={true}
        areaOpacity={0.1}
        colors={["#0f766e"]} // Close to primary green
        theme={{
          grid: { line: { stroke: "transparent" } },
          axis: { ticks: { line: { stroke: "transparent" } } }
        }}
        animate={true}
        isInteractive={false}
      />
    </div>
  );
}
