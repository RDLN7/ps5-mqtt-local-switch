// SPDX-License-Identifier: AGPL-3.0-only
// Local PS5 control using Chiaki. No PSN OAuth is performed.

#include <chiaki/base64.h>
#include <chiaki/common.h>
#include <chiaki/discovery.h>
#include <chiaki/log.h>
#include <chiaki/regist.h>
#include <chiaki/session.h>
#include <ctype.h>
#include <errno.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define CONNECT_TIMEOUT_SECONDS 30

typedef struct {
	pthread_mutex_t mutex;
	pthread_cond_t condition;
	int finished;
	int success;
	ChiakiRegisteredHost host;
} RegisterResult;

typedef struct {
	pthread_mutex_t mutex;
	pthread_cond_t condition;
	int connected;
	int quit;
	ChiakiQuitReason quit_reason;
	ChiakiSession *session;
	const char *login_pin;
} SessionResult;

static void print_hex(const uint8_t *value, size_t size)
{
	for(size_t i = 0; i < size; i++)
		printf("%02x", value[i]);
}

static int decode_hex(const char *value, uint8_t *output, size_t output_size)
{
	if(strlen(value) != output_size * 2)
		return 0;
	for(size_t i = 0; i < output_size; i++)
	{
		char pair[3] = { value[i * 2], value[i * 2 + 1], '\0' };
		if(!isxdigit((unsigned char)pair[0]) || !isxdigit((unsigned char)pair[1]))
			return 0;
		output[i] = (uint8_t)strtoul(pair, NULL, 16);
	}
	return 1;
}

static int parse_regist_key(
	const char *key,
	char output[CHIAKI_SESSION_AUTH_SIZE])
{
	size_t size = strlen(key);
	if(size == 0)
		return 0;
	memset(output, 0, CHIAKI_SESSION_AUTH_SIZE);

	/*
	 * Chiaki stores the registration key as up to 8 ASCII hex characters.
	 * Older ps5-mqtt/playactor credentials store the PS5-RegistKey response
	 * header instead, where those ASCII bytes are themselves hex-encoded.
	 * Accept both forms so existing installations migrate without re-pairing.
	 */
	if(size <= sizeof(uint64_t))
	{
		for(size_t i = 0; i < size; i++)
		{
			if(!isxdigit((unsigned char)key[i]))
				return 0;
		}
		memcpy(output, key, size);
		return 1;
	}

	if(size != sizeof(uint64_t) * 2)
		return 0;
	for(size_t i = 0; i < sizeof(uint64_t); i++)
	{
		char pair[3] = { key[i * 2], key[i * 2 + 1], '\0' };
		if(!isxdigit((unsigned char)pair[0]) ||
			!isxdigit((unsigned char)pair[1]))
			return 0;
		output[i] = (char)strtoul(pair, NULL, 16);
		if(!isxdigit((unsigned char)output[i]))
			return 0;
	}
	return 1;
}

static int parse_pin(const char *value, uint32_t *pin)
{
	if(strlen(value) != 8)
		return 0;
	for(const char *cursor = value; *cursor; cursor++)
	{
		if(!isdigit((unsigned char)*cursor))
			return 0;
	}
	errno = 0;
	unsigned long parsed = strtoul(value, NULL, 10);
	if(errno != 0 || parsed > UINT32_MAX)
		return 0;
	*pin = (uint32_t)parsed;
	return 1;
}

static void registration_callback(ChiakiRegistEvent *event, void *user)
{
	RegisterResult *result = user;
	pthread_mutex_lock(&result->mutex);
	result->success = event->type == CHIAKI_REGIST_EVENT_TYPE_FINISHED_SUCCESS;
	if(result->success)
		memcpy(&result->host, event->registered_host, sizeof(result->host));
	result->finished = 1;
	pthread_cond_signal(&result->condition);
	pthread_mutex_unlock(&result->mutex);
}

