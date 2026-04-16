import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  }
);