cmake_minimum_required(VERSION 3.13)

set(PICO_BOARD waveshare_rp2040_zero CACHE STRING "Carte cible")

include(pico_sdk_import.cmake)

project(autoocarina C CXX ASM)
set(CMAKE_C_STANDARD 11)

pico_sdk_init()

add_executable(autoocarina
    src/main.c
    src/usb_descriptors.c
    src/bank.c
    src/protocol.c
    src/player.c
    src/led.c
    src/button.c
)

target_include_directories(autoocarina PRIVATE src)

if (PICO_BOARD MATCHES "^waveshare_")
    target_compile_definitions(autoocarina PRIVATE LED_ORDER_RGB=1)
endif()
target_compile_options(autoocarina PRIVATE -Wall -Wextra -Wno-unused-parameter)

target_link_libraries(autoocarina PRIVATE
    pico_stdlib
    pico_bootrom
    tinyusb_device
    hardware_pio
    hardware_flash
    hardware_sync
)

option(OCARINA_CYW43_LED "LED des Pico W (demande pioasm)" OFF)
if (PICO_CYW43_SUPPORTED AND OCARINA_CYW43_LED)
    target_link_libraries(autoocarina PRIVATE pico_cyw43_arch_none)
    target_compile_definitions(autoocarina PRIVATE OCARINA_CYW43_LED=1)
endif()

pico_enable_stdio_usb(autoocarina 0)
pico_enable_stdio_uart(autoocarina 0)

if (PICO_PLATFORM MATCHES "rp2350")
    set(UF2_FAMILY 0xe48bff59)
else()
    set(UF2_FAMILY 0xe48bff56)
endif()
find_package(Python3 REQUIRED COMPONENTS Interpreter)
add_custom_command(TARGET autoocarina POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:autoocarina> autoocarina.bin
    COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/tools/bin2uf2.py autoocarina.bin autoocarina.uf2 0x10000000 ${UF2_FAMILY}
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
    COMMENT "Creation de autoocarina.uf2"
)
