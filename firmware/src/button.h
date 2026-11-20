#ifndef BUTTON_H
#define BUTTON_H

#include <stdint.h>

typedef enum {
    BUTTON_NONE,
    BUTTON_SHORT,
    BUTTON_LONG,
    BUTTON_DOUBLE,
} button_event_t;

button_event_t button_task(uint64_t now_us);

#endif
