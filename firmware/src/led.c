#include "led.h"

#ifndef OCARINA_CYW43_LED
#define OCARINA_CYW43_LED 0
#endif

#include "pico/stdlib.h"

#if defined(PICO_DEFAULT_WS2812_PIN)
#include "hardware/clocks.h"
#include "hardware/pio.h"
#elif defined(CYW43_WL_GPIO_LED_PIN) && OCARINA_CYW43_LED
#include "pico/cyw43_arch.h"
#endif

static const uint8_t palette[8][3] = {
    {255, 0, 0},
    {255, 100, 0},
    {255, 220, 0},
    {0, 255, 0},
    {0, 220, 255},
    {0, 0, 255},
    {160, 0, 255},
    {255, 0, 150},
};

#if defined(PICO_DEFAULT_WS2812_PIN)

#define LED_PIN PICO_DEFAULT_WS2812_PIN

// Programme PIO ws2812 de pico-examples (BSD-3-Clause, Raspberry Pi), déjà assemblé.
static const uint16_t ws2812_program_instructions[] = {
    0x6221,
    0x1123,
    0x1400,
    0xa442,
};

static const struct pio_program ws2812_program = {
    .instructions = ws2812_program_instructions,
    .length = 4,
    .origin = -1,
};

static PIO pio = pio0;
static uint sm = 0;

void led_init(void) {
#ifdef PICO_DEFAULT_WS2812_POWER_PIN
    gpio_init(PICO_DEFAULT_WS2812_POWER_PIN);
    gpio_set_dir(PICO_DEFAULT_WS2812_POWER_PIN, GPIO_OUT);
    gpio_put(PICO_DEFAULT_WS2812_POWER_PIN, 1);
#endif
    uint offset = pio_add_program(pio, &ws2812_program);
    pio_gpio_init(pio, LED_PIN);
    pio_sm_set_consecutive_pindirs(pio, sm, LED_PIN, 1, true);

    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset, offset + 3);
    sm_config_set_sideset(&c, 1, false, false);
    sm_config_set_sideset_pins(&c, LED_PIN);
    sm_config_set_out_shift(&c, false, true, 24);
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_TX);
    sm_config_set_clkdiv(&c, clock_get_hz(clk_sys) / (800000.0f * 10));
    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_enabled(pio, sm, true);
    led_set(0, 0, 0);
}

void led_set(uint8_t r, uint8_t g, uint8_t b) {
#if LED_ORDER_RGB
    uint32_t word = ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
#else
    uint32_t word = ((uint32_t)g << 16) | ((uint32_t)r << 8) | b;
#endif
    pio_sm_put_blocking(pio, sm, word << 8u);
}

#else

static bool led_on = false;

static void led_write(bool on) {
#if defined(CYW43_WL_GPIO_LED_PIN) && OCARINA_CYW43_LED
    cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, on);
#elif defined(PICO_DEFAULT_LED_PIN)
    gpio_put(PICO_DEFAULT_LED_PIN, on);
#else
    (void)on;
#endif
}

void led_init(void) {
#if defined(CYW43_WL_GPIO_LED_PIN) && OCARINA_CYW43_LED
    cyw43_arch_init();
#elif defined(PICO_DEFAULT_LED_PIN)
    gpio_init(PICO_DEFAULT_LED_PIN);
    gpio_set_dir(PICO_DEFAULT_LED_PIN, GPIO_OUT);
#endif
    led_write(false);
}

void led_set(uint8_t r, uint8_t g, uint8_t b) {
    bool on = (uint16_t)r + g + b > 60;
    if (on == led_on) return;
    led_on = on;
    led_write(on);
}

#endif

void led_song_color(uint8_t song, uint8_t *r, uint8_t *g, uint8_t *b) {
    const uint8_t *c = palette[song % 8];
    *r = c[0];
    *g = c[1];
    *b = c[2];
}
