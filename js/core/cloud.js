// المزامنة السحابية مع Supabase وتسجيل الدخول بحساب جوجل
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config.js';
import { createClient } from '../vendor/supabase.js';
import { store } from './store.js';

let sbClient = null;
let syncing = false;

export function isCloudConfigured() {
  const url = String(SUPABASE_URL || '').trim();
  const key = String(SUPABASE_ANON_KEY || '').trim();
  return Boolean(url && key && url.startsWith('https://'));
}

export function getSupabase() {
  if (!isCloudConfigured()) return null;
  if (!sbClient) {
    sbClient = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
  }
  return sbClient;
}

export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, reason: 'unconfigured' };
  }
  const redirectTo = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function signOutCloud() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  store.setMeta({ mode: 'local', owner: null });
}

export async function checkAuthAndSync() {
  const sb = getSupabase();
  if (!sb) return { synced: false, reason: 'unconfigured' };

  const { data } = await sb.auth.getSession();
  const session = data?.session;
  if (!session?.user) {
    return { synced: false, reason: 'unauthenticated' };
  }

  store.setMeta({
    mode: 'cloud',
    owner: session.user.email || session.user.id,
    onboarded: true
  });

  return syncNow();
}

export async function syncNow() {
  const sb = getSupabase();
  if (!sb) return { synced: false, reason: 'unconfigured' };
  if (syncing) return { synced: false, reason: 'busy' };

  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return { synced: false, reason: 'unauthenticated' };

  syncing = true;
  try {
    // 1) رفع السجلات المعدلة محلياً (dirty)
    const dirty = store.getDirtyRecords();
    if (dirty.length > 0) {
      const payload = dirty.map((r) => ({
        user_id: user.id,
        kind: r.kind,
        id: r.id,
        data: r.data,
        deleted: r.deleted,
        updated_at: r.updated_at
      }));
      const { error: upErr } = await sb.from('records').upsert(payload, {
        onConflict: 'user_id,kind,id'
      });
      if (!upErr) {
        store.markClean(dirty);
      }
    }

    // 2) سحب السجلات الأحدث من cursor
    let query = sb
      .from('records')
      .select('kind,id,data,deleted,updated_at,server_at')
      .order('server_at', { ascending: true })
      .limit(500);

    const cursor = store.state.cursor;
    if (cursor) {
      query = query.gt('server_at', cursor);
    }

    const { data: rows, error: downErr } = await query;
    if (!downErr && Array.isArray(rows) && rows.length > 0) {
      const lastServerAt = rows[rows.length - 1].server_at;
      store.applyRemoteRecords(rows, lastServerAt);
    }

    return { synced: true };
  } catch (err) {
    return { synced: false, reason: err.message };
  } finally {
    syncing = false;
  }
}

export async function sendTestReportEmail(dateStr) {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'إعدادات Supabase غير مضافة في config.js' };
  const { data, error } = await sb.functions.invoke('daily-report', {
    body: { date: dateStr }
  });
  if (error) return { ok: false, message: error.message || 'تعذر إرسال التقرير' };
  return { ok: true, data };
}
