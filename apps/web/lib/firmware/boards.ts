/**
 * Hardware-board metadata used by the device install wizard.
 *
 * The firmware speaks GPIO numbers; the UI shows the silkscreened "D" labels
 * so a tech wiring up a Wemos D1 Mini does not have to look up which D-label
 * corresponds to GPIO4. Each driver also declares the list of pin slots it
 * needs (e.g. ds18b20 -> "data", hcsr04 -> "trig"+"echo") so the wizard can
 * render the right number of pin pickers when the user picks a driver.
 */

export type ChipFamily =
  | "ESP8266"
  | "ESP32"
  | "ESP32-S2"
  | "ESP32-S3"
  | "ESP32-C3";

export interface PinChoice {
  /** GPIO number written into the firmware config. */
  gpio: number;
  /** Friendly silkscreen label shown to the user (e.g. "D2"). */
  label: string;
  /** Marks a pin that can be used for analog reads (driver = analog_*). */
  analog?: boolean;
  /** Hint text to disambiguate boot-strap or quirky pins. */
  note?: string;
}

export interface DriverDefinition {
  /** Driver key the firmware expects (must match a SensorDriver in firmware/). */
  key: string;
  /** Human-readable label for the pin picker. */
  displayName: string;
  /**
   * Pin slots required by the driver, keyed by the same name the firmware
   * uses in `pins` (config_load.cpp / driver setup()).
   */
  pinSlots: { name: string; label: string; analog?: boolean }[];
  /**
   * Default pin GPIO numbers for each named slot on a fresh install. These
   * match the firmware driver's hardcoded fallbacks.
   */
  defaults: Record<string, number>;
  /**
   * Optional calibration fields exposed in the wizard for this driver.
   * `slope`/`intercept` map directly to the firmware `cal` object.
   */
  cal?: {
    slope?: { label: string; defaultValue: number };
    intercept?: { label: string; defaultValue: number };
  };
}

export interface BoardDefinition {
  /** Stable id used in DB (`devices.board`) and URL slugs. */
  id: string;
  /** Slug used for the public firmware folder, e.g. "wemos-d1-mini". */
  slug: string;
  /** Display name shown on the wizard. */
  displayName: string;
  /** ESP chip family for the esp-web-tools manifest. */
  chipFamily: ChipFamily;
  /** Flash offset for the merged firmware image. */
  flashOffset: number;
  /** Path under apps/web/public/firmware that the installer fetches. */
  firmwarePath: string;
  /** All GPIO pins the user is allowed to map sensors onto. */
  pins: PinChoice[];
  /** Drivers this board supports. */
  drivers: DriverDefinition[];
  /** Optional warning shown if the user picks the board (e.g. analog conflicts). */
  notes?: string[];
  /** Disable the board in the picker (useful for "coming soon" entries). */
  comingSoon?: boolean;
}

/**
 * Wemos D1 Mini (ESP8266). The board only has one analog pin (A0); the
 * wizard surfaces a warning if multiple analog drivers are mapped to it.
 *
 * Pin labels match the silkscreen, GPIO numbers match the ESP8266 datasheet.
 * Pins like D3/D4/D8 are bootstrap pins; we expose them but tag them with
 * notes so a tech can avoid them when they have a choice.
 */
export const WEMOS_D1_MINI: BoardDefinition = {
  id: "wemos_d1_mini",
  slug: "wemos-d1-mini",
  displayName: "Wemos D1 Mini (ESP8266)",
  chipFamily: "ESP8266",
  flashOffset: 0,
  firmwarePath: "/firmware/wemos-d1-mini/firmware.bin",
  pins: [
    { gpio: 16, label: "D0", note: "no interrupts; cannot use PWM/I2C; HIGH at boot" },
    { gpio: 5, label: "D1" },
    { gpio: 4, label: "D2" },
    { gpio: 0, label: "D3", note: "boot-strap; must be HIGH at boot" },
    { gpio: 2, label: "D4", note: "boot-strap + onboard LED" },
    { gpio: 14, label: "D5" },
    { gpio: 12, label: "D6" },
    { gpio: 13, label: "D7" },
    { gpio: 15, label: "D8", note: "boot-strap; must be LOW at boot" },
    { gpio: 17, label: "A0", analog: true, note: "0\u20133.3V; only ADC pin" }
  ],
  drivers: [
    {
      key: "ds18b20",
      displayName: "DS18B20 temperature (OneWire)",
      pinSlots: [{ name: "data", label: "Data" }],
      defaults: { data: 4 }
    },
    {
      key: "analog_ph",
      displayName: "Analog pH probe",
      pinSlots: [{ name: "adc", label: "ADC", analog: true }],
      defaults: { adc: 17 },
      cal: {
        slope: { label: "Slope (pH per V)", defaultValue: -5.7 },
        intercept: { label: "Intercept (pH)", defaultValue: 21.3 }
      }
    },
    {
      key: "hcsr04",
      displayName: "HC-SR04 ultrasonic (water level)",
      pinSlots: [
        { name: "trig", label: "Trigger" },
        { name: "echo", label: "Echo" }
      ],
      defaults: { trig: 14, echo: 12 },
      cal: {
        intercept: { label: "Tank height (cm) for % conversion", defaultValue: 0 }
      }
    },
    {
      key: "analog_do",
      displayName: "Analog dissolved oxygen",
      pinSlots: [{ name: "adc", label: "ADC", analog: true }],
      defaults: { adc: 17 },
      cal: {
        slope: { label: "Slope (mg/L per mV)", defaultValue: 0.0327 },
        intercept: { label: "Intercept (mg/L)", defaultValue: 0 }
      }
    }
  ],
  notes: [
    "The Wemos D1 Mini has only one analog pin (A0). If you wire both pH and dissolved oxygen, you will need an external multiplexer or two devices."
  ]
};

export const ESP32_CYD_PLACEHOLDER: BoardDefinition = {
  id: "esp32_cyd",
  slug: "esp32-cyd",
  displayName: "ESP32 CYD (Cheap Yellow Display) \u2014 coming soon",
  chipFamily: "ESP32",
  flashOffset: 0x1000,
  firmwarePath: "/firmware/esp32-cyd/firmware.bin",
  pins: [],
  drivers: [],
  comingSoon: true
};

export const BOARDS: BoardDefinition[] = [WEMOS_D1_MINI, ESP32_CYD_PLACEHOLDER];

/** Suggest a default driver key for a sensor catalog entry, based on its key. */
export function defaultDriverForSensor(catalogKey: string): string | null {
  switch (catalogKey) {
    case "temperature":
      return "ds18b20";
    case "ph":
      return "analog_ph";
    case "waterLevel":
      return "hcsr04";
    case "dissolvedOxygen":
      return "analog_do";
    default:
      return null;
  }
}
