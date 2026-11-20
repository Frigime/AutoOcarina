#ifndef BANK_H
#define BANK_H

#include <stdbool.h>
#include <stdint.h>

#define BANK_FLASH_OFFSET   0x1C0000u
#define BANK_MAX_SIZE       (128u * 1024u)
#define BANK_MAX_SONGS      16
#define BANK_HEADER_SIZE    16
#define BANK_NAME_SIZE      24
#define BANK_EVENT_SIZE     6

typedef struct {
    const uint8_t *events;
    uint32_t event_count;
} bank_song_t;

uint32_t bank_crc32(const uint8_t *data, uint32_t len);

bool bank_is_valid(const uint8_t *data, uint32_t available);

uint8_t bank_load(void);
uint8_t bank_song_count(void);
bool bank_get_song(uint8_t index, bank_song_t *out);

bool bank_write(const uint8_t *data, uint32_t size);
void bank_erase(void);

#endif
