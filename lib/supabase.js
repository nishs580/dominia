import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const loggingFetch = (url, options = {}) => {
  const startTime = Date.now();
  const urlStr = typeof url === 'string' ? url : url.toString();
  const shortUrl = urlStr.replace('https://rscregotvkwgfzpxnmwh.supabase.co', '');
  console.log(`[supabase fetch] START ${shortUrl} at ${startTime}`);
  return fetch(url, options)
    .then((response) => {
      const elapsed = Date.now() - startTime;
      console.log(`[supabase fetch] END   ${shortUrl} after ${elapsed} ms (status ${response.status})`);
      return response;
    })
    .catch((err) => {
      const elapsed = Date.now() - startTime;
      console.log(`[supabase fetch] ERR   ${shortUrl} after ${elapsed} ms — ${err.message}`);
      throw err;
    });
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