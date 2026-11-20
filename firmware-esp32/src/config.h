#pragma once

#include <Arduino.h>

constexpr uint32_t SERIAL_BAUD_RATE = 921600;

constexpr uint16_t HID_REPEAT_INTERVAL_MS = 16;
constexpr uint16_t HID_SEND_REPORT_TIMEOUT_MS = 400;

constexpr char BT_DEVICE_NAME[] = "Pro Controller";
constexpr char BT_DEVICE_PROVIDER[] = "Nintendo";
constexpr char BT_DEVICE_DESCRIPTION[] = "Gamepad";
constexpr char CONTROL_TRANSPORT[] = "classic-bt-uartswitchcon";

constexpr uint32_t LIVE_KEEPALIVE_MS = 30;

constexpr int BUTTON_PIN = 0;
