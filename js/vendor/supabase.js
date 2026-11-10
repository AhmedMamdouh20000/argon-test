/**
 * supabase.js — Lightweight Local Supabase Client (Auth OAuth/JWT + PostgREST + Edge Functions)
 * Works without external CDN dependencies. Compatible with createClient(url, anonKey).
 */
const SESSION_KEY = 'mk3_sb_session';

function parseHashTokens() {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  if (!accessToken) return null;
  const refreshToken = params.get('refresh_token') || '';
  const expiresIn = Number(params.get('expires_in') || 3600);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn
  };
}

function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

class QueryBuilder {
  constructor(baseUrl, headers, table) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.headers = { ...headers };
    this.table = table;
    this.params = new URLSearchParams();
    this.method = 'GET';
    this.body = null;
  }

  select(columns = '*') {
    this.method = 'GET';
    this.params.set('select', columns);
    return this;
  }

  gt(col, val) {
    this.params.set(col, `gt.${val}`);
    return this;
  }

  gte(col, val) {
    this.params.set(col, `gte.${val}`);
    return this;
  }

  eq(col, val) {
    this.params.set(col, `eq.${val}`);
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.params.set('order', `${col}.${ascending ? 'asc' : 'desc'}`);
    return this;
  }

  limit(n) {
    this.params.set('limit', String(n));
    return this;
  }

  upsert(rows, { onConflict } = {}) {
    this.method = 'POST';
    this.body = rows;
    this.headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
    if (onConflict) {
      this.params.set('on_conflict', onConflict);
    }
    return this._execute();
  }

  async _execute() {
    const qs = this.params.toString();
    const url = `${this.baseUrl}/rest/v1/${this.table}${qs ? '?' + qs : ''}`;
    try {
      const res = await fetch(url, {
        method: this.method,
        headers: this.headers,
        body: this.body ? JSON.stringify(this.body) : undefined
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) {
        return { data: null, error: data || { message: res.statusText } };
      }
      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message || 'Network error' } };
    }
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }
}

export function createClient(supabaseUrl, supabaseKey) {
  const cleanUrl = String(supabaseUrl || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  let currentSession = null;

  try {
    const fromHash = parseHashTokens();
    if (fromHash) {
      const payload = decodeJwtPayload(fromHash.access_token);
      currentSession = {
        ...fromHash,
        user: payload ? { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata || {} } : null
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } else if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) currentSession = JSON.parse(saved);
    }
  } catch {
    // ignore storage errors
  }

  function getHeaders() {
    const token = currentSession?.access_token || supabaseKey;
    return {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`
    };
  }

  return {
    auth: {
      async getSession() {
        return { data: { session: currentSession }, error: null };
      },
      async getUser() {
        return { data: { user: currentSession?.user || null }, error: null };
      },
      async signInWithOAuth({ provider = 'google', options = {} } = {}) {
        const redirectTo = options.redirectTo || (typeof window !== 'undefined' ? window.location.origin : '');
        const authUrl = `${cleanUrl}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
        if (typeof window !== 'undefined') {
          window.location.assign(authUrl);
        }
        return { data: { url: authUrl }, error: null };
      },
      async signOut() {
        currentSession = null;
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {}
        return { error: null };
      }
    },
    from(table) {
      return new QueryBuilder(cleanUrl, getHeaders(), table);
    },
    functions: {
      async invoke(fnName, { body = {}, headers = {} } = {}) {
        try {
          const res = await fetch(`${cleanUrl}/functions/v1/${fnName}`, {
            method: 'POST',
            headers: { ...getHeaders(), ...headers },
            body: JSON.stringify(body)
          });
          const text = await res.text();
          let data = text;
          try { data = JSON.parse(text); } catch {}
          if (!res.ok) return { data: null, error: data || { message: res.statusText } };
          return { data, error: null };
        } catch (err) {
          return { data: null, error: { message: err.message } };
        }
      }
    }
  };
}
