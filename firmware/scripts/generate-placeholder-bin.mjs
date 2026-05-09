#!/usr/bin/env node
// Generate a structurally-valid PLACEHOLDER firmware image so the web installer
// can be developed and end-to-end tested without a working PlatformIO toolchain.
//
// The placeholder mimics the layout the real firmware will have:
//   * 2 KiB of leading filler so byte offsets feel binary-like in dev tools.
//   * The 2 KiB config block exactly as the real firmware emits it
//     (__UD_CFG_BEGIN__ + space-padded JSON + __UD_CFG_END__).
//   * 2 KiB of trailing filler.
//
// IMPORTANT: This is NOT a flashable firmware. Replace it with the real
// `.pio/build/wemos_d1_mini/firmware.bin` produced by `pio run -e wemos_d1_mini`
// before shipping. The file path is the same so the installer page does not
// need to change.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(
  here,
  "..",
  "..",
  "apps",
  "web",
  "public",
  "firmware",
  "wemos-d1-mini",
  "firmware.bin"
);

const BEGIN = "__UD_CFG_BEGIN__";
const END = "__UD_CFG_END__";
const CONFIG_BLOCK_SIZE = 2048;
const FILLER_SIZE = 2048;

const defaultJson =
  '{"v":1,"wifi":{"ssid":"","pass":""},' +
  '"api":{"baseUrl":"","deviceId":"","apiKey":""},' +
  '"intervalSeconds":300,"sensors":[]}';

const beginBytes = Buffer.from(BEGIN, "ascii");
const endBytes = Buffer.from(END, "ascii");
const jsonRegionSize = CONFIG_BLOCK_SIZE - beginBytes.length - endBytes.length;

const jsonRegion = Buffer.alloc(jsonRegionSize, 0x20); // spaces
jsonRegion.write(defaultJson, 0, "ascii");

const configBlock = Buffer.concat([beginBytes, jsonRegion, endBytes]);
if (configBlock.length !== CONFIG_BLOCK_SIZE) {
  throw new Error(`config block length ${configBlock.length} !== ${CONFIG_BLOCK_SIZE}`);
}

const head = Buffer.alloc(FILLER_SIZE, 0xff);
head.write("UNDERDOG-PLACEHOLDER-FW\n", 0, "ascii");
const tail = Buffer.alloc(FILLER_SIZE, 0xff);

const image = Buffer.concat([head, configBlock, tail]);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, image);
console.log(`Wrote ${image.length} bytes to ${outPath}`);
