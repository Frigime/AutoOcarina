# Building

## Web page

Node 20 or newer.

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # writes app/
```

`app/` is committed so the project works straight from the ZIP download.

## RP2040 / RP2350 firmware

Needs, in the same folders as the *Raspberry Pi Pico* VS Code extension:

- Pico SDK 2.2.0 in `~/.pico-sdk/sdk/2.2.0`, with the `lib/cyw43-driver` submodule for Pico W boards
- Arm GNU Toolchain in `~/.pico-sdk/toolchain/14_2_Rel1`
- `picotool` 2.1.1 in `~/.pico-sdk/picotool/2.1.1` and `pioasm` 2.2.0 in `~/.pico-sdk/tools/2.2.0`
  (prebuilt in [pico-sdk-tools](https://github.com/raspberrypi/pico-sdk-tools/releases))
- `cmake` and `ninja` (`pip install cmake ninja`)

```bash
bash firmware/build.sh          # every board, into web/public/firmware/autoocarina_<board>.uf2
bash firmware/build.sh pico2    # one board
```

Boards are listed at the top of `firmware/build.sh`. Another board from the Pico SDK can be added there.

## ESP32 firmware

Uses [PlatformIO](https://platformio.org/) (`pip install platformio`). On Windows, run it from PowerShell.

```bash
cd firmware-esp32
pio run -e switch2 -t upload    # "switch1" for a Switch 1
```

To rebuild the single image `web/public/firmware/autoocarina_esp32.bin`, merge `bootloader.bin` (0x1000),
`partitions.bin` (0x8000) and `firmware.bin` (0x10000) from `.pio/build/switch2/` with `esptool merge-bin`.

## Layout

```
app/             built web page and firmwares
web/             web page sources (Vite + TypeScript)
firmware/        RP2040 / RP2350 firmware (Pico SDK + TinyUSB)
firmware-esp32/  ESP32 firmware (PlatformIO, Arduino + ESP-IDF), GPL-3.0
launcher/        local web servers used by the start scripts
docs/            song format and board protocols
```
