// Analog dissolved-oxygen probe driver.
//
// Most hobby DO probes (e.g. DFRobot SEN0237) output a low-voltage signal that
// is converted to mg/L via a calibration constant supplied by the user. The
// installer page captures the calibration as `cal.slope` (mV per mg/L) and
// `cal.intercept` (mg/L offset) so a tech can recalibrate without reflashing.

#include "ud_config.h"
#include "ud_sensors.h"

namespace ud {

namespace {

constexpr int kDefaultAdcPin = A0;
constexpr float kDefaultSlope = 0.0327f;     // mg/L per mV (rough default).
constexpr float kDefaultIntercept = 0.0f;
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
    Serial.print(F("[analog_do] adc pin "));
    Serial.println(gPin);
}

SensorReading read(const SensorConfig& /*cfg*/) {
    long sum = 0;
    for (int i = 0; i < kSamples; ++i) {
        sum += analogRead(gPin);
        delay(2);
    }
    float counts = static_cast<float>(sum) / static_cast<float>(kSamples);
    float mv = counts * static_cast<float>(UD_ANALOG_REF_MV) / static_cast<float>(UD_ANALOG_RESOLUTION - 1);
    float mgL = gSlope * mv + gIntercept;
    SensorReading r{true, mgL};
    if (mgL < 0.0f || mgL > 25.0f) {
        Serial.print(F("[analog_do] out of physical range: "));
        Serial.println(mgL);
        r.ok = false;
    }
    return r;
}

}  // namespace

const SensorDriver kDriverAnalogDo = {"analog_do", &setup, &read};

}  // namespace ud
