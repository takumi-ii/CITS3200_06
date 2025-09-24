import { Researcher,CollaborationEdge,ResearchOutcome,pairKey,CollaborationIndex,Grant} from "./mockData";

// Utility: set insert
const inc = (obj: Record<string, CollaborationEdge>, k: string, fn: (e: CollaborationEdge) => void) => {
  const [a, b] = k.split("|");
  obj[k] ??= { aId: a, bId: b, pubCount: 0, grantCount: 0, total: 0 };
  fn(obj[k]);
  obj[k].total = obj[k].pubCount + obj[k].grantCount;
};

export function buildCollaborationIndex(
  researchers: Researcher[],
  outcomes: ResearchOutcome[],          // central list
  grants: Grant[]                       // central list
): CollaborationIndex {
  const byPair: Record<string, CollaborationEdge> = {};

  // 1) Publications: if outcomes have author IDs, use those; otherwise derive via publicationIds on researchers
  // (Mock-friendly) via researchers -> publicationIds
  for (let i = 0; i < researchers.length; i++) {
    for (let j = i + 1; j < researchers.length; j++) {
      const r1 = researchers[i], r2 = researchers[j];
      const pubs1 = new Set(r1.publicationIds || []);
      const sharedPubs = (r2.publicationIds || []).filter(id => pubs1.has(id)).length;
      if (sharedPubs > 0) {
        const k = pairKey(r1.id, r2.id);
        inc(byPair, k, e => { e.pubCount += sharedPubs; });
      }
    }
  }

  // 2) Grants: every pair in a grant’s participants counts once per grant
  for (const g of grants) {
    const ps = g.participantIds || [];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const k = pairKey(ps[i], ps[j]);
        inc(byPair, k, e => { e.grantCount += 1; });
      }
    }
  }

  // 3) Build adjacency and sort by strength
  const byResearcher: Record<string, CollaborationEdge[]> = {};
  for (const k in byPair) {
    const e = byPair[k];
    (byResearcher[e.aId] ||= []).push(e);
    (byResearcher[e.bId] ||= []).push(e);
  }
  for (const rid in byResearcher) {
    byResearcher[rid].sort((a, b) => b.total - a.total || b.pubCount - a.pubCount);
  }

  return { byPair, byResearcher };
}

// Query helpers
export function getTopCollaboratorsFor(researcherId: string, idx: CollaborationIndex, limit = 6) {
  return (idx.byResearcher[researcherId] || [])
    .slice(0, limit)
    .map(e => ({
      collaboratorId: e.aId === researcherId ? e.bId : e.aId,
      pubCount: e.pubCount,
      grantCount: e.grantCount,
      total: e.total
    }));
}
export function getAllCollaboratorsFor(researcherId: string, idx: CollaborationIndex) {
  return getTopCollaboratorsFor(researcherId, idx, Number.MAX_SAFE_INTEGER);
}
export function getCollabCountBetween(aId: string, bId: string, idx: CollaborationIndex) {
  const e = idx.byPair[pairKey(aId, bId)];
  return e ? { pubCount: e.pubCount, grantCount: e.grantCount, total: e.total } : { pubCount: 0, grantCount: 0, total: 0 };
}
