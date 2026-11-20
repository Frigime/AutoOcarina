#ifndef PLAYER_H
#define PLAYER_H

#include <stdbool.h>
#include <stdint.h>

#define HAT_NONE   8
#define STICK_MID  0x80

typedef struct {
    uint16_t buttons;
    uint8_t hat;
    uint8_t ly;
} pad_state_t;

bool player_start(uint8_t song, uint64_t now_us);
void player_stop(void);
bool player_is_playing(void);

void player_task(uint64_t now_us, pad_state_t *pad);

#endif
