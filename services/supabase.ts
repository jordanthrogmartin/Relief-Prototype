import { createClient } from '@supabase/supabase-js';

// Using the keys provided in the prototype. 
// In a production environment, these should be environment variables (process.env.REACT_APP_SUPABASE_URL).
const SUPABASE_URL = 'https://rzlzxrrsiroogllvdpuk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bHp4cnJzaXJvb2dsbHZkcHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjczNzcsImV4cCI6MjA4NDk0MzM3N30.D2DwjR3qP-q-jTMXfqpuiNZHTogYT0TDRelBgdwLdvI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);