#pragma once

#include <cstddef>
#include <cstdint>

namespace bank {
constexpr uint32_t MAX_SIZE = 128 * 1024;
constexpr uint8_t MAX_SONGS = 16;
constexpr uint32_t HEADER_SIZE = 16;
constexpr uint32_t NAME_SIZE = 24;
constexpr uint32_t EVENT_SIZE = 6;

struct Song {
  const uint8_t *events;
  uint32_t eventCount;
  const char *name;
};

uint32_t crc32(const uint8_t *data, size_t len, uint32_t crc = 0);
bool isValid(const uint8_t *data, uint32_t available);

bool begin();
uint8_t songCount();
bool getSong(uint8_t index, Song &out);

bool beginWrite(uint32_t size);
bool write(uint32_t offset, const uint8_t *data, size_t len);
bool commit(uint32_t expectedCrc);
bool erase();
}
