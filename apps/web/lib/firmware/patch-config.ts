/**
 * In-browser firmware patching utilities for the ESP web installer.
 *
 * The firmware (see firmware/aquaponics-node/src/config_block.cpp) reserves a
 * 2 KiB region inside its compiled .bin between the markers
 * `__UD_CFG_BEGIN__` and `__UD_CFG_END__`. The web installer:
 *
 *   1. Fetches the .bin as an ArrayBuffer.
 *   2. Calls `patchFirmwareBinary()` to splice a JSON document into that
 *      region (padded with spaces so the file size never changes).
 *   3. Calls `buildEspWebToolsManifest()` to wrap the patched bytes in a Blob
 *      URL plus a manifest Blob URL that <esp-web-install-button> understands.
 *
 * The helpers are pure and have no DOM dependencies so they can be unit
 * tested in Node (Buffer is interchangeable with Uint8Array for byte ops).
 */

export interface BuildConfigInput {
  wifi: { ssid: string; pass: string };
  api: { baseUrl: string; deviceId: string; apiKey: string };
  intervalSeconds: number;
  sensors: ConfiguredSensor[];
}

export interface ConfiguredSensor {
  /** Catalog key (e.g. "temperature"). */
  key: string;
  /** Driver name registered in firmware (e.g. "ds18b20"). */
  driver: string;
  /** GPIO pins keyed by driver-defined names (e.g. { data: 4 }). */
  pins: Record<string, number>;
  /** Optional calibration values consumed by analog drivers and hcsr04. */
  cal?: { slope?: number; intercept?: number };
}

export const CONFIG_BEGIN_MARKER = "__UD_CFG_BEGIN__";
export const CONFIG_END_MARKER = "__UD_CFG_END__";
export const CONFIG_BLOCK_SIZE = 2048;

const TEXT_ENCODER =
  typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

function encodeUtf8(value: string): Uint8Array {
  if (TEXT_ENCODER) return TEXT_ENCODER.encode(value);
  // Node fallback for unit tests.
  return new Uint8Array(Buffer.from(value, "utf8"));
}

/**
 * Build the JSON document the firmware will read from its embedded config
 * block. Validation is light because the form layer has already enforced the
 * shape; we only normalize numbers.
 */
export function buildConfigJson(input: BuildConfigInput): string {
  const sensors = input.sensors.map((s) => {
    const out: Record<string, unknown> = {
      key: s.key,
      driver: s.driver,
      pins: s.pins
    };
    if (s.cal && (s.cal.slope !== undefined || s.cal.intercept !== undefined)) {
      out.cal = {};
      if (s.cal.slope !== undefined) (out.cal as Record<string, number>).slope = s.cal.slope;
      if (s.cal.intercept !== undefined) (out.cal as Record<string, number>).intercept = s.cal.intercept;
    }
    return out;
  });

  const doc = {
    v: 1,
    wifi: { ssid: input.wifi.ssid, pass: input.wifi.pass },
    api: {
      baseUrl: input.api.baseUrl.replace(/\/$/, ""),
      deviceId: input.api.deviceId,
      apiKey: input.api.apiKey
    },
    intervalSeconds: Math.max(5, Math.trunc(input.intervalSeconds || 300)),
    sensors
  };

  return JSON.stringify(doc);
}

/**
 * Find the marker pair in the binary and overwrite the JSON region with the
 * provided document, padding with spaces. Returns a NEW Uint8Array; the input
 * is not mutated.
 */
export function patchFirmwareBinary(
  bin: Uint8Array,
  configJson: string
): Uint8Array {
  const beginBytes = encodeUtf8(CONFIG_BEGIN_MARKER);
  const endBytes = encodeUtf8(CONFIG_END_MARKER);

  const beginIdx = indexOfBytes(bin, beginBytes);
  if (beginIdx < 0) {
    throw new Error(
      `Firmware binary missing marker ${CONFIG_BEGIN_MARKER}. Was the firmware built from firmware/aquaponics-node?`
    );
  }
  const endIdx = indexOfBytes(bin, endBytes, beginIdx + beginBytes.length);
  if (endIdx < 0) {
    throw new Error(`Firmware binary missing marker ${CONFIG_END_MARKER}`);
  }

  const blockStart = beginIdx;
  const blockEnd = endIdx + endBytes.length;
  if (blockEnd - blockStart !== CONFIG_BLOCK_SIZE) {
    throw new Error(
      `Unexpected config block size ${blockEnd - blockStart} (expected ${CONFIG_BLOCK_SIZE}). Firmware build is out of sync with patch-config.ts.`
    );
  }

  const jsonStart = blockStart + beginBytes.length;
  const jsonEnd = endIdx;
  const jsonCapacity = jsonEnd - jsonStart;
  const jsonBytes = encodeUtf8(configJson);
  if (jsonBytes.length > jsonCapacity) {
    throw new Error(
      `Config JSON is ${jsonBytes.length} bytes, but the firmware reserves only ${jsonCapacity}. Reduce the number of sensors or shorten Wi-Fi/credentials.`
    );
  }

  const out = new Uint8Array(bin.length);
  out.set(bin);
  // Pad the entire JSON region with spaces (0x20) before writing so any
  // leftover bytes from the previous payload do not become trailing JSON.
  out.fill(0x20, jsonStart, jsonEnd);
  out.set(jsonBytes, jsonStart);
  return out;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, fromIndex = 0): number {
  if (needle.length === 0) return fromIndex;
  outer: for (let i = fromIndex; i <= haystack.length - needle.length; ++i) {
    for (let j = 0; j < needle.length; ++j) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export interface EspWebToolsManifestResult {
  /** URL to pass to <esp-web-install-button>'s `manifest` attribute. */
  manifestUrl: string;
  /** Call when the install completes (success or cancel) to free Blob URLs. */
  revoke: () => void;
}

export interface BuildManifestInput {
  patched: Uint8Array;
  /**
   * Manifest fields. `chipFamily` is the ESP chip family string from
   * https://esphome.github.io/esp-web-tools/#creating-your-manifest.
   * Wemos D1 Mini -> "ESP8266". CYD ESP32-S3 -> "ESP32-S3", etc.
   */
  chipFamily: "ESP8266" | "ESP32" | "ESP32-S2" | "ESP32-S3" | "ESP32-C3";
  name: string;
  version: string;
  /** Flash offset for the merged binary; ESP8266 uses 0, ESP32 typically 0x1000. */
  offset?: number;
}

/**
 * Wrap the patched .bin in a Blob URL and emit a JSON manifest URL pointing
 * at it. Both URLs MUST be revoked after the install dialog closes (call the
 * returned `revoke` from the dialog's `state-changed` handler).
 */
export function buildEspWebToolsManifest(
  input: BuildManifestInput
): EspWebToolsManifestResult {
  const binBlob = new Blob([input.patched], { type: "application/octet-stream" });
  const binUrl = URL.createObjectURL(binBlob);

  const manifest = {
    name: input.name,
    version: input.version,
    new_install_prompt_erase: false,
    builds: [
      {
        chipFamily: input.chipFamily,
        parts: [{ path: binUrl, offset: input.offset ?? 0 }]
      }
    ]
  };

  const manifestBlob = new Blob([JSON.stringify(manifest)], {
    type: "application/json"
  });
  const manifestUrl = URL.createObjectURL(manifestBlob);

  return {
    manifestUrl,
    revoke: () => {
      URL.revokeObjectURL(manifestUrl);
      URL.revokeObjectURL(binUrl);
    }
  };
}
