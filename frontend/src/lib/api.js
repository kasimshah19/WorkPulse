import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
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
  UNAUTHORIZED: 'लॉगिन सत्र समाप्त हो गया। कृपया दोबारा लॉगिन करें।',
  FORBIDDEN: 'आपको इस कार्रवाई की अनुमति नहीं है।',
  NOT_FOUND: 'रिकॉर्ड नहीं मिला।',
};

// Request interceptor to attach JWT and handle multipart/form-data
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Allow browser to calculate multipart boundary automatically when sending FormData
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

// Response interceptor to unwrap envelope and enrich friendly error messages
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success !== undefined) {
      return response.data;
    }
    return response;
  },
  (error) => {
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
