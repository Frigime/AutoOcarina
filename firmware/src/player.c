#include "player.h"
#include "bank.h"

static bank_song_t song;
static uint32_t next_event;
static uint64_t next_time_us;
static bool playing = false;
static bool must_reset = false;

static uint16_t read_u16(const uint8_t *p) {
    return (uint16_t)(p[0] | (p[1] << 8));
}

bool player_start(uint8_t index, uint64_t now_us) {
    if (!bank_get_song(index, &song) || song.event_count == 0) return false;
    next_event = 0;
    next_time_us = now_us + (uint64_t)read_u16(song.events) * 1000u;
    playing = true;
    return true;
}

void player_stop(void) {
    if (playing) must_reset = true;
    playing = false;
}

bool player_is_playing(void) {
    return playing;
}

void player_task(uint64_t now_us, pad_state_t *pad) {
    if (must_reset) {
        pad->buttons = 0;
        pad->hat = HAT_NONE;
        pad->ly = STICK_MID;
        must_reset = false;
    }
    while (playing && now_us >= next_time_us) {
        const uint8_t *ev = song.events + next_event * BANK_EVENT_SIZE;
        pad->buttons = read_u16(ev + 2);
        pad->hat = ev[4] <= HAT_NONE ? ev[4] : HAT_NONE;
        pad->ly = ev[5];
        next_event++;
        if (next_event >= song.event_count) {
            player_stop();
            break;
        }
        next_time_us += (uint64_t)read_u16(song.events + next_event * BANK_EVENT_SIZE) * 1000u;
    }
}
