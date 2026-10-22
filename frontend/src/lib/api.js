import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 20000,
});

// Friendly Hindi and English translations for Phase 4 error codes
export const ERROR_MESSAGES = {
  OUTSIDE_GEOFENCE: (details) =>
    details?.distanceMeters
      ? `Aap site se ${details.distanceMeters} m door hain. ${details.allowedMeters} m ke andar aayein.`
      : 'आप काम की जगह (site) के घेरे से बाहर हैं। कृपया साइट के अंदर आएँ।',
  LOW_ACCURACY: (details) =>
    details?.accuracy
      ? `GPS सिग्नल कमज़ोर है (${details.accuracy}m). कृपया खुले आसमान के नीचे जाएँ (${details.maxAllowed}m के अंदर होना चाहिए)।`
      : 'GPS सिग्नल बहुत कमज़ोर है। कृपया खुले स्थान पर जाएँ।',
  CLOCK_MISMATCH: (details) =>
    `फ़ोन का समय सर्वर से नहीं मिल रहा (${details?.driftSec ? Math.round(details.driftSec) + 's' : 'समय का अंतर'}). कृपया अपने फ़ोन की तारीख और समय (IST) ठीक करें।`,
  ALREADY_CHECKED_IN: 'आप आज के लिए पहले ही चेक-इन कर चुके हैं (Already checked in today).',
  NOT_ASSIGNED: 'आप इस काम के लिए असाइन नहीं हैं (You are not assigned to this job).',
  JOB_NOT_ACTIVE: 'यह काम अभी सक्रिय नहीं है (Job is not active).',
  OUTSIDE_JOB_DATES: 'आज की तारीख काम के दिनों में नहीं है (Today is outside job dates).',
  OUTSIDE_WORKING_HOURS: 'काम के समय से बाहर चेक-इन की अनुमति नहीं है (Outside working hours).',
  INVALID_CODE: 'गलत 6-अंकीय हाज़िरी कोड (Invalid attendance code). कृपया ठेकेदार से सही कोड लें।',
  SUSPICIOUS_LOCATION: 'असामान्य लोकेशन बदलाव (Suspicious location jump detected).',
  NOT_CHECKED_IN: 'आपने आज चेक-इन नहीं किया है (Not checked in today).',
  ALREADY_CHECKED_OUT: 'आप पहले ही चेक-आउट कर चुके हैं (Already checked out).',
  SIGNOFF_NOT_PENDING: 'साइन-ऑफ़ पहले ही पूरा हो चुका है (Sign-off already finalized).',
  SELFIE_REQUIRED: 'इस काम के लिए सेल्फ़ी ज़रूरी है (Selfie is required).',
  INVALID_MAGIC_BYTES: 'फ़ोटो का फ़ॉर्मेट सही नहीं है (Only genuine JPEG/PNG allowed).',
  ESCROW_NOT_FUNDED: 'ठेकेदार ने आज के काम का पैसा अभी लॉक नहीं किया है (Escrow not funded).',
  INSUFFICIENT_BALANCE: 'बटुए में पर्याप्त राशि नहीं है (Insufficient balance).',
  INSUFFICIENT_FUNDS: 'बटुए में पर्याप्त राशि नहीं है (Insufficient balance).',
  INVALID_PAYMENT_SIGNATURE: 'भुगतान सत्यापन विफल रहा (Payment verification failed).',
  INVALID_TRANSITION: 'यह स्थिति परिवर्तन मान्य नहीं है (Invalid status transition).',
  DISPUTE_ALREADY_OPEN: 'इस काम के लिए विवाद पहले से खुला है (Dispute already open).',
  INVALID_SPLIT: 'विवाद विभाजन की राशि कुल राशि के बराबर होनी चाहिए (Split sum must equal total).',
  UPI_NOT_CONFIGURED: 'कृपया निकासी के लिए अपनी UPI ID जोड़ें (Please configure your UPI ID).',
  VOICE_UNAVAILABLE: 'आवाज़ सेवा अभी उपलब्ध नहीं है। आप नीचे दिए गए आइकन से अपनी स्किल चुन सकते हैं। (Voice service unavailable, using icon fallback)',
  CONSENT_REQUIRED: 'आवाज़ से प्रोफाइल बनाने के लिए सहमति आवश्यक है। (Consent required)',
  AUDIO_TOO_LARGE: 'ऑडियो फ़ाइल बहुत बड़ी है (अधिकतम 5MB)। (Audio file too large)',
  AUDIO_INVALID: 'ऑडियो फ़ॉर्मेट सही नहीं है। केवल असली WAV/WebM/MP4 ऑडियो स्वीकार है। (Invalid audio format)',
  AUDIO_TOO_LONG: 'ऑडियो 30 सेकंड से अधिक लंबा है। कृपया संक्षेप में बोलें। (Audio too long, max 30s)',
  NO_SPEECH_DETECTED: 'कोई आवाज़ सुनाई नहीं दी। कृपया माइक के पास बोलें या आइकन से चुनें। (No speech detected)',
  STT_FAILED: 'आवाज़ समझने में समस्या हुई। कृपया दोबारा बोलें या आइकन से चुनें। (Voice transcription failed)',
  STT_TIMEOUT: 'आवाज़ सेवा का समय समाप्त हो गया। कृपया दोबारा प्रयास करें। (Speech request timed out)',
  SESSION_NOT_FOUND: 'वॉइस सत्र नहीं मिला। (Session not found)',
  SESSION_ALREADY_CONFIRMED: 'यह वॉइस सत्र पहले ही कन्फ़र्म हो चुका है। (Session already confirmed)',
  TRANSCRIPT_TOO_LONG: 'टेक्स्ट 500 अक्षरों से अधिक लंबा है। (Transcript exceeds 500 characters)',
  INVALID_SKILLS: 'कम से कम 1 और अधिकतम 8 स्किल चुनना अनिवार्य है। (Please select 1 to 8 skills)',
  INVALID_EXPERIENCE_YEARS: 'अनुभव 0 से 50 वर्ष के बीच होना चाहिए। (Experience years must be 0-50)',
  ALREADY_RATED: 'आप पहले ही रेटिंग दे चुके हैं (Already rated).',
  RATING_WINDOW_CLOSED: 'रेटिंग देने का समय समाप्त हो गया है (Rating window closed).',
  RATING_NOT_OPEN: 'रेटिंग अभी शुरू नहीं हुई है। काम पूरा होने पर खुलेगी (Rating window not open yet).',
  NOT_JOB_PARTICIPANT: 'आप इस काम से जुड़े हुए नहीं हैं (Not a participant of this job).',
  NO_CHECKED_OUT_ATTENDANCE: 'रेटिंग तभी दी जा सकती है जब काम हुआ हो और चेक-आउट दर्ज हो।',
  INCIDENT_NOT_FOUND: 'इंसिडेंट रिकॉर्ड नहीं मिला (Incident not found).',
  INCIDENT_CLOSED: 'यह इंसिडेंट पहले ही सुलझाया (resolve) जा चुका है।',
  NOT_ALERTED_USER: 'आपको इस आपातकालीन अलर्ट की अनुमति नहीं है।',
  UNAUTHORIZED: 'लॉगिन सत्र समाप्त हो गया। कृपया दोबारा लॉगिन करें।',
  TOKEN_EXPIRED: 'लॉगिन सत्र समाप्त हो गया। टोकन रीफ़्रेश किया जा रहा है...',
  FORBIDDEN: 'आपको इस कार्रवाई की अनुमति नहीं है।',
  NOT_FOUND: 'रिकॉर्ड नहीं मिला।',
};

