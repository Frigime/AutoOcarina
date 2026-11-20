#include <Arduino.h>
#include <Preferences.h>
#include <U8g2lib.h>
#include <Wire.h>

#include "bank.h"
#include "classic_bt_controller_transport.h"
#include "config.h"
#include "mbedtls/base64.h"
#include "player.h"

namespace {
ClassicBtControllerTransport bt;
U8G2 *display = nullptr;
uint8_t selected = 0;
uint32_t pairPressUntil = 0;
uint32_t readySince = 0;

enum Text : uint8_t {
  T_WAIT1, T_WAIT2, T_CONNECTING, T_WAIT3, T_NO_SONG1, T_NO_SONG2, T_BOOT_SHORT, T_BOOT_LONG, T_DPAD, T_PAD,
  T_PAIRING, T_COUNT
};
const char *const TEXT_FR[T_COUNT] = {
    "Switch : Manettes >", "Changer prise/ordre", "Connexion...", "puis attends ici", "Aucun morceau :",
    "envoie-en depuis le site", "BOOT court : suivant", "BOOT long  : jouer", "croix", "Manette du site",
    "Appairage + L+R...",
};
const char *const TEXT_EN[T_COUNT] = {
    "Switch: Controllers >", "Change Grip/Order", "Connecting...", "then wait here", "No songs yet:",
    "send some from the site", "BOOT short: next", "BOOT long : play", "dpad", "Site controller",
    "Pairing + L+R...",
};
Preferences prefs;
bool english = false;

const char *tr(Text t) { return (english ? TEXT_EN : TEXT_FR)[t]; }

int btState() {
  if (bt.isReady()) return 3;
  if (bt.isConnected()) return 2;
  if (bt.isDiscoverable()) return 1;
  return 0;
}

String statusLine() {
  return "ST bt=" + String(btState()) + " play=" + String(player::currentSong()) +
         " sel=" + String(selected) + " songs=" + String(bank::songCount());
}

void reportStatusIfChanged() {
  static String last;
  const String now = statusLine();
  if (now != last) {
    Serial.println(now);
    last = now;
  }
}

void beginDisplay() {
  struct Pins { int sda, scl, reset; };
  const Pins candidates[] = {{21, 22, -1}, {4, 15, 16}, {5, 4, -1}, {14, 12, -1}, {22, 21, -1}, {13, 14, -1}};
  for (const Pins &p : candidates) {
    if (p.reset >= 0) {
      pinMode(p.reset, OUTPUT);
      digitalWrite(p.reset, LOW);
      delay(20);
      digitalWrite(p.reset, HIGH);
      delay(20);
    }
    Wire.begin(p.sda, p.scl);
    for (uint8_t address : {0x3C, 0x3D}) {
      Wire.beginTransmission(address);
      if (Wire.endTransmission() == 0) {
        Wire.end();
        display = new U8G2_SSD1306_128X64_NONAME_F_HW_I2C(
            U8G2_R0, p.reset >= 0 ? p.reset : U8X8_PIN_NONE, p.scl, p.sda);
        display->setI2CAddress(address * 2);
        display->begin();
        display->enableUTF8Print();
        Serial.printf("INFO display sda=%d scl=%d addr=0x%02X\n", p.sda, p.scl, address);
        return;
      }
    }
    Wire.end();
  }
  Serial.println("INFO display none");
}

String noteLabel(const player::PadState &s) {
  static const char *names[] = {"Y", "B", "A", "X", "L", "R", "ZL", "ZR", "-", "+", "L3", "R3", "H", "C"};
  String label;
  for (int i = 0; i < 14; i++) {
    if (s.buttons & (1u << i)) label += names[i];
  }
  if (s.hat == 0) label += String(" +") + tr(T_DPAD);
  if (s.hat == 4) label += String(" -") + tr(T_DPAD);
  if (s.hat == 6) label += String(" <") + tr(T_DPAD);
  if (s.ly < 64) label += " +stick";
  if (s.ly > 192) label += " -stick";
  if (s.lx < 64 || s.lx > 192) label += s.lx < 64 ? " <stick" : " >stick";
  if (s.rx != 128 || s.ry != 128) label += " R";
  return label;
}

void drawDisplay() {
  if (display == nullptr) return;
  static uint32_t lastDraw = 0;
  if (millis() - lastDraw < 60) return;
  lastDraw = millis();

  display->clearBuffer();
  display->setFont(u8g2_font_6x12_tf);
  display->setCursor(0, 10);
  display->print("AutoOcarina");
  const char *bts[] = {"...", "BT ?", "BT ~", "BT ok"};
  display->setCursor(128 - display->getUTF8Width(bts[btState()]), 10);
  display->print(bts[btState()]);
  display->drawHLine(0, 13, 128);

  const uint8_t count = bank::songCount();
  if (btState() < 3) {
    display->setCursor(0, 28);
    display->print(tr(T_WAIT1));
    display->setCursor(0, 40);
    display->print(tr(T_WAIT2));
    display->setCursor(0, 52);
    display->print(pairPressUntil ? tr(T_PAIRING) : btState() == 2 ? tr(T_CONNECTING) : tr(T_WAIT3));
  } else if (player::isManual()) {
    display->setCursor(0, 28);
    display->print(tr(T_PAD));
    display->setFont(u8g2_font_10x20_tf);
    display->setCursor(0, 52);
    display->print(noteLabel(player::currentState()));
  } else if (count == 0) {
    display->setCursor(0, 32);
    display->print(tr(T_NO_SONG1));
    display->setCursor(0, 44);
    display->print(tr(T_NO_SONG2));
  } else {
    bank::Song song;
    const int playing = player::currentSong();
    const uint8_t index = playing >= 0 ? playing : selected;
    if (bank::getSong(index, song)) {
      char name[bank::NAME_SIZE + 1] = {};
      memcpy(name, song.name, bank::NAME_SIZE);
      display->setCursor(0, 26);
      display->printf("%u/%u %s", index + 1, count, name);
    }
    if (playing >= 0) {
      display->setFont(u8g2_font_10x20_tf);
      display->setCursor(0, 48);
      display->print(noteLabel(player::currentState()));
      const uint32_t total = player::totalMs();
      const uint32_t done = player::elapsedMs();
      display->drawFrame(0, 56, 128, 6);
      if (total > 0) display->drawBox(0, 56, static_cast<int>(128ull * done / total), 6);
    } else {
      display->setCursor(0, 46);
      display->print(tr(T_BOOT_SHORT));
      display->setCursor(0, 58);
      display->print(tr(T_BOOT_LONG));
    }
  }
  display->sendBuffer();
}

enum class Press { None, Short, Long, Double };

Press readButton() {
  static bool stable = false, previous = false, longFired = false, clickPending = false;
  static uint32_t nextPoll = 0, downSince = 0, lastRelease = 0;
  const uint32_t now = millis();
  if (now < nextPoll) return Press::None;
  nextPoll = now + 10;

  const bool raw = digitalRead(BUTTON_PIN) == LOW;
  const bool changed = raw == previous && raw != stable;
  previous = raw;
  if (changed) {
    stable = raw;
    if (stable) {
      downSince = now;
      longFired = false;
    } else if (!longFired) {
      if (clickPending && now - lastRelease < 350) {
        clickPending = false;
        return Press::Double;
      }
      clickPending = true;
      lastRelease = now;
    }
  }
  if (stable && !longFired && now - downSince >= 700) {
    longFired = true;
    clickPending = false;
    return Press::Long;
  }
  if (clickPending && !stable && now - lastRelease >= 350) {
    clickPending = false;
    return Press::Short;
  }
  return Press::None;
}

void handleButton() {
  switch (readButton()) {
    case Press::Short:
      if (player::isPlaying()) player::stop();
      else if (bank::songCount()) selected = (selected + 1) % bank::songCount();
      break;
    case Press::Long:
      if (player::isPlaying()) player::stop();
      else player::play(selected);
      break;
    case Press::Double: {
      player::PadState lr;
      lr.buttons = (1u << 4) | (1u << 5);
      player::tap(lr, 300);
      break;
    }
    case Press::None:
      break;
  }
}

String nextToken(String &rest) {
  rest.trim();
  const int space = rest.indexOf(' ');
  String token = space < 0 ? rest : rest.substring(0, space);
  rest = space < 0 ? "" : rest.substring(space + 1);
  return token;
}

void handleCommand(String line) {
  String rest = line;
  const String cmd = nextToken(rest);

  if (cmd == "HELLO") {
    Serial.println("OK autoocarina-esp32 2");
  } else if (cmd == "STATUS") {
    Serial.println(statusLine());
    Serial.println("OK");
  } else if (cmd == "BEGIN") {
    player::stop();
    Serial.println(bank::beginWrite(nextToken(rest).toInt()) ? "OK" : "ERR taille");
  } else if (cmd == "DATA") {
    const uint32_t offset = nextToken(rest).toInt();
    const String b64 = nextToken(rest);
    uint8_t buffer[768];
    size_t len = 0;
    const int err = mbedtls_base64_decode(buffer, sizeof(buffer), &len,
                                          reinterpret_cast<const unsigned char *>(b64.c_str()), b64.length());
    Serial.println(err == 0 && bank::write(offset, buffer, len) ? "OK" : "ERR donnees");
  } else if (cmd == "COMMIT") {
    const uint32_t crc = strtoul(nextToken(rest).c_str(), nullptr, 16);
    if (bank::commit(crc)) {
      selected = 0;
      Serial.println("OK " + String(bank::songCount()));
    } else {
      Serial.println("ERR crc");
    }
  } else if (cmd == "PLAY") {
    const int n = nextToken(rest).toInt();
    const uint8_t song = n < 0 ? selected : static_cast<uint8_t>(n);
    if (!bt.isReady()) {
      Serial.println("ERR bluetooth");
    } else if (player::play(song)) {
      selected = song;
      Serial.println("OK");
    } else {
      Serial.println("ERR morceau");
    }
  } else if (cmd == "STOP") {
    player::stop();
    Serial.println("OK");
  } else if (cmd == "SELECT") {
    const int n = nextToken(rest).toInt();
    if (n >= 0 && n < bank::songCount()) selected = n;
    Serial.println("OK");
  } else if (cmd == "TAP") {
    player::PadState s;
    s.buttons = strtoul(nextToken(rest).c_str(), nullptr, 16);
    s.hat = nextToken(rest).toInt();
    s.ly = nextToken(rest).toInt();
    const int ms = nextToken(rest).toInt();
    if (!bt.isReady()) {
      Serial.println("ERR bluetooth");
    } else {
      player::tap(s, ms > 0 && ms < 5000 ? ms : 150);
      Serial.println("OK");
    }
  } else if (cmd == "PAD") {
    player::PadState s;
    s.buttons = strtoul(nextToken(rest).c_str(), nullptr, 16);
    s.hat = nextToken(rest).toInt();
    s.lx = nextToken(rest).toInt();
    s.ly = nextToken(rest).toInt();
    s.rx = nextToken(rest).toInt();
    s.ry = nextToken(rest).toInt();
    if (s.hat > 8) s.hat = 8;
    if (!bt.isReady()) Serial.println("ERR bluetooth");
    else Serial.println(player::manual(s) ? "OK" : "ERR occupe");
  } else if (cmd == "PAIR") {
    player::stop();
    bt.resetConnection(true);
    pairPressUntil = millis() + 60000;
    readySince = 0;
    Serial.println("OK");
  } else if (cmd == "LANG") {
    english = nextToken(rest) == "en";
    prefs.putBool("en", english);
    Serial.println("OK");
  } else if (cmd == "ERASE") {
    player::stop();
    Serial.println(bank::erase() ? "OK" : "ERR flash");
  } else if (cmd == "UNPAIR") {
    player::stop();
    bt.clearStoredPeer();
    bt.resetConnection(false);
    Serial.println("OK");
  } else if (cmd == "RECONNECT") {
    player::stop();
    bt.resetConnection(true);
    Serial.println("OK");
  } else {
    Serial.println("ERR commande inconnue");
  }
}

void readSerial() {
  static char buffer[1200];
  static size_t len = 0;
  while (Serial.available()) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\n' || c == '\r') {
      if (len > 0) {
        buffer[len] = 0;
        handleCommand(String(buffer));
        len = 0;
      }
    } else if (len < sizeof(buffer) - 1) {
      buffer[len++] = c;
    }
  }
}
}

void setup() {
  Serial.setRxBufferSize(8192);
  Serial.begin(SERIAL_BAUD_RATE);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  prefs.begin("ocarina", false);
  english = prefs.getBool("en", false);
  beginDisplay();
  bank::begin();
  bt.begin();
  player::begin(bt);
  const uint8_t check[] = {'1', '2', '3', '4', '5', '6', '7', '8', '9'};
  Serial.printf("BOOT autoocarina-esp32 2 songs=%u crc_check=%08lx\n", bank::songCount(),
                static_cast<unsigned long>(bank::crc32(check, sizeof(check))));
}

void handlePairing() {
  if (!pairPressUntil) return;
  if (millis() > pairPressUntil) {
    pairPressUntil = 0;
    return;
  }
  if (!bt.isReady()) {
    readySince = 0;
    return;
  }
  if (!readySince) readySince = millis();
  if (millis() - readySince < 500) return;
  player::PadState lr;
  lr.buttons = (1u << 4) | (1u << 5);
  player::tap(lr, 300);
  pairPressUntil = 0;
}

void loop() {
  readSerial();
  handlePairing();
  handleButton();
  reportStatusIfChanged();
  drawDisplay();
  delay(2);
}
