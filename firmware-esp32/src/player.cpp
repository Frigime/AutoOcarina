#include "player.h"

#include "bank.h"
#include "config.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

namespace player {
namespace {
enum class Kind : uint8_t { Play, Tap, Manual };
struct Command {
  Kind kind;
  uint8_t song;
  PadState state;
  uint16_t ms;
};

ClassicBtControllerTransport *bt = nullptr;
QueueHandle_t queue = nullptr;
volatile bool stopRequested = false;
volatile bool busy = false;
volatile int playing = -1;
volatile uint32_t elapsed = 0;
volatile uint32_t total = 0;
PadState state;

portMUX_TYPE manualMux = portMUX_INITIALIZER_UNLOCKED;
PadState manualState;
uint32_t manualSeq = 0;
int64_t manualLastUs = 0;
volatile bool manualActive = false;

uint16_t readU16(const uint8_t *p) { return static_cast<uint16_t>(p[0] | (p[1] << 8)); }

int64_t nowUs() { return esp_timer_get_time(); }

void apply(const PadState &s) {
  state = s;
  bt->setPadState(toControllerMask(s), s.lx, s.ly, s.rx, s.ry);
  bt->sendLive();
}

void holdUntil(int64_t untilUs, int64_t &lastSendUs) {
  while (!stopRequested) {
    const int64_t now = nowUs();
    if (now >= untilUs) return;
    if (now - lastSendUs >= LIVE_KEEPALIVE_MS * 1000) {
      bt->sendLive();
      lastSendUs = now;
    }
    vTaskDelay(1);
  }
}

void runSong(uint8_t index) {
  bank::Song song;
  if (!bank::getSong(index, song) || song.eventCount == 0) return;

  uint32_t sum = 0;
  for (uint32_t i = 0; i < song.eventCount; i++) sum += readU16(song.events + i * bank::EVENT_SIZE);
  total = sum;
  elapsed = 0;
  playing = index;

  const int64_t start = nowUs();
  int64_t next = start;
  int64_t lastSend = 0;
  for (uint32_t i = 0; i < song.eventCount && !stopRequested; i++) {
    const uint8_t *ev = song.events + i * bank::EVENT_SIZE;
    next += static_cast<int64_t>(readU16(ev)) * 1000;
    holdUntil(next, lastSend);
    if (stopRequested) break;
    PadState s;
    s.buttons = readU16(ev + 2);
    s.hat = ev[4] <= 8 ? ev[4] : 8;
    s.ly = ev[5];
    apply(s);
    lastSend = nowUs();
    elapsed = static_cast<uint32_t>((lastSend - start) / 1000);
  }
  playing = -1;
}

bool isNeutral(const PadState &s) {
  return s.buttons == 0 && s.hat == 8 && s.lx == 128 && s.ly == 128 && s.rx == 128 && s.ry == 128;
}

void runManual() {
  uint32_t seen = UINT32_MAX;
  int64_t lastSend = 0;
  int64_t activeUntil = nowUs() + 3000000;
  while (!stopRequested) {
    portENTER_CRITICAL(&manualMux);
    const PadState s = manualState;
    const uint32_t seq = manualSeq;
    const int64_t last = manualLastUs;
    portEXIT_CRITICAL(&manualMux);
    const int64_t now = nowUs();
    if (now - last > 1000000) break;
    if (seq != seen) {
      apply(s);
      seen = seq;
      lastSend = now;
    } else if (now - lastSend >= LIVE_KEEPALIVE_MS * 1000) {
      bt->sendLive();
      lastSend = now;
    }
    if (!isNeutral(s)) activeUntil = now + 3000000;
    if (isNeutral(s) && (now > activeUntil || uxQueueMessagesWaiting(queue) > 0)) break;
    vTaskDelay(1);
  }
}

void task(void *) {
  Command cmd;
  for (;;) {
    if (xQueueReceive(queue, &cmd, portMAX_DELAY) != pdTRUE) continue;
    stopRequested = false;
    if (!bt->beginLive()) {
      if (cmd.kind == Kind::Manual) manualActive = false;
      continue;
    }
    busy = true;
    if (cmd.kind == Kind::Play) {
      runSong(cmd.song);
    } else if (cmd.kind == Kind::Manual) {
      runManual();
      manualActive = false;
    } else {
      int64_t lastSend = 0;
      apply(cmd.state);
      lastSend = nowUs();
      holdUntil(nowUs() + static_cast<int64_t>(cmd.ms) * 1000, lastSend);
    }
    state = PadState();
    bt->endLive();
    busy = false;
  }
}
}

void begin(ClassicBtControllerTransport &transport) {
  bt = &transport;
  queue = xQueueCreate(4, sizeof(Command));
  xTaskCreatePinnedToCore(task, "ocarina_player", 4096, nullptr, 5, nullptr, 1);
}

bool play(uint8_t song) {
  if (!bt->isReady() || song >= bank::songCount()) return false;
  stop();
  Command cmd{Kind::Play, song, PadState(), 0};
  return xQueueSend(queue, &cmd, 0) == pdTRUE;
}

void tap(PadState s, uint16_t ms) {
  if (!bt->isReady()) return;
  Command cmd{Kind::Tap, 0, s, ms};
  xQueueSend(queue, &cmd, 0);
}

bool manual(PadState s) {
  if (!bt->isReady() || playing >= 0) return false;
  portENTER_CRITICAL(&manualMux);
  manualState = s;
  manualSeq++;
  manualLastUs = nowUs();
  portEXIT_CRITICAL(&manualMux);
  if (!manualActive) {
    manualActive = true;
    Command cmd{Kind::Manual, 0, PadState(), 0};
    if (xQueueSend(queue, &cmd, 0) != pdTRUE) manualActive = false;
  }
  return true;
}

bool isManual() { return manualActive; }

void stop() {
  if (busy) stopRequested = true;
  for (int i = 0; i < 300 && busy; i++) vTaskDelay(1);
}

bool isPlaying() { return playing >= 0; }
int currentSong() { return playing; }
PadState currentState() { return state; }
uint32_t elapsedMs() { return elapsed; }
uint32_t totalMs() { return total; }

uint32_t toControllerMask(const PadState &s) {
  static const ControllerButton hori[14] = {
      ControllerButton::Y,      ControllerButton::B,      ControllerButton::A,     ControllerButton::X,
      ControllerButton::L,      ControllerButton::R,      ControllerButton::ZL,    ControllerButton::ZR,
      ControllerButton::Minus,  ControllerButton::Plus,   ControllerButton::LStick, ControllerButton::RStick,
      ControllerButton::Home,   ControllerButton::Capture,
  };
  uint32_t mask = 0;
  for (int i = 0; i < 14; i++) {
    if (s.buttons & (1u << i)) mask |= controllerButtonMask(hori[i]);
  }
  if (s.hat == 7 || s.hat == 0 || s.hat == 1) mask |= controllerButtonMask(ControllerButton::DpadUp);
  if (s.hat >= 1 && s.hat <= 3) mask |= controllerButtonMask(ControllerButton::DpadRight);
  if (s.hat >= 3 && s.hat <= 5) mask |= controllerButtonMask(ControllerButton::DpadDown);
  if (s.hat >= 5 && s.hat <= 7) mask |= controllerButtonMask(ControllerButton::DpadLeft);
  return mask;
}
}