// Concurrency queue for in-flight token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor to attach JWT and handle multipart/form-data
api.interceptors.request.use((config) => {
  const inMemoryToken = useAuthStore.getState()?.token;
  const token = inMemoryToken || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Allow browser to calculate multipart boundary automatically when sending FormData
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

// Response interceptor to unwrap envelope, perform seamless token refresh, and enrich errors
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success !== undefined) {
      return response.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized / Token Expired with single in-flight refresh
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/verify-otp') &&
      !originalRequest.url?.includes('/auth/send-otp') &&
      !originalRequest.url?.includes('/auth/dev-login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        axios
          .post(
            `${api.defaults.baseURL}/auth/refresh`,
            {},
            {
              withCredentials: true,
              headers: {
                'X-Requested-With': 'workpulse',
              },
            }
          )
          .then(({ data }) => {
            const payload = data?.data || data;
            const newToken = payload.accessToken || payload.token;
            const newUser = payload.user;

            if (newToken) {
              useAuthStore.getState().setAuth(newUser || useAuthStore.getState().user, newToken);
              api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              processQueue(null, newToken);
              resolve(api(originalRequest));
            } else {
              throw new Error('No access token in refresh response');
            }
          })
          .catch((refreshErr) => {
            processQueue(refreshErr, null);
            useAuthStore.getState().logout();
            reject(refreshErr);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    const errData = error.response?.data?.error;
    const code = errData?.code || 'ERROR';
    const details = errData?.details || null;

    let message = errData?.message || error.message || 'नेटवर्क त्रुटि हुई। कृपया दोबारा प्रयास करें।';

    // Map to friendly message if known code exists
    if (ERROR_MESSAGES[code]) {
      const mapper = ERROR_MESSAGES[code];
      message = typeof mapper === 'function' ? mapper(details) : mapper;
    }

    const enhancedError = new Error(message);
    enhancedError.code = code;
    enhancedError.status = error.response?.status;
    enhancedError.details = details;
    enhancedError.originalMessage = errData?.message;

    return Promise.reject(enhancedError);
  }
);

export default api;
