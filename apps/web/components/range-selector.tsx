import { Button } from "@/components/ui/button";
import { TimeRange as GqlTimeRange } from "@/lib/gql/generated/graphql";

export type TimeRange = GqlTimeRange;

const ranges: Array<{ value: TimeRange; label: string }> = [
  { value: GqlTimeRange.Last_24H, label: "Last 24h" },
  { value: GqlTimeRange.Last_7D, label: "Last 7 days" },
  { value: GqlTimeRange.Last_30D, label: "Last 30 days" }
];

export function RangeSelector({ value, onChange }: { value: TimeRange; onChange: (range: TimeRange) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ranges.map((range) => (
        <Button
          key={range.value}
          variant={range.value === value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(range.value)}
        >
          {range.label}
        </Button>
      ))}
    </div>
  );
}
