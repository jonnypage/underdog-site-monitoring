import { z } from "zod";

export const ingestPayloadSchema = z.object({
  deviceId: z.string().min(1),
  timestamp: z.string().datetime(),
  readings: z
    .record(z.string(), z.number().finite())
    .refine((readings) => Object.keys(readings).length > 0, {
      message: "At least one reading is required"
    })
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
