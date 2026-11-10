// المخزن المحلي الموحد (mk3) مع دعم الترحيل من الإصدارات القديمة (planner_v1 / planner_v2) والربط بالسحابة
import { uid } from './util.js';

export const STORAGE_KEY = 'mk3';
export const KINDS = ['task', 'need', 'event', 'prayer', 'setting', 'report'];

const DEFAULT_MAIN_SETTING = {
  name: '',
  city: 'cairo',
  lat: 30.0444,
  lng: 31.2357,
  adj: 0,
  oath: true,
  adhanOn: true,
  soundOn: true,
  eve: '21:00',
  reportTime: '23:00',
  emailReport: false,
  tz: 'Africa/Cairo',
  theme: 'light'
};

const DEFAULT_BUDGET_SETTING = {
  salary: 0,
  transport: 0,
  days: 22,
  saveOn: false,
  savePct: 30
};

function createEmptyState() {
  const records = {};
  for (const k of KINDS) records[k] = {};
  const now = Date.now();
  records.setting.main = { d: { ...DEFAULT_MAIN_SETTING }, u: now, dirty: 1 };
  records.setting.budget = { d: { ...DEFAULT_BUDGET_SETTING }, u: now, dirty: 1 };
  return {
    v: 3,
    mode: 'local',
    owner: null,
    onboarded: false,
    cursor: null,
    records
  };
}

let memoryStore = null;
const listeners = new Set();
let saveTimer = null;

function getStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // في بيئة Node أو عدم توفر localStorage
  }
  return null;
}

function migrateLegacyIfNeeded(state, storage) {
  if (!storage) return false;
  let migrated = false;
  for (const legacyKey of ['planner_v2', 'planner_v1']) {
    try {
      const rawLegacy = storage.getItem(legacyKey);
      if (!rawLegacy) continue;
      const old = JSON.parse(rawLegacy);
      const now = Date.now();
      if (Array.isArray(old.tasks)) {
        for (const t of old.tasks) {
          const id = t.id || uid('t_');
          state.records.task[id] = {
            d: {
              title: t.title || t.text || 'مهمة',
              date: t.date || new Date().toISOString().slice(0, 10),
              time: t.time || '',
              far: Boolean(t.far),
              status: t.done ? 'done' : (t.status || 'pending')
            },
            u: now,
            dirty: 1
          };
        }
      }
      if (Array.isArray(old.needs)) {
        for (const n of old.needs) {
          const id = n.id || uid('n_');
          state.records.need[id] = {
            d: {
              name: n.name || 'احتياج',
              price: Number(n.price || 0),
              day: Number(n.day || 1),
              paid: Boolean(n.paid)
            },
            u: now,
            dirty: 1
          };
        }
      }
      if (old.name || old.city) {
        state.records.setting.main.d = {
          ...state.records.setting.main.d,
          name: old.name || state.records.setting.main.d.name,
          city: old.city || state.records.setting.main.d.city
        };
      }
      storage.removeItem(legacyKey);
      migrated = true;
    } catch {
      // تجاهل الأخطاء في البيانات القديمة التالفة
    }
  }
  return migrated;
}

export function loadStore() {
  if (memoryStore) return memoryStore;
  const storage = getStorage();
  if (storage) {
    try {
      const rawStr = storage.getItem(STORAGE_KEY);
      if (rawStr) {
        const parsed = JSON.parse(rawStr);
        if (parsed && parsed.records) {
          for (const k of KINDS) {
            if (!parsed.records[k]) parsed.records[k] = {};
          }
          if (!parsed.records.setting.main) {
            parsed.records.setting.main = { d: { ...DEFAULT_MAIN_SETTING }, u: Date.now() };
          } else {
            parsed.records.setting.main.d = { ...DEFAULT_MAIN_SETTING, ...parsed.records.setting.main.d };
          }
          if (!parsed.records.setting.budget) {
            parsed.records.setting.budget = { d: { ...DEFAULT_BUDGET_SETTING }, u: Date.now() };
          } else {
            parsed.records.setting.budget.d = { ...DEFAULT_BUDGET_SETTING, ...parsed.records.setting.budget.d };
          }
          memoryStore = parsed;
          return memoryStore;
        }
      }
    } catch {
      // fallback to empty
    }
  }
  memoryStore = createEmptyState();
  if (migrateLegacyIfNeeded(memoryStore, storage)) {
    flushStore();
  }
  return memoryStore;
}

