#include "bank.h"

#include <cstring>

#include "esp_partition.h"
#include "esp_rom_crc.h"
#include "esp_spi_flash.h"

namespace bank {
namespace {
const esp_partition_t *partition = nullptr;
const uint8_t *mapped = nullptr;
spi_flash_mmap_handle_t mapHandle = 0;
uint8_t count = 0;
uint32_t writeSize = 0;

uint32_t readU32(const uint8_t *p) {
  return static_cast<uint32_t>(p[0]) | (static_cast<uint32_t>(p[1]) << 8) |
         (static_cast<uint32_t>(p[2]) << 16) | (static_cast<uint32_t>(p[3]) << 24);
}

void remap() {
  if (mapped != nullptr) {
    spi_flash_munmap(mapHandle);
    mapped = nullptr;
  }
  const void *ptr = nullptr;
  if (esp_partition_mmap(partition, 0, partition->size, SPI_FLASH_MMAP_DATA, &ptr, &mapHandle) == ESP_OK) {
    mapped = static_cast<const uint8_t *>(ptr);
  }
  count = mapped != nullptr && isValid(mapped, partition->size) ? mapped[5] : 0;
}
}

uint32_t crc32(const uint8_t *data, size_t len, uint32_t crc) {
  return esp_rom_crc32_le(crc, data, len);
}

bool isValid(const uint8_t *data, uint32_t available) {
  if (available < HEADER_SIZE) return false;
  if (std::memcmp(data, "OCAR", 4) != 0 || data[4] != 1) return false;
  const uint8_t n = data[5];
  const uint32_t total = readU32(data + 8);
  if (n > MAX_SONGS || total > available || total > MAX_SIZE) return false;
  if (total < HEADER_SIZE + 8u * n) return false;
  if (crc32(data + HEADER_SIZE, total - HEADER_SIZE) != readU32(data + 12)) return false;
  for (uint8_t i = 0; i < n; i++) {
    const uint8_t *entry = data + HEADER_SIZE + 8u * i;
    const uint32_t offset = readU32(entry);
    const uint32_t events = readU32(entry + 4);
    if (offset < HEADER_SIZE + 8u * n) return false;
    if (events > MAX_SIZE / EVENT_SIZE) return false;
    if (offset + NAME_SIZE + events * EVENT_SIZE > total) return false;
  }
  return true;
}

bool begin() {
  partition = esp_partition_find_first(
      ESP_PARTITION_TYPE_DATA, static_cast<esp_partition_subtype_t>(0x99), "ocarina");
  if (partition == nullptr) return false;
  remap();
  return true;
}

uint8_t songCount() { return count; }

bool getSong(uint8_t index, Song &out) {
  if (index >= count || mapped == nullptr) return false;
  const uint8_t *entry = mapped + HEADER_SIZE + 8u * index;
  const uint8_t *song = mapped + readU32(entry);
  out.name = reinterpret_cast<const char *>(song);
  out.events = song + NAME_SIZE;
  out.eventCount = readU32(entry + 4);
  return true;
}

bool beginWrite(uint32_t size) {
  if (partition == nullptr || size < HEADER_SIZE || size > MAX_SIZE || size > partition->size) return false;
  const uint32_t eraseSize = (size + 4095) / 4096 * 4096;
  count = 0;
  if (esp_partition_erase_range(partition, 0, eraseSize) != ESP_OK) return false;
  writeSize = size;
  return true;
}

bool write(uint32_t offset, const uint8_t *data, size_t len) {
  if (partition == nullptr || offset + len > writeSize) return false;
  return esp_partition_write(partition, offset, data, len) == ESP_OK;
}

bool commit(uint32_t expectedCrc) {
  if (partition == nullptr || writeSize == 0) return false;
  uint8_t buffer[512];
  uint32_t crc = 0;
  for (uint32_t done = 0; done < writeSize; done += sizeof(buffer)) {
    const uint32_t n = writeSize - done < sizeof(buffer) ? writeSize - done : sizeof(buffer);
    if (esp_partition_read(partition, done, buffer, n) != ESP_OK) return false;
    crc = crc32(buffer, n, crc);
  }
  writeSize = 0;
  remap();
  return crc == expectedCrc && count > 0;
}

bool erase() {
  if (partition == nullptr) return false;
  const bool ok = esp_partition_erase_range(partition, 0, 4096) == ESP_OK;
  remap();
  return ok;
}
}
