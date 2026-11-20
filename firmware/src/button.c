#include "button.h"

#include <stdbool.h>
#include "hardware/gpio.h"
#include "hardware/structs/ioqspi.h"
#include "hardware/structs/sio.h"
#include "hardware/sync.h"

#define POLL_US        10000u
#define LONG_US        700000u
#define DOUBLE_GAP_US  350000u

// Lecture du bouton BOOTSEL d'après pico-examples (BSD-3-Clause, Raspberry Pi).
static bool __no_inline_not_in_flash_func(read_bootsel)(void) {
#if PICO_RP2040
    const uint CS_PIN_INDEX = 1;
#else
    const uint CS_PIN_INDEX = 2;
#endif
    uint32_t flags = save_and_disable_interrupts();
    hw_write_masked(&ioqspi_hw->io[CS_PIN_INDEX].ctrl,
                    GPIO_OVERRIDE_LOW << IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_LSB,
                    IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_BITS);
    for (volatile int i = 0; i < 1000; ++i);
    bool pressed = !(sio_hw->gpio_hi_in & (1u << CS_PIN_INDEX));
    hw_write_masked(&ioqspi_hw->io[CS_PIN_INDEX].ctrl,
                    GPIO_OVERRIDE_NORMAL << IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_LSB,
                    IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_BITS);
    restore_interrupts(flags);
    return pressed;
}

button_event_t button_task(uint64_t now_us) {
    static uint64_t next_poll = 0, down_since = 0, last_release = 0;
    static bool stable = false, previous_raw = false, long_fired = false, click_pending = false;

    if (now_us < next_poll) return BUTTON_NONE;
    next_poll = now_us + POLL_US;

    bool raw = read_bootsel();
    bool changed = raw == previous_raw && raw != stable;
    previous_raw = raw;

    if (changed) {
        stable = raw;
        if (stable) {
            down_since = now_us;
            long_fired = false;
        } else if (!long_fired) {
            if (click_pending && now_us - last_release < DOUBLE_GAP_US) {
                click_pending = false;
                return BUTTON_DOUBLE;
            }
            click_pending = true;
            last_release = now_us;
        }
    }

    if (stable && !long_fired && now_us - down_since >= LONG_US) {
        long_fired = true;
        click_pending = false;
        return BUTTON_LONG;
    }
    if (click_pending && !stable && now_us - last_release >= DOUBLE_GAP_US) {
        click_pending = false;
        return BUTTON_SHORT;
    }
    return BUTTON_NONE;
}
