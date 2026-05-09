#pragma once

#include <stdint.h>
#include "ud_config.h"

namespace ud {

struct ReadingSample {
    const char* key;
    float value;
};

/**
 * Build a JSON ingest payload (matches docs/esp-device-ingest.md §3) and POST
 * it to `${cfg.apiBaseUrl}/ingest` with `x-api-key`. Returns the HTTP status
 * code, or 0 on transport failure.
 */
int postReadings(const RuntimeConfig& cfg,
                 const char* timestampIso,
                 const ReadingSample* samples,
                 size_t sampleCount);

}  // namespace ud
