import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const loggingFetch = async (...args) => {
  const startTime = Date.now();
  const url = args[0];
  const init = args[1] ?? {};
  const urlStr = typeof url === 'string' ? url : (url?.url ?? String(url));
  const shortUrl = urlStr.replace('https://rscregotvkwgfzpxnmwh.supabase.co', '');
  console.log(`[supabase fetch] START ${shortUrl} at ${startTime}`);

  // Build a plain-object copy of incoming headers (Headers instance OR plain object OR array)
  const mergedHeaders = {};
  const incoming = init.headers;
  if (incoming) {
    if (typeof incoming.forEach === 'function') {
      // Headers instance
      incoming.forEach((value, key) => {
        mergedHeaders[key] = value;
      });
    } else if (Array.isArray(incoming)) {
      // Array of [key, value] tuples
      for (const [k, v] of incoming) mergedHeaders[k] = v;
    } else {
      // Plain object
      Object.assign(mergedHeaders, incoming);
    }
  }
  // Force a fresh connection on every request — fixes Android RN dead-connection-pool bug
  mergedHeaders['Connection'] = 'close';

  const newInit = { ...init, headers: mergedHeaders };

  try {
    const response = await fetch(url, newInit);
    const elapsed = Date.now() - startTime;
    console.log(`[supabase fetch] END   ${shortUrl} after ${elapsed} ms (status ${response.status})`);
    return response;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.log(`[supabase fetch] ERR   ${shortUrl} after ${elapsed} ms — ${err.message}`);
    throw err;
  }
};

export const supabase = createClient(
  'https://rscregotvkwgfzpxnmwh.supabase.co',
  'sb_publishable_9dYb0xUBeLoRyEeVODN6ag_Gh7c0XU0',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: loggingFetch,
    },
  }
);
