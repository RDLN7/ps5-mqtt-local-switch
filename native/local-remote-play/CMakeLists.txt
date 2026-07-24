cmake_minimum_required(VERSION 3.20)
project(ps5_mqtt_local_remote_play C)

include(FetchContent)

# CloudPad provides the proven local PS5 registration implementation used by
# Chiaki: Base64 account ID + console PIN -> persistent registration key.
FetchContent_Declare(
  cloudpad
  GIT_REPOSITORY https://github.com/Chazq2023/CloudPad-Android.git
  GIT_TAG 3f68cb19c4c1e06c8aa584d860421864ff506c4c
  GIT_SUBMODULES_RECURSE TRUE
)

set(CHIAKI_ENABLE_TESTS OFF CACHE BOOL "" FORCE)
set(CHIAKI_ENABLE_CLI OFF CACHE BOOL "" FORCE)
set(CHIAKI_ENABLE_GUI OFF CACHE BOOL "" FORCE)
set(CHIAKI_ENABLE_BOREALIS OFF CACHE BOOL "" FORCE)
set(CHIAKI_ENABLE_SETSU OFF CACHE STRING "" FORCE)
set(CHIAKI_ENABLE_STEAMDECK_NATIVE OFF CACHE STRING "" FORCE)
set(CHIAKI_ENABLE_STEAM_SHORTCUT OFF CACHE BOOL "" FORCE)
set(CHIAKI_ENABLE_FFMPEG_DECODER OFF CACHE STRING "" FORCE)
set(CHIAKI_ENABLE_PI_DECODER OFF CACHE STRING "" FORCE)
set(CHIAKI_LIB_ENABLE_OPUS OFF CACHE BOOL "" FORCE)
set(CHIAKI_USE_SYSTEM_CURL ON CACHE STRING "" FORCE)
set(CHIAKI_USE_SYSTEM_JERASURE ON CACHE STRING "" FORCE)
set(CHIAKI_USE_SYSTEM_NANOPB ON CACHE STRING "" FORCE)

FetchContent_MakeAvailable(cloudpad)

add_executable(ps5-mqtt-local-rp local_remote_play.c)
target_link_libraries(ps5-mqtt-local-rp PRIVATE chiaki-lib)
install(TARGETS ps5-mqtt-local-rp RUNTIME DESTINATION bin)
