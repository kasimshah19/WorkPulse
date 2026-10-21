import env from '../config/env.js';
import logger from '../utils/logger.js';

class VoiceClient {
  constructor() {
    this.baseUrl = env.voiceServiceUrl || 'http://localhost:8000';
    this.apiKey = env.voiceServiceApiKey || 'workpulse-internal-voice-key-2026';
    this.timeoutMs = env.voiceTimeoutMs || 30000;
    this.cooldownSec = env.voiceDegradedCooldownSec || 60;

    // Degraded mode state
    this.consecutiveFailures = 0;
    this.degradedUntil = null;

    // Health check cache (10 seconds)
    this.healthCache = null;
    this.healthCacheExpiry = 0;
  }

  /**
   * Check if the voice service is currently marked as degraded
   */
  isDegraded() {
    if (this.degradedUntil) {
      if (Date.now() < this.degradedUntil) {
        return true;
      }
      // Cooldown expired - reset degraded state
      this.degradedUntil = null;
      this.consecutiveFailures = 0;
    }
    return false;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.degradedUntil = null;
  }

  recordFailure(err) {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= 3) {
      this.degradedUntil = Date.now() + this.cooldownSec * 1000;
      logger.warn(
        `[VoiceClient] 3 consecutive failures reached. Entering degraded mode for ${this.cooldownSec}s.`
      );
    }
  }

  /**
   * Cached health check helper (10 seconds TTL)
   */
  async checkHealth() {
    const now = Date.now();
    if (this.healthCache && now < this.healthCacheExpiry) {
      return this.healthCache;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Health check returned status ${res.status}`);
      }

      const data = await res.json();
      this.healthCache = data;
      this.healthCacheExpiry = now + 10000;
      return data;
    } catch (err) {
      this.healthCache = {
        status: 'unreachable',
        service: 'voice-service',
        sttProvider: 'unavailable',
        whisperModelLoaded: false,
      };
      this.healthCacheExpiry = now + 5000; // Cache failure for 5s
      return this.healthCache;
    }
  }

  /**
   * POST /extract (WebSpeech path)
   */
  async extractSkills({ text, language = 'hi', allowedSkills = [] }) {
    if (this.isDegraded()) {
      const error = new Error('Voice service is temporarily degraded');
      error.code = 'VOICE_UNAVAILABLE';
      error.status = 503;
      error.fallback = 'icons';
      throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          language,
          allowedSkills,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const err = new Error(errorData.detail?.message || errorData.detail || 'Extract failed');
        err.status = res.status;
        err.code = errorData.detail?.error || (res.status === 401 ? 'UNAUTHORIZED' : 'STT_FAILED');
        throw err;
      }

      const data = await res.json();
      this.recordSuccess();
      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Voice service extract timed out');
        timeoutErr.status = 504;
        timeoutErr.code = 'STT_TIMEOUT';
        this.recordFailure(timeoutErr);
        throw timeoutErr;
      }

      this.recordFailure(err);
      if (!err.status || err.status >= 500) {
        const unavailableErr = new Error(err.message || 'Voice service unavailable');
        unavailableErr.status = 503;
        unavailableErr.code = 'VOICE_UNAVAILABLE';
        unavailableErr.fallback = 'icons';
        throw unavailableErr;
      }
      throw err;
    }
  }

  /**
   * POST /onboard (Server audio path: transcribe + extract)
   */
  async onboardAudio({
    audioBuffer,
    filename = 'audio.webm',
    mimeType = 'audio/webm',
    language = 'hi',
    allowedSkills = [],
    clientDurationMs = null,
  }) {
    if (this.isDegraded()) {
      const error = new Error('Voice service is temporarily degraded');
      error.code = 'VOICE_UNAVAILABLE';
      error.status = 503;
      error.fallback = 'icons';
      throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append('file', blob, filename);
      formData.append('language', language);
      formData.append('allowedSkills', JSON.stringify(allowedSkills));
      if (clientDurationMs) {
        formData.append('clientDurationMs', String(clientDurationMs));
      }

      const res = await fetch(`${this.baseUrl}/onboard`, {
        method: 'POST',
        headers: {
          'X-Internal-Key': this.apiKey,
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errDetail = errorData.detail;
        const errMsg = typeof errDetail === 'object' ? errDetail.message : (errDetail || 'Onboard failed');
        const errCode = typeof errDetail === 'object' ? errDetail.error : null;

        const err = new Error(errMsg);
        err.status = res.status;
        err.code = errCode || (res.status === 401 ? 'UNAUTHORIZED' : 'STT_FAILED');
        throw err;
      }

      const data = await res.json();
      this.recordSuccess();
      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Voice service onboard timed out');
        timeoutErr.status = 504;
        timeoutErr.code = 'STT_TIMEOUT';
        this.recordFailure(timeoutErr);
        throw timeoutErr;
      }

      this.recordFailure(err);
      if (err.code && [413, 415, 422].includes(err.status)) {
        throw err;
      }
      if (!err.status || err.status >= 500) {
        const unavailableErr = new Error(err.message || 'Voice service unavailable');
        unavailableErr.status = 503;
        unavailableErr.code = 'VOICE_UNAVAILABLE';
        unavailableErr.fallback = 'icons';
        throw unavailableErr;
      }
      throw err;
    }
  }
}

const voiceClient = new VoiceClient();
export default voiceClient;
