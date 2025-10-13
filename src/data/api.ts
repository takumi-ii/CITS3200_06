/**
 * API Data Layer
 * 
 * This module provides a centralized data management layer for the application.
 * It uses a custom store pattern with React's useSyncExternalStore for state management.
 * 
 * Key Features:
 * - Centralized state management for researchers, outcomes, grants, and awards
 * - Lazy loading of profile-specific data (grants/awards)
 * - Type-safe API interactions
 * - Subscribe/notify pattern for reactive updates
 * 
 * @module api
 */

import { useSyncExternalStore } from "react";

/**
 * API prefix for all backend requests.
 * Empty string means requests go through Vite proxy (configured in vite.config.ts)
 * The proxy forwards /api/* to http://127.0.0.1:5000
 */
export const API_PREFIX = "";

/* ============================================================
   TYPE DEFINITIONS
   ============================================================ */

/** Unique identifier type (string-based UUIDs or IDs) */
export type ID = string;

/**
 * Researcher entity
 * Represents a researcher/member of the Oceans Institute
 */
export type Researcher = {
  id: ID;
  name: string;
  expertise?: string[];           // Areas of expertise/research
  publicationsCount?: number;     // Total number of publications
  // Additional fields may be present from API responses
};

/**
 * Expertise Area entity
 * Represents a specific area of research expertise
 */
export type ExpertiseArea = {
  id: ID;
  name: string;
  type: 'expertise';
};

/**
 * Connection between a researcher and their expertise area
 * Used for calculating collaboration strength
 */
export type ResearcherExpertiseConnection = {
  researcher: ID;
  expertise: ID;
  strength: number;               // Numeric strength of connection (0-1)
};

/**
 * Research Outcome entity
 * Represents a publication, paper, or research output
 */
export type Outcome = {
  id: ID;
  title: string;
  year?: number;
  keywords?: string[];
  journal?: string;
  authors?: string[] | Array<{ id?: string; name?: string }>;  // Can be string names or objects
  url?: string;                   // Link to full paper/publication
};

/**
 * Grant entity
 * Represents a research grant/funding
 */
export type Grant = {
  id: ID;
  title: string;
  funder?: string | null;         // Primary funding organization
  startDate?: string | null;
  endDate?: string | null;
  totalFunding?: number | null;   // Total funding amount
  school?: string | null;
  fundingSources?: { name: string; amount?: number | null }[];  // Multiple funding sources
  // Optional relations
  piId?: ID;                      // Principal Investigator ID
  coInvestigatorIds?: ID[];       // Co-investigator IDs
};

/**
 * Award/Prize entity
 * Represents an award or recognition received by a researcher
 */
export type Award = {
  id: ID;
  name: string;
  date?: string;
  recipientId?: ID;
};

/**
 * Prize entity (legacy)
 * Similar to Award but with more detailed date information
 */
export type Prize = {
  uuid: string;
  title: string;
  description?: string | null;
  organization?: string | null;
  recognition?: string | null;    // Degree of recognition (e.g., "International", "National")
  year?: number | null;
  month?: number | null;
  day?: number | null;
};




/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

/**
 * Safely converts any value to an array
 * @param v - Value to convert (may be undefined, null, or already an array)
 * @returns Array (empty if input was not an array)
 */
function toArr<T = any>(v: any): T[] { 
  return Array.isArray(v) ? v : []; 
}

/**
 * Safely parses JSON from a Response
 * Prevents crashes from non-JSON responses
 * @param res - Fetch Response object
 * @returns Parsed JSON object or null if parsing fails
 */
async function safeJson<T = any>(res: Response): Promise<T | null> {
  const text = await res.text();
  try { 
    return JSON.parse(text) as T; 
  } catch { 
    return null; 
  }
}

/* ============================================================
   API FETCH FUNCTIONS
   ============================================================ */

/**
 * Fetches all researchers from the API
 * Normalizes the response to ensure consistent field names
 * @returns Promise resolving to array of researcher objects
 */
async function apiResearchers(): Promise<any[]> {
  const res = await fetch(API_PREFIX + '/api/researchers');
  const j: any = await safeJson(res);
  const arr = toArr(j?.items);
  
  // Normalize fields to ensure consistency across different API versions
  return arr.map((r: any) => ({
    ...r,
    id: r.id ?? r.uuid,                    // Ensure we always have an 'id' field
    expertise: toArr(r.expertise),         // Ensure expertise is always an array
    publicationsCount: Number(r.publications ?? r.publicationsCount ?? 0),
  }));
}

/**
 * Fetches all research outcomes (publications) from the API
 * Normalizes the response to ensure consistent field names
 * @returns Promise resolving to array of outcome objects
 */
