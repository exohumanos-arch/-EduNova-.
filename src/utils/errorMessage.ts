function extractTextFromDetailItem(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const rec = item as Record<string, unknown>;
    if (typeof rec.msg === 'string' && rec.msg.trim()) {
      const loc = Array.isArray(rec.loc)
        ? rec.loc.filter((p) => p !== 'body').join('.')
        : '';
      return loc ? `${loc}: ${rec.msg.trim()}` : rec.msg.trim();
    }
    if (typeof rec.message === 'string' && rec.message.trim()) {
      return rec.message.trim();
    }
    if (typeof rec.detail === 'string' && rec.detail.trim()) {
      return rec.detail.trim();
    }
    if (typeof rec.error === 'string' && rec.error.trim()) {
      return rec.error.trim();
    }
    try {
      const serialized = JSON.stringify(item);
      if (serialized && serialized !== '{}' && serialized !== '[]') {
        return serialized;
      }
    } catch {
      return '';
    }
  }
  return '';
}

function sanitizeStringMessage(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[object Object]') {
    return null;
  }
  if (/^\s*<!doctype\s+html/i.test(trimmed) || /^\s*<html[\s>]/i.test(trimmed)) {
    return 'Received an unexpected response from the server. Please try again.';
  }
  return trimmed;
}

function extractFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return sanitizeStringMessage(payload);
  }
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;

  if (typeof data.message === 'string') {
    const clean = sanitizeStringMessage(data.message);
    if (clean) return clean;
  }

  if (typeof data.detail === 'string') {
    const clean = sanitizeStringMessage(data.detail);
    if (clean) return clean;
  }

  if (Array.isArray(data.detail)) {
    const parts = data.detail.map(extractTextFromDetailItem).filter(Boolean);
    if (parts.length > 0) {
      return parts.join(', ');
    }
  }

  if (data.detail && typeof data.detail === 'object') {
    const nested = extractFromPayload(data.detail) || extractTextFromDetailItem(data.detail);
    if (nested) return nested;
  }

  if (typeof data.error === 'string') {
    const clean = sanitizeStringMessage(data.error);
    if (clean) return clean;
  }

  if (data.error && typeof data.error === 'object') {
    const nested = extractFromPayload(data.error) || extractTextFromDetailItem(data.error);
    if (nested) return nested;
  }

  if (data.message && typeof data.message === 'object') {
    const nested = extractFromPayload(data.message) || extractTextFromDetailItem(data.message);
    if (nested) return nested;
  }

  return null;
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (typeof error === 'string') {
    return sanitizeStringMessage(error) ?? fallback;
  }

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const errObj = error as {
    code?: unknown;
    message?: unknown;
    response?: {
      status?: number;
      data?: unknown;
    };
  };

  // 1. Prefer structured server response body (e.g., Axios error.response.data)
  if (errObj.response && errObj.response.data !== undefined) {
    const extracted = extractFromPayload(errObj.response.data);
    if (extracted) return extracted;
  }

  // 2. Check if the object itself is a FastAPI/API response payload
  const directExtracted = extractFromPayload(errObj);
  if (directExtracted) {
    // Avoid returning raw Axios generic message if a network error code is present
    if (
      errObj.code === 'ERR_NETWORK' ||
      errObj.code === 'ECONNREFUSED' ||
      directExtracted === 'Network Error'
    ) {
      return 'Unable to connect to the server. Please verify the backend is running and try again.';
    }
    if (errObj.code === 'ECONNABORTED') {
      return 'The request timed out. Please try again.';
    }
    return directExtracted;
  }

  // 3. Handle Axios/network error codes without payload
  if (errObj.code === 'ERR_NETWORK' || errObj.code === 'ECONNREFUSED') {
    return 'Unable to connect to the server. Please verify the backend is running and try again.';
  }
  if (errObj.code === 'ECONNABORTED') {
    return 'The request timed out. Please try again.';
  }

  if (typeof errObj.message === 'string') {
    const clean = sanitizeStringMessage(errObj.message);
    if (clean) return clean;
  }

  return fallback;
}
