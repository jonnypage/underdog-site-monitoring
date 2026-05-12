import { Input } from '@/components/ui/input';

/** One row from `AdminSites.sensorCatalog` — only fields used by the site form. */
export type AdminSiteFormSensorCatalogEntry = {
  key: string;
  displayName: string;
  unit?: string | null | undefined;
  physicalMin?: number | null | undefined;
  physicalMax?: number | null | undefined;
  sortOrder?: number | null | undefined;
};

type AdminSiteFormSensorRowProps = {
  sensor: AdminSiteFormSensorCatalogEntry;
  enabled: boolean;
  thresholdMin: string;
  thresholdMax: string;
  onEnabledChange: (enabled: boolean) => void;
  onThresholdMinChange: (value: string) => void;
  onThresholdMaxChange: (value: string) => void;
};

export function AdminSiteFormSensorRow({
  sensor,
  enabled,
  thresholdMin,
  thresholdMax,
  onEnabledChange,
  onThresholdMinChange,
  onThresholdMaxChange,
}: AdminSiteFormSensorRowProps) {
  const { key, displayName, unit, physicalMin, physicalMax } = sensor;
  const rangeHint =
    physicalMin != null && physicalMax != null
      ? `Use default ${physicalMin}–${physicalMax}${unit ? ` ${unit}` : ''}`
      : 'No Use default range — set overrides if needed.';

  return (
    <li className='border-b border-border pb-4 last:border-0 last:pb-0'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            id={`sensor-${key}`}
            checked={enabled}
            onChange={() => onEnabledChange(!enabled)}
            className='mt-0.5 rounded border-border'
          />
          <label
            htmlFor={`sensor-${key}`}
            className='cursor-pointer font-medium leading-snug'
          >
            {displayName}
            <span className='font-normal text-muted-foreground'>
              {' '}
              ({unit ?? '—'})
            </span>
          </label>
        </div>
        <p className='pl-6 text-xs text-muted-foreground sm:pl-0 sm:text-right'>
          {rangeHint}
        </p>
      </div>
      <div className='mt-2 grid gap-2 pl-6 sm:grid-cols-2 sm:pl-8'>
        <div className='space-y-1'>
          <label
            className='text-xs font-medium text-muted-foreground'
            htmlFor={`thr-min-${key}`}
          >
            Site min override
          </label>
          <Input
            id={`thr-min-${key}`}
            type='text'
            inputMode='decimal'
            placeholder='Use default'
            value={thresholdMin}
            onChange={(e) => onThresholdMinChange(e.target.value)}
            className='h-8 text-sm placeholder:text-foreground/20'
          />
        </div>
        <div className='space-y-1'>
          <label
            className='text-xs font-medium text-muted-foreground'
            htmlFor={`thr-max-${key}`}
          >
            Site max override
          </label>
          <Input
            id={`thr-max-${key}`}
            type='text'
            inputMode='decimal'
            placeholder='Use default'
            value={thresholdMax}
            onChange={(e) => onThresholdMaxChange(e.target.value)}
            className='h-8 text-sm placeholder:text-foreground/20'
          />
        </div>
      </div>
    </li>
  );
}
