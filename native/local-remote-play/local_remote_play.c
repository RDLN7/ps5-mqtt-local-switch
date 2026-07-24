// SPDX-License-Identifier: AGPL-3.0-only
// Local-only PS5 Remote Play registration helper derived from the Chiaki/
// CloudPad registration flow. It deliberately never performs PSN OAuth.

#include <chiaki/base64.h>
#include <chiaki/common.h>
#include <chiaki/log.h>
#include <chiaki/regist.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  pthread_mutex_t mutex;
  pthread_cond_t done;
  int finished;
  int success;
  char regist_key[CHIAKI_SESSION_AUTH_SIZE + 1];
} RegisterResult;

static void registration_callback(ChiakiRegistEvent *event, void *user) {
  RegisterResult *result = user;
  pthread_mutex_lock(&result->mutex);
  result->success = event->type == CHIAKI_REGIST_EVENT_TYPE_FINISHED_SUCCESS;
  if (result->success) {
    memcpy(result->regist_key, event->registered_host->rp_regist_key,
           CHIAKI_SESSION_AUTH_SIZE);
    result->regist_key[CHIAKI_SESSION_AUTH_SIZE] = '\0';
  }
  result->finished = 1;
  pthread_cond_signal(&result->done);
  pthread_mutex_unlock(&result->mutex);
}

static int register_console(const char *host, const char *account_id, const char *pin) {
  ChiakiLog log;
  chiaki_log_init(&log, CHIAKI_LOG_ALL & ~CHIAKI_LOG_VERBOSE, chiaki_log_cb_print, NULL);

  ChiakiRegistInfo info = {0};
  info.target = CHIAKI_TARGET_PS5_1;
  info.host = host;
  info.pin = (uint32_t)strtoul(pin, NULL, 10);

  size_t account_id_size = CHIAKI_PSN_ACCOUNT_ID_SIZE;
  if (chiaki_base64_decode(account_id, strlen(account_id), info.psn_account_id,
                           &account_id_size) != CHIAKI_ERR_SUCCESS ||
      account_id_size != CHIAKI_PSN_ACCOUNT_ID_SIZE) {
    fprintf(stderr, "Invalid Base64 PSN account ID.\n");
    return 2;
  }

  RegisterResult result = {0};
  pthread_mutex_init(&result.mutex, NULL);
  pthread_cond_init(&result.done, NULL);

  ChiakiRegist regist;
  ChiakiErrorCode error = chiaki_regist_start(&regist, &log, &info,
                                               registration_callback, &result);
  if (error != CHIAKI_ERR_SUCCESS) {
    fprintf(stderr, "Unable to start local registration: %s\n", chiaki_error_string(error));
    return 1;
  }

  pthread_mutex_lock(&result.mutex);
  while (!result.finished)
    pthread_cond_wait(&result.done, &result.mutex);
  pthread_mutex_unlock(&result.mutex);
  chiaki_regist_fini(&regist);

  if (!result.success) {
    fprintf(stderr, "PS5 rejected local registration. Generate a fresh PIN and retry.\n");
    return 1;
  }
  printf("{\"regist_key\":\"%s\"}\n", result.regist_key);
  return 0;
}

int main(int argc, char **argv) {
  if (argc != 5 || strcmp(argv[1], "register") != 0) {
    fprintf(stderr, "Usage: %s register <ps5-ip> <base64-account-id> <8-digit-pin>\n", argv[0]);
    return 2;
  }
  return register_console(argv[2], argv[3], argv[4]);
}
