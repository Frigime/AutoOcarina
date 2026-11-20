#pragma once

#include <cstdint>

#include "classic_bt_controller_transport.h"

namespace player {
struct PadState {
  uint16_t buttons = 0;
  uint8_t hat = 8;
  uint8_t ly = 128;
  uint8_t lx = 128;
  uint8_t rx = 128;
  uint8_t ry = 128;
};

void begin(ClassicBtControllerTransport &transport);

bool play(uint8_t song);
void tap(PadState state, uint16_t ms);
bool manual(PadState state);
bool isManual();
void stop();

bool isPlaying();
int currentSong();
PadState currentState();
uint32_t elapsedMs();
uint32_t totalMs();

uint32_t toControllerMask(const PadState &s);
}
