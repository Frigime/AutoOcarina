#include "bank.h"

#include <string.h>
#include "hardware/flash.h"
#include "hardware/sync.h"
#include "pico/stdlib.h"

static const uint8_t *const flash_bank = (const uint8_t *)(XIP_BASE + BANK_FLASH_OFFSET);
static uint8_t song_count = 0;

static uint32_t read_u32(const uint8_t *p) {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

uint32_t bank_crc32(const uint8_t *data, uint32_t len) {
    uint32_t crc = 0xFFFFFFFFu;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int b = 0; b < 8; b++) crc = (crc >> 1) ^ (0xEDB88320u & (0u - (crc & 1u)));
    }
    return ~crc;
}

bool bank_is_valid(const uint8_t *data, uint32_t available) {
    if (available < BANK_HEADER_SIZE) return false;
    if (memcmp(data, "OCAR", 4) != 0 || data[4] != 1) return false;

    uint8_t count = data[5];
    uint32_t total = read_u32(data + 8);
    if (count > BANK_MAX_SONGS) return false;
    if (total > available || total > BANK_MAX_SIZE) return false;
    if (total < BANK_HEADER_SIZE + 8u * count) return false;
    if (bank_crc32(data + BANK_HEADER_SIZE, total - BANK_HEADER_SIZE) != read_u32(data + 12)) return false;

    for (uint8_t i = 0; i < count; i++) {
        const uint8_t *entry = data + BANK_HEADER_SIZE + 8u * i;
        uint32_t offset = read_u32(entry);
        uint32_t events = read_u32(entry + 4);
        if (offset < BANK_HEADER_SIZE + 8u * count) return false;
        if (events > BANK_MAX_SIZE / BANK_EVENT_SIZE) return false;
        if (offset + BANK_NAME_SIZE + events * BANK_EVENT_SIZE > total) return false;
    }
    return true;
}

uint8_t bank_load(void) {
    song_count = bank_is_valid(flash_bank, BANK_MAX_SIZE) ? flash_bank[5] : 0;
    return song_count;
}

uint8_t bank_song_count(void) {
    return song_count;
}

bool bank_get_song(uint8_t index, bank_song_t *out) {
    if (index >= song_count) return false;
    const uint8_t *entry = flash_bank + BANK_HEADER_SIZE + 8u * index;
    out->events = flash_bank + read_u32(entry) + BANK_NAME_SIZE;
    out->event_count = read_u32(entry + 4);
    return true;
}

bool bank_write(const uint8_t *data, uint32_t size) {
    uint32_t padded = (size + FLASH_PAGE_SIZE - 1) / FLASH_PAGE_SIZE * FLASH_PAGE_SIZE;
    for (uint32_t done = 0; done < padded; done += FLASH_SECTOR_SIZE) {
        uint32_t chunk = padded - done < FLASH_SECTOR_SIZE ? padded - done : FLASH_SECTOR_SIZE;
        uint32_t ints = save_and_disable_interrupts();
        flash_range_erase(BANK_FLASH_OFFSET + done, FLASH_SECTOR_SIZE);
        flash_range_program(BANK_FLASH_OFFSET + done, data + done, chunk);
        restore_interrupts(ints);
    }
    bool same = memcmp(flash_bank, data, size) == 0;
    bank_load();
    return same && song_count == data[5];
}

void bank_erase(void) {
    uint32_t ints = save_and_disable_interrupts();
    flash_range_erase(BANK_FLASH_OFFSET, FLASH_SECTOR_SIZE);
    restore_interrupts(ints);
    bank_load();
}