async function apiOutcomes(): Promise<any[]> {
  const res = await fetch(API_PREFIX + '/api/researchOutcomes');
  const j: any = await safeJson(res);
  const arr = toArr(j?.items);
  
  // Normalize fields across different API response formats
  return arr.map((o: any) => ({
    ...o,
    id: o.id ?? o.uuid,
    keywords: toArr(o.keywords),
    year: typeof o.year === 'number' ? o.year : (o.year ? Number(o.year) : undefined),
    journal: o.journal ?? o.publisher_name ?? '',
    title: o.title ?? o.name ?? 'Untitled',
    url: o.url ?? o.link_to_paper ?? null,  // Support legacy 'link_to_paper' field
  }));
}

/**
 * Fetches grants for a specific researcher
 * This is loaded on-demand when viewing a researcher's profile
 * @param id - Researcher ID
 * @returns Promise resolving to array of Grant objects
 */
async function apiGrantsForResearcher(id: ID): Promise<Grant[]> {
  const r = await fetch(API_PREFIX + `/api/researchers/${id}/grants`);
  const j = await safeJson<any>(r);
  const items = toArr(j);

  // Normalize grant data with fallbacks for different field names
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

/**
 * Fetches awards/prizes for a specific researcher
 * This is loaded on-demand when viewing a researcher's profile
 * @param id - Researcher ID
 * @returns Promise resolving to array of award objects
 */
async function apiAwardsForResearcher(id: ID) {
  const r = await fetch(API_PREFIX + `/api/researchers/${id}/awards`);
  const j = await safeJson<any>(r);
  
  // Handle both array responses and object responses with nested arrays
  const items = Array.isArray(j) 
    ? j 
    : (Array.isArray(j?.awards) 
      ? j.awards 
      : (Array.isArray(j?.prizes) ? j.prizes : []));
      
  return items.map((a: any) => ({
    id: a.id ?? a.uuid,
    title: a.title ?? 'Untitled',
    description: a.description ?? a.first_description ?? null,
    organization: a.organization ?? a.first_granting_organization_name ?? null,
    recognition: a.recognition ?? a.degree_of_recognition ?? null,
    date: a.date ?? null,
    // Support granular date fields for flexible UI display
    year: typeof a.year === 'number' ? a.year : (a.year ? Number(a.year) : null),
    month: typeof a.month === 'number' ? a.month : (a.month ? Number(a.month) : null),
    day: typeof a.day === 'number' ? a.day : (a.day ? Number(a.day) : null),
  }));
}

/* ============================================================
   CENTRALIZED STATE STORE
   ============================================================ */

/**
 * Store type definition
 * Contains all centrally managed application state
 * 
 * Design Pattern: Publisher-Subscriber
 * - Components subscribe to the store
 * - When state changes, all subscribers are notified
 * - Works with React's useSyncExternalStore for optimal re-renders
 */
type Store = {
  loading: boolean;              // Global loading state
  error: string | null;          // Global error message

  // Master datasets (loaded once at startup)
  allResearchers: Researcher[];  // All researchers (not filtered)
  allOutcomes: Outcome[];        // All research outcomes (not filtered)

  // Lazy-loaded profile data (loaded on-demand per researcher)
  grantsById: Record<ID, Grant>;               // Map of grant ID to Grant object
  awardsById: Record<ID, Award>;               // Map of award ID to Award object
  grantsByResearcher: Record<ID, ID[]>;        // Map of researcher ID to their grant IDs
  awardsByResearcher: Record<ID, ID[]>;        // Map of researcher ID to their award IDs
};

/**
 * Central application state
 * This is a singleton - only one instance exists
 */
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

/**
 * Type definition for listener functions
 * Listeners are called when state changes
 */
type Listener = () => void;

/**
 * Set of registered listener functions
 * Using a Set prevents duplicate registrations
 */
const listeners = new Set<Listener>();

/**
 * Updates the state and notifies all listeners
 * @param patch - Partial state object with fields to update
 */
function setState(patch: Partial<Store>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());  // Notify all subscribers of the change
}

/**
 * Subscribe to state changes
 * Used by React components via useSyncExternalStore
 * @param listener - Function to call when state changes
 * @returns Unsubscribe function
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);  // Return cleanup function
}

/**
 * Gets the current state snapshot
 * Used by React's useSyncExternalStore
 * @returns Current state object
 */
export function getSnapshot(){ return state; }

/* ============================================================
   PUBLIC API - STATE ACTIONS
   ============================================================ */

/**
 * Loads all core data at application startup
 * Fetches researchers and outcomes in parallel for optimal performance
 * 
 * Usage: Call this once in App.tsx useEffect
 * This populates the central store with data that can be filtered client-side
 */
export async function loadAllData() {
  setState({ loading: true, error: null });
  try {
    // Fetch both datasets in parallel for faster initial load
    const [researchers, outcomes] = await Promise.all([
      apiResearchers(), 
      apiOutcomes()
    ]);

    setState({
      loading: false,
      allResearchers: researchers,
      allOutcomes: outcomes,
    });
  } catch (e: any) {
    setState({ loading: false, error: e?.message ?? 'Failed to load data' });
  }
}

