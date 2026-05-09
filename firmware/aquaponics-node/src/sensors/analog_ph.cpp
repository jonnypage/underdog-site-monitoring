// Analog pH probe driver.
//
// The Wemos D1 Mini exposes a single analog pin (A0) wired to the ESP8266 ADC
// through a divider (board reads 0..3.3V across 0..1023). A typical hobby pH
// probe board outputs a 0..3V signal with linear cal: ph = slope * V + intercept.
// Both coefficients ship in the config blob's `cal` object so a tech can
// recalibrate without reflashing (the installer page exposes them as fields
// when the analog_ph driver is selected).

#include "ud_config.h"
#include "ud_sensors.h"

namespace ud {

namespace {

constexpr int kDefaultAdcPin = A0;
constexpr float kDefaultSlope = -5.7f;       // V to pH slope
constexpr float kDefaultIntercept = 21.34f;  // pH offset
constexpr int kSamples = 16;

int gPin = kDefaultAdcPin;
float gSlope = kDefaultSlope;
float gIntercept = kDefaultIntercept;

void setup(const SensorConfig& cfg) {
    int32_t pin = findPin(cfg, "adc");
    gPin = (pin >= 0) ? static_cast<int>(pin) : kDefaultAdcPin;
    gSlope = cfg.hasSlope ? cfg.slope : kDefaultSlope;
    gIntercept = cfg.hasIntercept ? cfg.intercept : kDefaultIntercept;
    pinMode(gPin, INPUT);
    Serial.print(F("[analog_ph] adc pin "));
    Serial.println(gPin);
}

SensorReading read(const SensorConfig& /*cfg*/) {
    long sum = 0;
    for (int i = 0; i < kSamples; ++i) {
        sum += analogRead(gPin);
        delay(2);
    }
    float counts = static_cast<float>(sum) / static_cast<float>(kSamples);
    float volts = counts * (UD_ANALOG_REF_MV / 1000.0f) / static_cast<float>(UD_ANALOG_RESOLUTION - 1);
    float ph = gSlope * volts + gIntercept;
    SensorReading r{true, ph};
    if (ph < 0.0f || ph > 14.0f) {
        Serial.print(F("[analog_ph] out of physical range: "));
        Serial.println(ph);
        r.ok = false;
    }
    return r;
}

}  // namespace

const SensorDriver kDriverAnalogPh = {"analog_ph", &setup, &read};

}  // namespace ud