export function flushStore() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const storage = getStorage();
  if (storage && memoryStore) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
    } catch {
      // مساحة التخزين ممتلئة أو غير متاحة
    }
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flushStore();
  }, 60);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(memoryStore);
    } catch (e) {
      console.error(e);
    }
  }
}

export const store = {
  get state() {
    return loadStore();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  setMeta(fields) {
    const st = loadStore();
    Object.assign(st, fields);
    scheduleSave();
    notify();
  },

  getRecord(kind, id) {
    const st = loadStore();
    const rec = st.records[kind]?.[id];
    if (!rec || rec.x) return null;
    return { id, ...rec.d, _u: rec.u };
  },

  list(kind) {
    const st = loadStore();
    const bucket = st.records[kind] || {};
    const out = [];
    for (const [id, rec] of Object.entries(bucket)) {
      if (rec && !rec.x && rec.d) {
        out.push({ id, ...rec.d, _u: rec.u });
      }
    }
    return out;
  },

  patch(kind, id, fields) {
    if (!KINDS.includes(kind)) throw new Error(`Unknown kind: ${kind}`);
    const st = loadStore();
    const recordId = id || uid(`${kind[0]}_`);
    const existing = st.records[kind][recordId];
    const now = Date.now();
    const prevData = existing && !existing.x ? existing.d : {};
    st.records[kind][recordId] = {
      d: { ...prevData, ...fields },
      u: now,
      dirty: 1
    };
    scheduleSave();
    notify();
    return recordId;
  },

  remove(kind, id) {
    if (!KINDS.includes(kind)) return;
    const st = loadStore();
    const existing = st.records[kind]?.[id];
    if (!existing) return;
    st.records[kind][id] = {
      d: existing.d || {},
      u: Date.now(),
      x: 1,
      dirty: 1
    };
    scheduleSave();
    notify();
  },

  getDirtyRecords() {
    const st = loadStore();
    const out = [];
    for (const kind of KINDS) {
      const bucket = st.records[kind] || {};
      for (const [id, rec] of Object.entries(bucket)) {
        if (rec && rec.dirty) {
          out.push({
            kind,
            id,
            data: rec.d || {},
            deleted: Boolean(rec.x),
            updated_at: new Date(rec.u || Date.now()).toISOString()
          });
        }
      }
    }
    return out;
  },

  markClean(items) {
    const st = loadStore();
    for (const { kind, id, updated_at } of items) {
      const rec = st.records[kind]?.[id];
      if (rec && rec.u <= new Date(updated_at).getTime()) {
        delete rec.dirty;
      }
    }
    scheduleSave();
  },

  applyRemoteRecords(rows, newCursor) {
    const st = loadStore();
    let changed = false;
    for (const row of rows) {
      const { kind, id, data, deleted, updated_at } = row;
      if (!KINDS.includes(kind)) continue;
      const remoteMs = new Date(updated_at).getTime();
      const local = st.records[kind]?.[id];
      const localMs = local?.u || 0;
      if (!local || remoteMs >= localMs) {
        const nextRec = {
          d: data || {},
          u: remoteMs
        };
        if (deleted) nextRec.x = 1;
        st.records[kind][id] = nextRec;
        changed = true;
      }
    }
    if (newCursor) st.cursor = newCursor;
    if (changed || newCursor) {
      scheduleSave();
      notify();
    }
  },

  exportJSON() {
    const st = loadStore();
    return JSON.stringify(st, null, 2);
  },

  importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object' || !parsed.records) {
      throw new Error('ملف النسخة الاحتياطية غير صالح');
    }
    memoryStore = parsed;
    for (const k of KINDS) {
      if (!memoryStore.records[k]) memoryStore.records[k] = {};
    }
    flushStore();
    notify();
  },

  resetAll() {
    memoryStore = createEmptyState();
    flushStore();
    notify();
  }
};
