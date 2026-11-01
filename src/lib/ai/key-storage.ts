export const GEMINI_LOCAL_STORAGE_KEY = 'herbiq.gemini.key';
export const GEMINI_SESSION_STORAGE_KEY = 'herbiq.gemini.key.session';
export const GEMINI_MODEL_STORAGE_KEY = 'herbiq.gemini.model';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
] as const;

let memoryKey = '';

export function getStoredApiKey(options?: {
  localStorage?: Pick<Storage, 'getItem'> | null;
  sessionStorage?: Pick<Storage, 'getItem'> | null;
}): string {
  if (memoryKey) return memoryKey;
  try {
    const sess =
      options?.sessionStorage !== undefined
        ? options.sessionStorage
        : typeof window !== 'undefined'
          ? window.sessionStorage
          : null;
    const fromSession = sess?.getItem(GEMINI_SESSION_STORAGE_KEY)?.trim();
    if (fromSession) return fromSession;
  } catch {
    // Ignore storage read errors
  }
  try {
    const loc =
      options?.localStorage !== undefined
        ? options.localStorage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null;
    const fromLocal = loc?.getItem(GEMINI_LOCAL_STORAGE_KEY)?.trim();
    if (fromLocal) return fromLocal;
  } catch {
    // Ignore storage read errors
  }
  return '';
}

export function isKeyRememberedOnDevice(options?: {
  localStorage?: Pick<Storage, 'getItem'> | null;
}): boolean {
  try {
    const loc =
      options?.localStorage !== undefined
        ? options.localStorage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null;
    return Boolean(loc?.getItem(GEMINI_LOCAL_STORAGE_KEY)?.trim());
  } catch {
    return false;
  }
}

export function saveApiKey(
  rawKey: string,
  rememberOnDevice: boolean = false,
  options?: {
    localStorage?: Pick<Storage, 'setItem' | 'removeItem'> | null;
    sessionStorage?: Pick<Storage, 'setItem' | 'removeItem'> | null;
  }
): void {
  const key = rawKey.trim();
  memoryKey = key;

  const sess =
    options?.sessionStorage !== undefined
      ? options.sessionStorage
      : typeof window !== 'undefined'
        ? window.sessionStorage
        : null;
  const loc =
    options?.localStorage !== undefined
      ? options.localStorage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (!key) {
    removeApiKey({ localStorage: loc, sessionStorage: sess });
    return;
  }

  if (rememberOnDevice) {
    try {
      loc?.setItem(GEMINI_LOCAL_STORAGE_KEY, key);
    } catch {
      // Fallback remains in memoryKey
    }
    try {
      sess?.removeItem(GEMINI_SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  } else {
    try {
      sess?.setItem(GEMINI_SESSION_STORAGE_KEY, key);
    } catch {
      // Fallback remains in memoryKey
    }
    try {
      loc?.removeItem(GEMINI_LOCAL_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function removeApiKey(options?: {
  localStorage?: Pick<Storage, 'removeItem'> | null;
  sessionStorage?: Pick<Storage, 'removeItem'> | null;
}): void {
  memoryKey = '';
  try {
    const sess =
      options?.sessionStorage !== undefined
        ? options.sessionStorage
        : typeof window !== 'undefined'
          ? window.sessionStorage
          : null;
    sess?.removeItem(GEMINI_SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
  try {
    const loc =
      options?.localStorage !== undefined
        ? options.localStorage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null;
    loc?.removeItem(GEMINI_LOCAL_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function getStoredModel(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const m = window.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY)?.trim();
      if (m && /^[a-z0-9.-]+$/.test(m)) return m;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_GEMINI_MODEL;
}

export function saveStoredModel(model: string): void {
  const clean = model.trim();
  if (!/^[a-z0-9.-]+$/.test(clean)) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, clean);
    }
  } catch {
    // Ignore
  }
}
