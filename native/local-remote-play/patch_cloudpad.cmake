set(thread_source "${SOURCE_DIR}/lib/src/thread.c")
file(READ "${thread_source}" contents)

set(old_code
"struct timespec timeout;
\tset_timeout(&timeout, timeout_ms);
\tint r = pthread_clockjoin_np(thread->thread, retval, CLOCK_MONOTONIC, &timeout);")

set(new_code
"struct timespec timeout;
#if defined(__linux__) && !defined(__GLIBC__)
\tclock_gettime(CLOCK_REALTIME, &timeout);
\ttimeout.tv_sec += timeout_ms / 1000;
\ttimeout.tv_nsec += (timeout_ms % 1000) * 1000000;
\tif(timeout.tv_nsec >= 1000000000)
\t{
\t\ttimeout.tv_sec += timeout.tv_nsec / 1000000000;
\t\ttimeout.tv_nsec %= 1000000000;
\t}
\tint r = pthread_timedjoin_np(thread->thread, retval, &timeout);
#else
\tset_timeout(&timeout, timeout_ms);
\tint r = pthread_clockjoin_np(thread->thread, retval, CLOCK_MONOTONIC, &timeout);
#endif")

string(FIND "${contents}" "${new_code}" already_patched)
if(already_patched EQUAL -1)
  string(FIND "${contents}" "${old_code}" patch_position)
  if(patch_position EQUAL -1)
    message(FATAL_ERROR "CloudPad thread source no longer matches the pinned compatibility patch")
  endif()
  string(REPLACE "${old_code}" "${new_code}" contents "${contents}")
  file(WRITE "${thread_source}" "${contents}")
endif()
