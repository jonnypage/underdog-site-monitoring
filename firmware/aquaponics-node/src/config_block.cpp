// The config block is a fixed-size byte region that ships inside the firmware
// image. The web installer locates the magic markers below in the .bin file
// and overwrites the bytes in between with a JSON document. The default
// payload is a minimal placeholder so the firmware boots into a clearly
// "unconfigured" state if the installer step is skipped.

#include <Arduino.h>
#include "ud_config.h"

namespace ud {

namespace {

// Default payload: the markers, followed by an "empty" JSON document with the
// expected v=1 shape, padded with spaces so the whole array reaches
// kConfigBlockSize bytes. The installer overwrites the JSON region (and only
// the JSON region) before flashing.
//
// Keep these literals separate so the markers are easy to find by byte search
// in the compiled .bin without colliding with any source-code mention.
constexpr const char kCfgBegin[] = "__UD_CFG_BEGIN__";
constexpr const char kCfgEnd[] = "__UD_CFG_END__";

// Default JSON document baked into the firmware before installer customization.
// Kept short and intentionally invalid (no Wi-Fi, no API key) so a
// freshly-compiled binary that is flashed without the installer fails fast.
constexpr const char kDefaultJson[] =
    "{\"v\":1,\"wifi\":{\"ssid\":\"\",\"pass\":\"\"},"
    "\"api\":{\"baseUrl\":\"\",\"deviceId\":\"\",\"apiKey\":\"\"},"
    "\"intervalSeconds\":300,\"sensors\":[]}";

// Build the embedded array via a constexpr-style helper at link time. We use
// C-style aggregate initialization with the marker pair plus a generous tail
// of spaces; the union forces the whole region to occupy kConfigBlockSize
// bytes regardless of the literal length.
struct ConfigBlock {
    char begin[sizeof(kCfgBegin) - 1];
    char json[kConfigBlockSize - (sizeof(kCfgBegin) - 1) - (sizeof(kCfgEnd) - 1)];
    char end[sizeof(kCfgEnd) - 1];
};
static_assert(sizeof(ConfigBlock) == kConfigBlockSize,
              "Config block layout must total kConfigBlockSize bytes");

constexpr ConfigBlock makeDefaultBlock() {
    ConfigBlock b{};
    for (size_t i = 0; i < sizeof(b.begin); ++i) b.begin[i] = kCfgBegin[i];
    for (size_t i = 0; i < sizeof(b.end); ++i) b.end[i] = kCfgEnd[i];
    for (size_t i = 0; i < sizeof(b.json); ++i) b.json[i] = ' ';
    for (size_t i = 0; i < sizeof(kDefaultJson) - 1 && i < sizeof(b.json); ++i) {
        b.json[i] = kDefaultJson[i];
    }
    return b;
}

}  // namespace

// `used` keeps the linker from stripping it, `aligned(4)` keeps flash reads
// happy on the ESP8266. The struct is intentionally non-const at the language
// level so the compiler does not constant-fold its bytes; on flash it lives in
// the .text/.rodata area read by readFlashByte().
__attribute__((used, aligned(4)))
const ConfigBlock kEmbeddedConfig = makeDefaultBlock();

const char* embeddedConfigJson() {
    return kEmbeddedConfig.json;
}

size_t embeddedConfigJsonCapacity() {
    return sizeof(kEmbeddedConfig.json);
}

}  // namespace ud