static int register_console(const char *host, const char *account_id, const char *pin_value)
{
	ChiakiLog log;
	chiaki_log_init(&log, CHIAKI_LOG_ALL & ~CHIAKI_LOG_VERBOSE, chiaki_log_cb_print, NULL);

	ChiakiRegistInfo info = { 0 };
	info.target = CHIAKI_TARGET_PS5_1;
	info.host = host;
	if(!parse_pin(pin_value, &info.pin))
	{
		fprintf(stderr, "PIN must contain exactly 8 digits.\n");
		return 2;
	}

	size_t account_id_size = sizeof(info.psn_account_id);
	ChiakiErrorCode error = chiaki_base64_decode(
		account_id, strlen(account_id), info.psn_account_id, &account_id_size);
	if(error != CHIAKI_ERR_SUCCESS || account_id_size != CHIAKI_PSN_ACCOUNT_ID_SIZE)
	{
		fprintf(stderr, "Account ID must be Base64 for exactly 8 bytes.\n");
		return 2;
	}

	RegisterResult result = { 0 };
	pthread_mutex_init(&result.mutex, NULL);
	pthread_cond_init(&result.condition, NULL);

	ChiakiRegist registration;
	error = chiaki_regist_start(
		&registration, &log, &info, registration_callback, &result);
	if(error != CHIAKI_ERR_SUCCESS)
	{
		fprintf(stderr, "Could not start registration: %s\n", chiaki_error_string(error));
		return 1;
	}

	pthread_mutex_lock(&result.mutex);
	while(!result.finished)
		pthread_cond_wait(&result.condition, &result.mutex);
	pthread_mutex_unlock(&result.mutex);
	chiaki_regist_fini(&registration);
	pthread_cond_destroy(&result.condition);
	pthread_mutex_destroy(&result.mutex);

	if(!result.success)
	{
		fprintf(stderr, "Registration failed. Check the PS5 IP, account and Link Device PIN.\n");
		return 1;
	}

	printf("{\"host\":\"%s\",\"regist_key\":\"", host);
	fwrite(
		result.host.rp_regist_key,
		1,
		strnlen(result.host.rp_regist_key, CHIAKI_SESSION_AUTH_SIZE),
		stdout);
	printf("\",\"rp_key\":\"");
	print_hex(result.host.rp_key, sizeof(result.host.rp_key));
	printf("\",\"rp_key_type\":%u,\"server_mac\":\"", result.host.rp_key_type);
	print_hex(result.host.server_mac, sizeof(result.host.server_mac));
	printf("\"}\n");
	return 0;
}

static int wake_console(const char *host, const char *regist_key_value)
{
	char regist_key[CHIAKI_SESSION_AUTH_SIZE];
	if(!parse_regist_key(regist_key_value, regist_key))
	{
		fprintf(stderr, "Invalid registration key.\n");
		return 2;
	}

	errno = 0;
	uint64_t credential = strtoull(regist_key, NULL, 16);
	if(errno != 0 || credential == 0)
	{
		fprintf(stderr, "Invalid wake credential.\n");
		return 2;
	}

	ChiakiLog log;
	chiaki_log_init(&log, CHIAKI_LOG_ALL & ~CHIAKI_LOG_VERBOSE, chiaki_log_cb_print, NULL);
	ChiakiErrorCode error =
		chiaki_discovery_wakeup(&log, NULL, host, credential, true);
	if(error != CHIAKI_ERR_SUCCESS)
	{
		fprintf(stderr, "Wake failed: %s\n", chiaki_error_string(error));
		return 1;
	}
	printf("{\"ok\":true}\n");
	return 0;
}

static void session_callback(ChiakiEvent *event, void *user)
{
	SessionResult *result = user;
	if(event->type == CHIAKI_EVENT_LOGIN_PIN_REQUEST && result->login_pin)
	{
		chiaki_session_set_login_pin(
			result->session,
			(const uint8_t *)result->login_pin,
			strlen(result->login_pin));
		return;
	}

	pthread_mutex_lock(&result->mutex);
	if(event->type == CHIAKI_EVENT_CONNECTED)
		result->connected = 1;
	else if(event->type == CHIAKI_EVENT_QUIT)
	{
		result->quit = 1;
		result->quit_reason = event->quit.reason;
	}
	pthread_cond_signal(&result->condition);
	pthread_mutex_unlock(&result->mutex);
}