/**
 * Preloads grants and awards for a specific researcher
 * This is called when opening a researcher's profile to load their detailed data
 * 
 * Design: Lazy loading pattern - we don't load this data until needed
 * The data is cached in the store so subsequent views are instant
 * 
 * @param researcherId - ID of the researcher whose data to load
 */
export async function preloadProfile(researcherId: ID) {
  const rid = String(researcherId).trim();
  setState({ loading: true, error: null });
  try {
    // Fetch grants and awards in parallel
    const [grants, awards] = await Promise.all([
      apiGrantsForResearcher(rid),
      apiAwardsForResearcher(rid),
    ]);

    // Store grants in normalized format (by ID)
    const grantsById = { ...state.grantsById };
    const gIds: ID[] = [];
    for (const g of grants) {
      const gid = String(g?.id ?? '').trim();
      if (!gid) continue;
      grantsById[gid] = { ...g, id: gid };
      gIds.push(gid);
    }

    // Store awards in normalized format (by ID)
    const awardsById = { ...state.awardsById };
    const aIds: ID[] = [];
    for (const a of awards) {
      const aid = String(a?.id ?? '').trim();
      if (!aid) continue;
      awardsById[aid] = { ...a, id: aid };
      aIds.push(aid);
    }

    // Update store with new data
    setState({
      loading: false,
      grantsById,
      awardsById,
      grantsByResearcher: { ...state.grantsByResearcher, [rid]: gIds },
      awardsByResearcher: { ...state.awardsByResearcher, [rid]: aIds },
    });
  } catch (e: any) {
    setState({ loading: false, error: e?.message ?? 'Failed to load profile' });
  }
}

/* ============================================================
   PUBLIC API - HOOKS & SELECTORS
   ============================================================ */

/**
 * React hook to subscribe to the store
 * Uses React 18's useSyncExternalStore for optimal concurrent rendering
 * 
 * @returns Current store state
 * 
 * @example
 * const { loading, allResearchers } = useStore();
 */
export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Gets all researchers from the store
 * @returns Array of all researchers (unfiltered)
 */
export function getAllResearchers() { 
  return state.allResearchers; 
}

/**
 * Gets all research outcomes from the store
 * @returns Array of all outcomes (unfiltered)
 */
export function getAllOutcomes() { 
  return state.allOutcomes; 
}

/**
 * Gets all grants for a specific researcher
 * Returns empty array if the researcher's grants haven't been loaded yet
 * 
 * @param researcherId - ID of the researcher
 * @returns Array of Grant objects
 */
export function getGrantsFor(researcherId: ID) {
  const ids = state.grantsByResearcher[researcherId] ?? [];
  return ids.map(id => state.grantsById[id]).filter(Boolean);
}

/**
 * Gets all awards for a specific researcher
 * Returns empty array if the researcher's awards haven't been loaded yet
 * 
 * @param researcherId - ID of the researcher
 * @returns Array of Award objects
 */
export function getAwardsFor(researcherId: ID) {
  const ids = state.awardsByResearcher[researcherId] ?? [];
  return ids.map(id => state.awardsById[id]).filter(Boolean);
}

/**
 * Filters outcomes to find those authored by a specific researcher
 * Searches by both researcher ID and name for flexibility
 * 
 * @param r - Researcher object (can have id, uuid, or name)
 * @returns Array of outcomes authored by this researcher
 */
export function getOutcomesForResearcher(r: { id?: ID; uuid?: ID; name?: string }) {
  if (!r) return [];
  const rid = (r.id || r.uuid || '').toString().toLowerCase();
  const rname = (r.name || '').toLowerCase();

  return state.allOutcomes.filter(o => {
    const authors = Array.isArray(o.authors) ? o.authors : [];
    // Authors can be either strings or objects with id/name
    return authors.some((a: any) =>
      typeof a === 'string'
        ? a.toLowerCase() === rname || a.toLowerCase() === rid
        : (a.id && a.id.toLowerCase() === rid) || (a.name && a.name.toLowerCase() === rname)
    );
  });
}

/**
 * Fetches research outputs directly from the API for a specific researcher
 * This is an alternative to getOutcomesForResearcher when you need fresh data
 * 
 * @param id - Researcher ID
 * @returns Promise resolving to array of output objects
 */
export async function fetchOutputsForResearcher(id: string) {
  const r = await fetch(API_PREFIX + `/api/researchers/${id}/outputs`);
  if (!r.ok) throw new Error("Failed to load outputs");
  const raw = await r.json();
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.outputs) ? raw.outputs : []);
  
  // Normalize the output format
  return arr.map((o: any) => ({
    id: o.id ?? o.uuid,
    title: o.title ?? o.name ?? 'Untitled',
    journal: o.journal ?? o.publisher ?? '',
    year: typeof o.year === 'number' ? o.year : (o.year ? Number(o.year) : undefined),
    url: o.url ?? null,
    authors: Array.isArray(o.authors) ? o.authors : [],
    ...o,
  }));
}