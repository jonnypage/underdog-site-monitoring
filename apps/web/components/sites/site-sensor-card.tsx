import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SensorSparkline } from "@/components/charts/sensor-sparkline";
import { SensorIcon } from "@/components/sensor-icon";
import type { SiteSensorReporting } from "@/lib/gql/generated/graphql";

type SiteSensorCardProps = {
  siteId: string;
  sensor: Pick<SiteSensorReporting, 'key' | 'displayName' | 'unit' | 'currentValue' | 'physicalMin' | 'physicalMax' | 'rangeMin' | 'rangeMax' | 'icon'>;
  chartData: { x: string | Date; y: number }[];
};

export function SiteSensorCard({ siteId, sensor, chartData }: SiteSensorCardProps) {
  return (
    <Link href={`/sites/${siteId}/sensors/${sensor.key}`} className="block group">
      <Card className="transition-all hover:border-primary/50 hover:shadow-md cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
                <SensorIcon name={sensor.icon} className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-sm leading-tight group-hover:text-primary transition-colors">
                  {sensor.displayName}
                </CardTitle>
                <p className="text-[10px] font-medium text-muted-foreground uppercase">{sensor.unit}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold leading-none">
                {sensor.currentValue != null ? Number(sensor.currentValue).toFixed(2) : "-"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <SensorSparkline 
            data={chartData} 
            min={sensor.physicalMin ?? undefined}
            max={sensor.physicalMax ?? undefined}
          />
          {sensor.rangeMin != null && sensor.rangeMax != null ? (
            <p className="mt-2 text-[10px] text-muted-foreground italic">
              Sensor range: {sensor.rangeMin}–{sensor.rangeMax} {sensor.unit}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
