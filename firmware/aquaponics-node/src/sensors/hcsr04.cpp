// HC-SR04 ultrasonic distance sensor used as a water-level proxy.
//
// The probe is mounted at a known height above the tank floor (`tankHeightCm`,
// supplied via the config blob's `cal.intercept` field) so we can convert a
// distance reading into a fill percentage. If the calibration is missing we
// simply emit the raw distance in centimetres and let the dashboard plot it.

#include "ud_config.h"
#include "ud_sensors.h"

namespace ud {

namespace {

constexpr int kDefaultTrigPin = 14;  // D5
constexpr int kDefaultEchoPin = 12;  // D6
constexpr unsigned long kPulseTimeoutUs = 30000UL;  // ~5m max distance.

int gTrigPin = kDefaultTrigPin;
int gEchoPin = kDefaultEchoPin;
float gTankHeightCm = 0.0f;  // 0 disables percentage conversion.

void setup(const SensorConfig& cfg) {
    int32_t trig = findPin(cfg, "trig");
    int32_t echo = findPin(cfg, "echo");
    gTrigPin = (trig >= 0) ? static_cast<int>(trig) : kDefaultTrigPin;
    gEchoPin = (echo >= 0) ? static_cast<int>(echo) : kDefaultEchoPin;
    gTankHeightCm = cfg.hasIntercept ? cfg.intercept : 0.0f;
    pinMode(gTrigPin, OUTPUT);
    pinMode(gEchoPin, INPUT);
    digitalWrite(gTrigPin, LOW);
    Serial.print(F("[hcsr04] trig GPIO"));
    Serial.print(gTrigPin);
    Serial.print(F(" echo GPIO"));
    Serial.println(gEchoPin);
}

SensorReading read(const SensorConfig& /*cfg*/) {
    SensorReading r{false, 0.0f};

    digitalWrite(gTrigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(gTrigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(gTrigPin, LOW);

    unsigned long durationUs = pulseIn(gEchoPin, HIGH, kPulseTimeoutUs);
    if (durationUs == 0) {
        Serial.println(F("[hcsr04] echo timeout"));
        return r;
    }

    // Speed of sound at ~20C is 343 m/s -> 0.0343 cm/us; round-trip / 2.
    float distanceCm = (static_cast<float>(durationUs) * 0.0343f) / 2.0f;
    if (distanceCm < 2.0f || distanceCm > 400.0f) {
        Serial.print(F("[hcsr04] out of probe range: "));
        Serial.println(distanceCm);
        return r;
    }

    if (gTankHeightCm > 0.0f) {
        float waterColumnCm = gTankHeightCm - distanceCm;
        if (waterColumnCm < 0.0f) waterColumnCm = 0.0f;
        float pct = (waterColumnCm / gTankHeightCm) * 100.0f;
        if (pct > 100.0f) pct = 100.0f;
        r.value = pct;
    } else {
        r.value = distanceCm;
    }
    r.ok = true;
    return r;
}

}  // namespace

const SensorDriver kDriverHcsr04 = {"hcsr04", &setup, &read};

}  // namespace ud
