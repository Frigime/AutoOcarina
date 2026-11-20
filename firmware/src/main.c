#include "pico/bootrom.h"
#include "pico/stdlib.h"
#include "tusb.h"

#include "bank.h"
#include "button.h"
#include "led.h"
#include "player.h"
#include "protocol.h"

#define MASK_L (1u << 4)
#define MASK_R (1u << 5)

static pad_state_t pad = {0, HAT_NONE, STICK_MID};
static uint8_t selected = 0;
static uint64_t pair_until_us = 0;
static uint64_t blink_start_us = 0;
static uint8_t blink_count = 0;

static void send_report(uint64_t now_us) {
    if (!tud_hid_ready()) return;
    uint16_t buttons = pad.buttons;
    if (now_us < pair_until_us) buttons |= MASK_L | MASK_R;
    uint8_t report[8] = {
        (uint8_t)(buttons & 0xFF), (uint8_t)(buttons >> 8),
        pad.hat,
        STICK_MID, pad.ly,
        STICK_MID, STICK_MID,
        protocol_status(),
    };
    tud_hid_report(0, report, sizeof(report));
}

static void start_song(uint8_t index, uint64_t now_us) {
    if (index >= bank_song_count()) return;
    selected = index;
    pad = (pad_state_t){0, HAT_NONE, STICK_MID};
    if (player_start(index, now_us)) protocol_set_status(STATUS_PLAYING);
}

static void select_song(uint8_t index, uint64_t now_us) {
    if (index >= bank_song_count()) return;
    selected = index;
    blink_count = index + 1;
    blink_start_us = now_us;
}

static void scale(uint8_t *r, uint8_t *g, uint8_t *b, uint8_t divider) {
    *r /= divider;
    *g /= divider;
    *b /= divider;
}

static void led_task(uint64_t now_us) {
    static uint64_t next_us = 0, result_until_us = 0;
    static uint8_t last_status = STATUS_NONE;
    static uint32_t last_color = 0xFFFFFFFF;
    if (now_us < next_us) return;
    next_us = now_us + 10000;

    uint32_t ms = (uint32_t)(now_us / 1000);
    uint8_t status = protocol_status();
    uint8_t r = 0, g = 0, b = 0;

    if (status != last_status && (status == STATUS_SAVED || (status & 0xF0) == 0x50)) {
        result_until_us = now_us + 2000000;
    }
    last_status = status;

    if (status == STATUS_RECEIVING || status == STATUS_WRITING) {
        b = (ms / 100) % 2 ? 120 : 0;
    } else if (now_us < result_until_us) {
        if (status == STATUS_SAVED) g = 120;
        else r = (ms / 80) % 2 ? 120 : 0;
    } else if (player_is_playing()) {
        led_song_color(selected, &r, &g, &b);
        scale(&r, &g, &b, pad.buttons ? 3 : 24);
    } else if (bank_song_count() == 0) {
        r = (ms % 1000) < 100 ? 60 : 0;
    } else {
        led_song_color(selected, &r, &g, &b);
        uint32_t elapsed = (uint32_t)((now_us - blink_start_us) / 1000);
        if (blink_count && elapsed < blink_count * 300u) {
            if ((elapsed % 300) >= 150) r = g = b = 0;
            else scale(&r, &g, &b, 3);
        } else {
            blink_count = 0;
            scale(&r, &g, &b, 16);
        }
    }

    uint32_t color = ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
    if (color != last_color) {
        led_set(r, g, b);
        last_color = color;
    }
}

int main(void) {
    led_init();
    bank_load();
    tud_init(0);

    while (true) {
        tud_task();
        uint64_t now = time_us_64();

        protocol_requests_t req;
        protocol_task(&req);
        if (req.stop) player_stop();
        if (req.select) select_song(req.select_index, now);
        if (req.play) start_song(req.play_index == 0xFF ? selected : req.play_index, now);
        if (req.bootsel) {
            sleep_ms(50);
            reset_usb_boot(0, 0);
        }

        switch (button_task(now)) {
        case BUTTON_SHORT:
            if (player_is_playing()) player_stop();
            else if (bank_song_count()) select_song((selected + 1) % bank_song_count(), now);
            break;
        case BUTTON_LONG:
            if (player_is_playing()) player_stop();
            else start_song(selected, now);
            break;
        case BUTTON_DOUBLE:
            if (!player_is_playing()) pair_until_us = now + 400000;
            break;
        case BUTTON_NONE:
            break;
        }

        player_task(now, &pad);
        if (!player_is_playing() && protocol_status() == STATUS_PLAYING) protocol_set_status(STATUS_READY);

        led_task(now);
        send_report(now);
    }
}
