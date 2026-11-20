#include "protocol.h"

#include <string.h>
#include "bank.h"

static uint8_t staging[BANK_MAX_SIZE];
static uint32_t expected_size;
static uint32_t received;
static uint32_t packets;

static uint8_t status = STATUS_NONE;
static bool session = false;
static bool pending_commit, pending_erase;
static protocol_requests_t pending;

static uint32_t read_u32(const uint8_t *p) {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

void protocol_on_message(const uint8_t msg[8]) {
    uint8_t cmd = msg[0];

    if (cmd == CMD_HELLO) {
        if (memcmp(msg + 1, "OCA", 3) == 0) {
            session = true;
            status = STATUS_READY;
        }
        return;
    }
    if (!session) return;

    switch (cmd) {
    case CMD_BEGIN:
        expected_size = read_u32(msg + 1);
        received = 0;
        packets = 0;
        if (expected_size < BANK_HEADER_SIZE || expected_size > BANK_MAX_SIZE) {
            status = STATUS_ERR_SIZE;
        } else {
            status = STATUS_RECEIVING;
            pending.stop = true;
        }
        break;

    case CMD_DATA: {
        if (status != STATUS_RECEIVING) break;
        if (msg[1] != (uint8_t)(packets & 0xFF)) {
            status = STATUS_ERR_SEQUENCE;
            break;
        }
        uint32_t n = expected_size - received;
        if (n > 6) n = 6;
        memcpy(staging + received, msg + 2, n);
        received += n;
        packets++;
        break;
    }

    case CMD_COMMIT:
        if (status != STATUS_RECEIVING || received != expected_size) {
            status = STATUS_ERR_SEQUENCE;
        } else if (bank_crc32(staging, received) != read_u32(msg + 1)) {
            status = STATUS_ERR_CRC;
        } else if (!bank_is_valid(staging, received)) {
            status = STATUS_ERR_FORMAT;
        } else {
            status = STATUS_WRITING;
            pending_commit = true;
        }
        break;

    case CMD_PLAY:
        pending.play = true;
        pending.play_index = msg[1];
        break;

    case CMD_STOP:
        pending.stop = true;
        break;

    case CMD_SELECT:
        pending.select = true;
        pending.select_index = msg[1];
        break;

    case CMD_BOOTSEL:
        pending.bootsel = true;
        break;

    case CMD_ERASE:
        pending_erase = true;
        break;
    }
}

void protocol_task(protocol_requests_t *req) {
    if (pending_commit) {
        pending_commit = false;
        status = bank_write(staging, expected_size) ? STATUS_SAVED : STATUS_ERR_FLASH;
    }
    if (pending_erase) {
        pending_erase = false;
        bank_erase();
        status = STATUS_SAVED;
    }
    *req = pending;
    memset(&pending, 0, sizeof(pending));
}

uint8_t protocol_status(void) {
    return status;
}

void protocol_set_status(uint8_t s) {
    if (session) status = s;
}

bool protocol_session_open(void) {
    return session;
}
