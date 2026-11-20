#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <stdbool.h>
#include <stdint.h>

#define PROTOCOL_VERSION 1

enum {
    CMD_HELLO = 0x01,
    CMD_BEGIN = 0x02,
    CMD_DATA = 0x03,
    CMD_COMMIT = 0x04,
    CMD_PLAY = 0x05,
    CMD_STOP = 0x06,
    CMD_SELECT = 0x07,
    CMD_BOOTSEL = 0x08,
    CMD_ERASE = 0x09,
};

enum {
    STATUS_NONE = 0x00,
    STATUS_READY = 0x10 | PROTOCOL_VERSION,
    STATUS_RECEIVING = 0x20,
    STATUS_WRITING = 0x30,
    STATUS_SAVED = 0x40,
    STATUS_ERR_SEQUENCE = 0x51,
    STATUS_ERR_SIZE = 0x52,
    STATUS_ERR_CRC = 0x53,
    STATUS_ERR_FORMAT = 0x54,
    STATUS_ERR_FLASH = 0x55,
    STATUS_PLAYING = 0x60,
};

typedef struct {
    bool play;
    uint8_t play_index;
    bool stop;
    bool select;
    uint8_t select_index;
    bool bootsel;
} protocol_requests_t;

void protocol_on_message(const uint8_t msg[8]);

void protocol_task(protocol_requests_t *req);

uint8_t protocol_status(void);
void protocol_set_status(uint8_t status);
bool protocol_session_open(void);

#endif