static int standby_console(
	const char *host,
	const char *regist_key_value,
	const char *rp_key_value,
	const char *login_pin)
{
	ChiakiConnectInfo info = { 0 };
	info.ps5 = true;
	info.host = host;
	info.audio_video_disabled = CHIAKI_AUDIO_VIDEO_DISABLED;
	info.enable_keyboard = false;
	info.enable_dualsense = false;
	info.packet_loss_max = 0.1;
	chiaki_connect_video_profile_preset(
		&info.video_profile,
		CHIAKI_VIDEO_RESOLUTION_PRESET_360p,
		CHIAKI_VIDEO_FPS_PRESET_30);

	if(!parse_regist_key(regist_key_value, info.regist_key) ||
		!decode_hex(rp_key_value, info.morning, sizeof(info.morning)))
	{
		fprintf(stderr, "Invalid local Remote Play credentials.\n");
		return 2;
	}

	ChiakiLog log;
	chiaki_log_init(&log, CHIAKI_LOG_ALL & ~CHIAKI_LOG_VERBOSE, chiaki_log_cb_print, NULL);
	ChiakiSession session;
	ChiakiErrorCode error = chiaki_session_init(&session, &info, &log);
	if(error != CHIAKI_ERR_SUCCESS)
	{
		fprintf(stderr, "Could not initialize session: %s\n", chiaki_error_string(error));
		return 1;
	}

	SessionResult result = { 0 };
	result.session = &session;
	result.login_pin = login_pin && *login_pin ? login_pin : NULL;
	pthread_mutex_init(&result.mutex, NULL);
	pthread_cond_init(&result.condition, NULL);
	chiaki_session_set_event_cb(&session, session_callback, &result);

	error = chiaki_session_start(&session);
	if(error != CHIAKI_ERR_SUCCESS)
	{
		fprintf(stderr, "Could not start session: %s\n", chiaki_error_string(error));
		chiaki_session_fini(&session);
		return 1;
	}

	struct timespec deadline;
	clock_gettime(CLOCK_REALTIME, &deadline);
	deadline.tv_sec += CONNECT_TIMEOUT_SECONDS;
	pthread_mutex_lock(&result.mutex);
	while(!result.connected && !result.quit)
	{
		if(pthread_cond_timedwait(&result.condition, &result.mutex, &deadline) == ETIMEDOUT)
			break;
	}
	int connected = result.connected;
	ChiakiQuitReason quit_reason = result.quit_reason;
	int quit = result.quit;
	pthread_mutex_unlock(&result.mutex);

	int return_code = 0;
	if(!connected)
	{
		fprintf(stderr, "Remote Play connection failed or timed out (%s).\n",
			quit ? chiaki_quit_reason_string(quit_reason) : "timeout");
		return_code = 1;
	}
	else
	{
		error = chiaki_session_goto_bed(&session);
		if(error != CHIAKI_ERR_SUCCESS)
		{
			fprintf(stderr, "Rest Mode request failed: %s\n", chiaki_error_string(error));
			return_code = 1;
		}
		else
		{
			struct timespec delay = { .tv_sec = 1, .tv_nsec = 0 };
			nanosleep(&delay, NULL);
			printf("{\"ok\":true}\n");
		}
	}

	chiaki_session_stop(&session);
	chiaki_session_join(&session);
	chiaki_session_fini(&session);
	pthread_cond_destroy(&result.condition);
	pthread_mutex_destroy(&result.mutex);
	return return_code;
}

static void usage(const char *program)
{
	fprintf(stderr,
		"Usage:\n"
		"  %s register <ps5-ip> <base64-account-id> <8-digit-pin>\n"
		"  %s wake <ps5-ip> <registration-key>\n"
		"  %s standby <ps5-ip> <registration-key> <rp-key-hex> [login-passcode]\n",
		program, program, program);
}

int main(int argc, char **argv)
{
	if(argc == 5 && strcmp(argv[1], "register") == 0)
		return register_console(argv[2], argv[3], argv[4]);
	if(argc == 4 && strcmp(argv[1], "wake") == 0)
		return wake_console(argv[2], argv[3]);
	if((argc == 5 || argc == 6) && strcmp(argv[1], "standby") == 0)
		return standby_console(argv[2], argv[3], argv[4], argc == 6 ? argv[5] : NULL);
	usage(argv[0]);
	return 2;
}
