#ifndef LED_H
#define LED_H

#include <stdint.h>

#ifndef LED_ORDER_RGB
#define LED_ORDER_RGB 0
#endif

void led_init(void);
void led_set(uint8_t r, uint8_t g, uint8_t b);

void led_song_color(uint8_t song, uint8_t *r, uint8_t *g, uint8_t *b);

#endif
