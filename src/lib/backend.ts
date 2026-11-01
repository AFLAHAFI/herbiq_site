import { createClient } from '@supabase/supabase-js';
const env = (import.meta as any).env || {};
const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const backendConfigured = Boolean(url && key);
// Separate clients: public catalog requests must never inherit an admin session.
export const backend = backendConfigured ? createClient(url, key, {auth: {persistSession: true, storageKey: 'herbiq-admin-session', autoRefreshToken: true, detectSessionInUrl: false}}) : null;
export const publicBackend = backendConfigured ? createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}}) : null;
export const errorText = (error: unknown) => error instanceof Error ? error.message : (error as any)?.message || 'Request failed. Please try again.';
