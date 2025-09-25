// src/data/api.ts
import { useSyncExternalStore } from "react";

/* ============ Types (trim as needed) ============ */
export type ID = string;

export type Researcher = {
  id: ID;
  name: string;
  expertise?: string[];
  publicationsCount?: number;
  // ...
};

export type Outcome = {
  id: ID;
  title: string;
  year?: number;
  keywords?: string[];
  journal?: string;
  // ...
};

export type Grant = {
  id: ID;
  title: string;
  funder?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalFunding?: number | null;
  school?: string | null;
  fundingSources?: { name: string; amount?: number | null }[];
  // relations (optional)
  piId?: ID;
  coInvestigatorIds?: ID[];
};

export type Award = {
  id: ID;
  name: string;
  date?: string;
  recipientId?: ID;
};


function toArr<T = any>(v: any): T[] { return Array.isArray(v) ? v : []; }

async function safeJson<T = any>(res: Response): Promise<T | null> {
  const text = await res.text();
  try { return JSON.parse(text) as T; } catch { console.warn('Non-JSON:', text.slice(0, 180)); return null; }
}

// --- Researchers (load-all) -----------------------------------------------
async function apiResearchers(): Promise<any[]> {
  const res = await fetch('/api/researchers');
  const j: any = await safeJson(res);
  const arr = toArr(j?.researchers);
  // Normalize: ensure id exists, map publications -> publicationsCount
  return arr.map((r: any) => ({
    ...r,
    id: r.id ?? r.uuid,                // endpoint already sets id, but keep fallback
    expertise: toArr(r.expertise),
    publicationsCount: Number(r.publications ?? r.publicationsCount ?? 0),
  }));
}

// --- Outcomes (load-all) ---------------------------------------------------
async function apiOutcomes(): Promise<any[]> {
  const res = await fetch('/api/researchOutcomes');
  const j: any = await safeJson(res);
  const arr = toArr(j?.outcomes);
  // Normalize: ensure id exists, coerce year
  return arr.map((o: any) => ({
    ...o,
    id: o.id ?? o.uuid,
    keywords: toArr(o.keywords),
    year: typeof o.year === 'number' ? o.year : (o.year ? Number(o.year) : undefined),
    journal: o.journal ?? o.publisher_name ?? '',
    title: o.title ?? o.name ?? 'Untitled',
  }));
}
async function apiGrantsForResearcher(id: ID): Promise<Grant[]> {
  const r = await fetch(`/api/researchers/${id}/grants`);
  const j = await safeJson<any>(r);
  const items = toArr(j); // endpoint returns an array

  return items.map((g: any): Grant => ({
    id: g.id ?? g.uuid,
    title: g.title ?? g.grant_name ?? 'Untitled',
    funder: g.funder ?? g.top_funding_source_name ?? null,
    startDate: g.start_date ?? null,
    endDate: g.end_date ?? null,
    totalFunding: typeof g.total_funding === 'number'
      ? g.total_funding
      : (g.total_funding ? Number(g.total_funding) : null),
    school: g.school ?? null,
    fundingSources: toArr(g.funding_sources).map((fs: any) => ({
      name: fs.name ?? fs.funding_source_name ?? '',
      amount: typeof fs.amount === 'number'
        ? fs.amount
        : (fs.amount ? Number(fs.amount) : null),
    })),
  }));
}

async function apiAwardsForResearcher(id: ID) {
  const r = await fetch(`/api/researchers/${id}/awards`);
  const j = await safeJson<any>(r);
  return arr<Award>(j) || arr<Award>(j?.awards);
}

/* ============ Store ============ */
type Store = {
  loading: boolean;
  error: string | null;

  // master datasets (no filtering here)
  allResearchers: Researcher[];
  allOutcomes: Outcome[];

  // entity maps for profile/etc.
  grantsById: Record<ID, Grant>;
  awardsById: Record<ID, Award>;
  grantsByResearcher: Record<ID, ID[]>; // researcherId -> grantIds
  awardsByResearcher: Record<ID, ID[]>; // researcherId -> awardIds
};

let state: Store = {
  loading: false,
  error: null,

  allResearchers: [],
  allOutcomes: [],

  grantsById: {},
  awardsById: {},
  grantsByResearcher: {},
  awardsByResearcher: {},
};

type Listener = () => void;
const listeners = new Set<Listener>();
function emit(){ listeners.forEach(l=>l()); }
function setState(patch: Partial<Store>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l()); // notify
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}


export function getSnapshot(){ return state; }

/* ============ Public actions (no filtering) ============ */
export async function loadAllData() {
  setState({ loading: true, error: null });
  try {
    const [researchers, outcomes] = await Promise.all([apiResearchers(), apiOutcomes()]);

    setState({
      loading: false,
      allResearchers: researchers,
      allOutcomes: outcomes,
    });

    console.log('api.ts: loaded', researchers.length, 'researchers,', outcomes.length, 'outcomes');
    console.log(researchers[0]);
  } catch (e: any) {
    setState({ loading: false, error: e?.message ?? 'Failed to load data' });
  }
}

// keep the rest of your file as-is

export async function preloadProfile(researcherId: ID) {
  const rid = String(researcherId).trim();
  setState({ loading: true, error: null });
  try {
    const grants = await apiGrantsForResearcher(rid); // <-- only grants

    const grantsById = { ...state.grantsById };
    const gIds: ID[] = [];
    for (const g of grants) {
      const gid = String(g?.id ?? '').trim();
      if (!gid) continue;
      grantsById[gid] = { ...g, id: gid };
      gIds.push(gid);
    }

    setState({
      loading: false,
      grantsById,
      grantsByResearcher: { ...state.grantsByResearcher, [rid]: gIds },
      // leave awards maps untouched
    });
  } catch (e: any) {
    setState({ loading: false, error: e?.message ?? 'Failed to load grants' });
  }
}

/* ============ Hooks & selectors (read-only) ============ */
export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Simple getters for components that want raw data to filter locally:
export function getAllResearchers() { return state.allResearchers; }
export function getAllOutcomes() { return state.allOutcomes; }

export function getGrantsFor(researcherId: ID) {
  const ids = state.grantsByResearcher[researcherId] ?? [];
  const grants = ids.map(id => state.grantsById[id]).filter(Boolean);

  console.log("[getGrantsFor]", {
    researcherId,
    ids,
    grantsCount: grants.length,
    grants,
    stateSnapshot: {
      grantsByResearcher: state.grantsByResearcher[researcherId],
      grantsByIdKeys: Object.keys(state.grantsById),
    }
  });

  return grants;
}

export function getAwardsFor(researcherId: ID) {
  const ids = state.awardsByResearcher[researcherId] ?? [];
  return ids.map(id => state.awardsById[id]).filter(Boolean);
}

export function getOutcomesForResearcher(r: { id?: ID; uuid?: ID; name?: string }) {
  if (!r) return [];
  const rid = (r.id || r.uuid || '').toString().toLowerCase();
  const rname = (r.name || '').toLowerCase();

  return state.allOutcomes.filter(o => {
    const authors = Array.isArray(o.authors) ? o.authors : [];
    return authors.some((a: any) =>
      typeof a === 'string'
        ? a.toLowerCase() === rname || a.toLowerCase() === rid
        : (a.id && a.id.toLowerCase() === rid) || (a.name && a.name.toLowerCase() === rname)
    );
  });
}
