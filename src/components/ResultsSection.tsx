import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { MapPin, Calendar, BookOpen, Users, Award, ExternalLink, User } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ResultsSectionProps {
  searchQuery: string;
  filters: {
    yearRange: number[];
    tags: string[];
    researchArea: string;
  };
}

type Member = {
  uuid: string;
  name: string;
  email?: string;
  education?: string;
  bio?: string;
  phone?: string;
  expertise?: string[];
  score?: number;
};

type ResearchOutput = {
  uuid: string;
  researcher_uuid: string;
  publisher_name?: string;
  name: string;
  score?: number;
};

// Mock data for researchers
const mockResearchers = [
  {
    id: 1,
    name: 'Dr. Sarah Chen',
    title: 'Marine Biologist',
    department: 'School of Biological Sciences',
    expertise: ['Coral Reef Ecology', 'Climate Change', 'Marine Conservation'],
    publications: 42,
    grants: 8,
    collaborations: 15,
    location: 'Perth, Australia',
    bio: 'Leading researcher in coral reef resilience and adaptation strategies.',
    recentPublications: [
      { title: 'Coral Adaptation to Ocean Acidification', year: 2024, journal: 'Nature Climate Change' },
      { title: 'Marine Protected Area Effectiveness', year: 2023, journal: 'Conservation Biology' }
    ]
  },
  {
    id: 2,
    name: 'Prof. Michael Rodriguez',
    title: 'Oceanographer',
    department: 'Oceans Institute',
    expertise: ['Deep Sea Research', 'Ocean Circulation', 'Marine Geology'],
    publications: 67,
    grants: 12,
    collaborations: 23,
    location: 'Perth, Australia',
    bio: 'Expert in deep ocean processes and their impact on global climate systems.',
    recentPublications: [
      { title: 'Deep Ocean Carbon Sequestration', year: 2024, journal: 'Science' },
      { title: 'Antarctic Current Dynamics', year: 2023, journal: 'Journal of Physical Oceanography' }
    ]
  },
  {
    id: 3,
    name: 'Dr. Emma Thompson',
    title: 'Marine Chemist',
    department: 'School of Molecular Sciences',
    expertise: ['Ocean Acidification', 'Marine Pollution', 'Biogeochemistry'],
    publications: 34,
    grants: 6,
    collaborations: 18,
    location: 'Perth, Australia',
    bio: 'Specialist in marine chemical processes and pollution impact assessment.',
    recentPublications: [
      { title: 'Microplastic Distribution in Australian Waters', year: 2024, journal: 'Environmental Science & Technology' },
      { title: 'Ocean pH Monitoring Systems', year: 2023, journal: 'Marine Chemistry' }
    ]
  }
];

// Mock data for research outcomes
const mockResearchOutcomes = [
  {
    id: 1,
    title: 'Climate Resilience in Indo-Pacific Coral Reefs',
    type: 'Research Article',
    authors: ['Dr. Sarah Chen', 'Prof. Michael Rodriguez', 'Dr. James Wilson'],
    journal: 'Nature Climate Change',
    year: 2024,
    citations: 23,
    abstract: 'This study examines the adaptive capacity of coral reefs in the Indo-Pacific region under climate change scenarios.',
    keywords: ['Climate Change', 'Coral Reefs', 'Adaptation', 'Indo-Pacific'],
    grantFunding: 'ARC Discovery Grant DP240102345'
  },
  {
    id: 2,
    title: 'Deep Ocean Carbon Storage Mechanisms',
    type: 'Research Article',
    authors: ['Prof. Michael Rodriguez', 'Dr. Lisa Park', 'Dr. Robert Kim'],
    journal: 'Science',
    year: 2024,
    citations: 45,
    abstract: 'Investigation of deep ocean processes that contribute to long-term carbon sequestration.',
    keywords: ['Carbon Sequestration', 'Deep Sea', 'Climate', 'Oceanography'],
    grantFunding: 'NHMRC Grant GNT2009876'
  },
  {
    id: 3,
    title: 'Microplastic Impact on Marine Food Webs',
    type: 'Review Article',
    authors: ['Dr. Emma Thompson', 'Dr. Sarah Chen', 'Prof. David Brown'],
    journal: 'Environmental Science & Technology',
    year: 2023,
    citations: 67,
    abstract: 'Comprehensive review of microplastic distribution and impact on marine ecosystems.',
    keywords: ['Microplastics', 'Marine Pollution', 'Food Webs', 'Ecosystem Health'],
    grantFunding: 'Cooperative Research Centre Grant'
  }
];

export default function ResultsSection({ searchQuery, filters }: ResultsSectionProps) {
  const resultsTopRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('researchers');
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 6; // how many results per page (researchers/outcomes)

  // Live data states
  const [researchers, setResearchers] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch strategy:
  // - If there's a query, use /api/search
  // - Otherwise, load default lists (/api/researchers and /api/researchOutcomes)
  //   and fall back to mocks if empty/unavailable.
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      const q = (searchQuery || '').trim();
      try {
        setLoading(true);
        if (q) {
          const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
            signal: controller.signal,
          });
          if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
          const data = await resp.json();
          setResearchers(Array.isArray(data.members) ? data.members : []);
          setOutcomes(Array.isArray(data.research_outputs) ? data.research_outputs : []);
        } else {
          const [rRes, oRes, oiRes] = await Promise.all([
            fetch('/api/researchers', { signal: controller.signal }),
            fetch('/api/researchOutcomes', { signal: controller.signal }),
            fetch('/api/oiresearchoutputs', { signal: controller.signal }),
          ]);
          let rJson: any = null;
          let oJson: any = null;
          let oiJson: any = null;
          try { rJson = await rRes.json(); } catch {}
          try { oJson = await oRes.json(); } catch {}
          try { oiJson = await oiRes.json(); } catch {}
          const rData = rJson ? (Array.isArray(rJson) ? rJson : (rJson.researchers ?? [])) : [];
          const oDataPrimary = oJson ? (Array.isArray(oJson) ? oJson : (oJson.outcomes ?? [])) : [];
          const oDataFallback = oiJson ? (Array.isArray(oiJson) ? oiJson : (oiJson.research_outputs ?? [])) : [];
          setResearchers(Array.isArray(rData) ? rData : []);
          if (Array.isArray(oDataPrimary) && oDataPrimary.length) {
            setOutcomes(oDataPrimary);
          } else {
            // Map OI fallback shape to the expected outcome shape
            const mapped = Array.isArray(oDataFallback) ? oDataFallback.map((o: any) => ({
              id: o.uuid || o.id,
              uuid: o.uuid || o.id,
              researcher_uuid: o.researcher_uuid,
              title: o.name || o.title,
              name: o.name || o.title,
              journal: o.publisher_name,
              authors: [],
            })) : [];
            setOutcomes(mapped);
          }
        }
      } catch {
        // On error: if searching, show empty; otherwise fallback happens below
        if ((searchQuery || '').trim()) {
          setResearchers([]);
          setOutcomes([]);
        } else {
          setResearchers([]);
          setOutcomes([]);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [searchQuery]);

  // Choose live data if available; otherwise use mocks (only when no active search)
  const sourceResearchers = researchers.length ? researchers : ((searchQuery || '').trim() ? [] : mockResearchers);
  const sourceOutcomes = outcomes.length ? outcomes : ((searchQuery || '').trim() ? [] : mockResearchOutcomes);

  // Build quick lookup to resolve author names from researcher UUIDs when backend doesn't provide authors
  const researcherIdToName = new Map<string, string>();
  (sourceResearchers || []).forEach((r: any) => {
    const id = String(r.uuid || r.id || '').trim();
    const nm = String(r.name || '').trim();
    if (id && nm) researcherIdToName.set(id, nm);
  });

  // Authors lookup is declared after filteredOutcomes below

  const q = (searchQuery || '').toLowerCase();
  const isActiveSearch = (searchQuery || '').trim().length > 0;
  const areaFilter = (filters.researchArea || '').trim().toLowerCase();

  const filteredResearchers = sourceResearchers
    .filter((researcher: any) => {
      // If a search is active, the backend has already applied query relevance.
      // Avoid re-filtering here which could hide legitimate results (e.g., multi-term queries).
      const matchesQuery = isActiveSearch ||
        !q ||
        (researcher.name || '').toLowerCase().includes(q) ||
        ((researcher.expertise || []).some((exp: string) => (exp || '').toLowerCase().includes(q)));

      const matchesTags = (filters.tags?.length ?? 0) === 0 ||
        filters.tags.some(tag =>
          (researcher.expertise || []).some((exp: string) =>
            (exp || '').toLowerCase().includes((tag || '').toLowerCase())
          )
        );

      const matchesArea = !areaFilter || [
        researcher.title,
        researcher.department,
        ...(Array.isArray(researcher.expertise) ? researcher.expertise : []),
      ].some((v: string) => (v || '').toLowerCase().includes(areaFilter));

      return matchesQuery && matchesTags && matchesArea;
    })
    .sort((a: any, b: any) => {
      if (isActiveSearch) {
        const sa = Number(a.score ?? 0);
        const sb = Number(b.score ?? 0);
        if (sb !== sa) return sb - sa; // higher score first
        const pa = Number(a.publications ?? 0);
        const pb = Number(b.publications ?? 0);
        if (pb !== pa) return pb - pa; // then by publications
        const na = String(a.name || '').toLowerCase();
        const nb = String(b.name || '').toLowerCase();
        return na.localeCompare(nb); // stable tie-breaker by name
      }
      // Default (no active search): sort by publications desc
      return Number(b.publications ?? 0) - Number(a.publications ?? 0);
    });

  const filteredOutcomes = sourceOutcomes.filter((outcome: any) => {
    const title = (outcome.title || outcome.name || '') as string;
    const keywords: string[] = Array.isArray(outcome.keywords) ? outcome.keywords : [];
    const journal = (outcome.journal || outcome.publisher_name || '') as string;

    const matchesQuery = isActiveSearch ||
      !q ||
      title.toLowerCase().includes(q) ||
      journal.toLowerCase().includes(q) ||
      keywords.some((k: string) => (k || '').toLowerCase().includes(q));

    const matchesTags = (filters.tags?.length ?? 0) === 0 ||
      filters.tags.some(tag => {
        const tl = (tag || '').toLowerCase();
        return keywords.some(k => (k || '').toLowerCase().includes(tl)) ||
               title.toLowerCase().includes(tl) ||
               journal.toLowerCase().includes(tl);
      });

    const yRaw = (outcome.year as number | string | undefined);
    const year = typeof yRaw === 'number' ? yRaw : (yRaw ? Number(yRaw) : null);
    // Include unknown years so search results from /api/search aren't dropped
    const matchesYear = year === null
      ? true
      : year >= filters.yearRange[0] && year <= filters.yearRange[1];

    const matchesArea = !areaFilter ||
      keywords.some(k => (k || '').toLowerCase().includes(areaFilter)) ||
      title.toLowerCase().includes(areaFilter) ||
      journal.toLowerCase().includes(areaFilter) ||
      (Array.isArray(outcome.authors) && outcome.authors.some((a: string) => (a || '').toLowerCase().includes(areaFilter)));

    return matchesQuery && matchesTags && matchesYear && matchesArea;
  }).sort((a: any, b: any) => {
    if (isActiveSearch) {
      const sa = Number(a.score ?? 0);
      const sb = Number(b.score ?? 0);
      if (sb !== sa) return sb - sa; // higher score first
      const ya = typeof a.year === 'number' ? a.year : (a.year ? Number(a.year) : -Infinity);
      const yb = typeof b.year === 'number' ? b.year : (b.year ? Number(b.year) : -Infinity);
      if (yb !== ya) return yb - ya; // then by year desc if available
      const ta = String(a.name || a.title || '').toLowerCase();
      const tb = String(b.name || b.title || '').toLowerCase();
      return ta.localeCompare(tb);
    }
    // Default (no active search): by year desc then title
    const ya = typeof a.year === 'number' ? a.year : (a.year ? Number(a.year) : -Infinity);
    const yb = typeof b.year === 'number' ? b.year : (b.year ? Number(b.year) : -Infinity);
    if (yb !== ya) return yb - ya;
    const ta = String(a.name || a.title || '').toLowerCase();
    const tb = String(b.name || b.title || '').toLowerCase();
    return ta.localeCompare(tb);
  });

  const totalPagesResearchers = Math.max(1, Math.ceil(filteredResearchers.length / PER_PAGE));
  const totalPagesOutcomes  = Math.max(1, Math.ceil(filteredOutcomes.length / PER_PAGE));
  const activeTotalPages = activeTab === 'researchers' ? totalPagesResearchers : totalPagesOutcomes;

  const HEADER_OFFSET = 300;
  const scrollToResultsTop = () => {
    const el = resultsTopRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const startIndex = (currentPage - 1) * PER_PAGE;
  const endIndex = startIndex + PER_PAGE;
  const paginatedOutcomes = filteredOutcomes.slice(startIndex, endIndex);
  const paginatedResearchers  = filteredResearchers.slice(startIndex, endIndex);

  // Fetch author names for visible outcomes using the new backend helper
  const [authorsById, setAuthorsById] = useState<Record<string, string[]>>({});
  const [pubsByAuthor, setPubsByAuthor] = useState<Record<string, any[]>>({});
  const [pubsByResearcherId, setPubsByResearcherId] = useState<Record<string, any[]>>({});
  const [photoByAuthor, setPhotoByAuthor] = useState<Record<string, string>>({});
  const [allResearchersMap, setAllResearchersMap] = useState<Record<string, string>>({});
  const lastIdsKeyRef = useRef<string>('');
  useEffect(() => {
    // Only fetch for visible page, dedupe IDs, and debounce slightly
    const ids = Array.from(new Set(
      paginatedOutcomes.map((o: any) => String(o.uuid || o.id || '')).filter(Boolean)
    )).slice(0, 50);
    const titles = Array.from(new Set(
      paginatedOutcomes.map((o: any) => String(o.title || o.name || '')).filter(Boolean)
    )).slice(0, 50);
    const key = `${ids.join(',')}|${titles.join('|')}`;
    if ((!ids.length && !titles.length) || key === lastIdsKeyRef.current) return;
    lastIdsKeyRef.current = key;
    const controller = new AbortController();
    const t = setTimeout(() => {
      (async () => {
        try {
          let map: Record<string, string[]> = {};
          if (ids.length) {
            const resp = await fetch(`/api/ro-authors?ids=${encodeURIComponent(ids.join(','))}` , { signal: controller.signal });
            const json = await resp.json();
            map = json.authors_by_id || {};
          }
          // Also fetch by title when available
          if (titles.length) {
            const titleKey = titles.join('|');
            const r2 = await fetch(`/api/ro-authors-by-title?titles=${encodeURIComponent(titleKey)}`, { signal: controller.signal });
            const j2 = await r2.json();
            const byTitle: Record<string, string[]> = j2.authors_by_title || {};
            // Map back by matching titles from current page to their uuids
            const idByTitle: Record<string, string> = {};
            paginatedOutcomes.forEach((o: any) => {
              const t = String(o.title || o.name || '');
              const id = String(o.uuid || o.id || '');
              if (t && id) idByTitle[t] = id;
            });
            Object.entries(byTitle).forEach(([title, authors]) => {
              const id = idByTitle[title];
              if (id && authors && authors.length) {
                map[id] = authors as string[];
              }
            });
          }
          setAuthorsById((prev) => ({ ...prev, ...(map || {}) }));
        } catch {}
      })();
    }, 200);
    return () => { controller.abort(); clearTimeout(t); };
  }, [paginatedOutcomes]);

  // Load a global uuid->name map once to improve author fallback on outcomes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/researchers');
        const j = await r.json();
        const arr: any[] = Array.isArray(j) ? j : (j.researchers || []);
        const map: Record<string, string> = {};
        for (const it of arr) {
          const id = String(it.uuid || it.id || '').trim();
          const nm = String(it.name || '').trim();
          if (id && nm) map[id] = nm;
        }
        if (!cancelled) setAllResearchersMap(map);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Prefetch recent publications for visible researchers by author name (fuzzy)
  const lastAuthorKeyRef = useRef<string>('');
  useEffect(() => {
    const names: string[] = Array.from(new Set(
      paginatedResearchers.map((r: any) => String(r.name || '').trim()).filter((s: string) => Boolean(s))
    ));
    const key = names.join('|');
    if (!names.length || key === lastAuthorKeyRef.current) return;
    lastAuthorKeyRef.current = key;
    const controller = new AbortController();
    (async () => {
      try {
        const results: Record<string, any[]> = {};
        // Limit to first 20 names to control load
        for (const nm of names.slice(0, 20) as string[]) {
          const resp = await fetch(`/api/ro-by-author?name=${encodeURIComponent(nm)}`, { signal: controller.signal });
          const json = await resp.json();
          if (Array.isArray(json.publications) && json.publications.length) {
            results[nm] = json.publications;
          }
        }
        setPubsByAuthor((prev) => ({ ...prev, ...results }));
      } catch {}
    })();
    return () => controller.abort();
  }, [paginatedResearchers]);

  // Prefetch recent outputs by researcher UUID for visible researcher cards (fallback)
  useEffect(() => {
    const ids: string[] = Array.from(new Set(
      paginatedResearchers.map((r: any) => String(r.uuid || r.id || '')).filter(Boolean)
    ));
    if (!ids.length) return;
    const controller = new AbortController();
    (async () => {
      try {
        const results: Record<string, any[]> = {};
        for (const id of ids.slice(0, 20)) {
          if (pubsByResearcherId[id]) continue;
          const resp = await fetch(`/api/oiresearchoutputs?researcher_uuid=${encodeURIComponent(id)}`, { signal: controller.signal });
          const json = await resp.json();
          const list: any[] = Array.isArray(json) ? json : (json.research_outputs || []);
          if (list && list.length) {
            results[id] = list.slice(0, 3).map((o: any) => ({
              title: o.title || o.name,
              year: typeof o.year === 'number' ? o.year : (o.year ? Number(o.year) : undefined),
              journal: o.journal || o.publisher_name || '',
            }));
          }
        }
        if (Object.keys(results).length) {
          setPubsByResearcherId((prev) => ({ ...prev, ...results }));
        }
      } catch {}
    })();
    return () => controller.abort();
  }, [paginatedResearchers]);

  // Fetch portrait photos for visible researchers
  const lastPhotoKeyRef = useRef<string>('');
  useEffect(() => {
    const names: string[] = Array.from(new Set(
      paginatedResearchers.map((r: any) => String(r.name || '').trim()).filter(Boolean)
    ));
    const key = names.join('|');
    if (!names.length || key === lastPhotoKeyRef.current) return;
    lastPhotoKeyRef.current = key;
    const controller = new AbortController();
    (async () => {
      try {
        const result: Record<string, string> = {};
        for (const nm of names.slice(0, 20)) {
          const resp = await fetch(`/api/profile-photo?name=${encodeURIComponent(nm)}`, { signal: controller.signal });
          const json = await resp.json();
          if (json.photo_url) result[nm] = json.photo_url;
        }
        if (Object.keys(result).length) {
          setPhotoByAuthor((prev) => ({ ...prev, ...result }));
        }
      } catch {}
    })();
    return () => controller.abort();
  }, [paginatedResearchers]);

  // Reset pagination on filter/tab/query changes so users always see the first page
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, activeTab, searchQuery]);

  return (
    <div className="flex-1">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Search Results
        </h3>
        <p className="text-gray-600">
          {loading ? 'Searching…' : `Found ${filteredResearchers.length} researchers and ${filteredOutcomes.length} research outcomes`}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="researchers" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Researchers ({filteredResearchers.length})
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Research Outcomes ({filteredOutcomes.length})
          </TabsTrigger>
        </TabsList>

        <div ref={resultsTopRef} />

        <TabsContent value="researchers" className="space-y-6">
          {paginatedResearchers.map((researcher: any) => (
            <Card key={researcher.uuid || researcher.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-blue-50 flex items-center justify-center">
                    {(function(){
                      const nm = String(researcher.name || '').trim();
                      const src = photoByAuthor[nm];
                      if (src) {
                        return (
                          <ImageWithFallback
                            src={src}
                            alt={`${researcher.name} portrait`}
                            className="w-16 h-16 object-cover"
                          />
                        );
                      }
                      return <User className="w-8 h-8 text-blue-600" />;
                    })()}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-lg font-semibold text-blue-900">{researcher.name}</h4>
                        {researcher.title && (
                          <p className="text-gray-600">{researcher.title}</p>
                        )}
                        {researcher.department && (
                          <p className="text-sm text-gray-500">{researcher.department}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        {(function(){
                          const nm = String(researcher.name || '').trim().toLowerCase();
                          const slug = nm
                            .replace(/[^a-z0-9\s-]/g, '')
                            .replace(/\s+/g, '-')
                            .replace(/-+/g, '-');
                          const href = slug
                            ? `https://research-repository.uwa.edu.au/en/persons/${slug}`
                            : `https://research-repository.uwa.edu.au/`;
                          return (
                            <a href={href} target="_blank" rel="noreferrer noopener">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View Profile
                            </a>
                          );
                        })()}
                      </Button>
                    </div>

                    {researcher.bio && (
                      <p className="text-gray-700 mb-3">{researcher.bio}</p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-3">
                      {(researcher.expertise || []).map((exp: string) => (
                        <Badge key={exp} variant="secondary" className="bg-blue-100 text-blue-800">
                          {exp}
                        </Badge>
                      ))}
                    </div>

                    {!!(Number(researcher.publications || 0) || Number(researcher.grants || 0) || Number(researcher.collaborations || 0)) && (
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                        {researcher.publications && (
                          <div className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {researcher.publications} Publications
                          </div>
                        )}
                        {researcher.grants && (
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4" />
                            {researcher.grants} Grants
                          </div>
                        )}
                        {researcher.collaborations && (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {researcher.collaborations} Collaborations
                          </div>
                        )}
                      </div>
                    )}

                    {(function(){
                      const explicitRaw = Array.isArray(researcher.recentPublications) ? researcher.recentPublications : [];
                      const isPlaceholder = (p: any) => {
                        const t = String((p && p.title) || '').toLowerCase();
                        const j = String((p && p.journal) || '').toLowerCase();
                        return t.includes('test publication') || j.includes('test journal');
                      };
                      const explicit = explicitRaw.filter((p: any) => !isPlaceholder(p));

                      const researcherId = String(researcher.uuid || researcher.id || '');
                      const derivedByUuid = sourceOutcomes
                        .filter((o: any) => !!researcherId && String(o.researcher_uuid || '') === researcherId)
                        .map((o: any) => ({
                          title: o.title || o.name,
                          year: typeof o.year === 'number' ? o.year : (o.year ? Number(o.year) : undefined),
                          journal: o.journal || o.publisher_name || '',
                        }));

                      const derivedByAuthor = derivedByUuid.length ? [] : sourceOutcomes
                        .filter((o: any) => {
                          const authorList: string[] = Array.isArray(o.authors) ? o.authors : (o.author_name ? [o.author_name] : []);
                          return authorList.some((a: string) => (a || '').toLowerCase() === String(researcher.name || '').toLowerCase());
                        })
                        .map((o: any) => ({
                          title: o.title || o.name,
                          year: typeof o.year === 'number' ? o.year : (o.year ? Number(o.year) : undefined),
                          journal: o.journal || o.publisher_name || '',
                        }));

                      let derived = (derivedByUuid.length ? derivedByUuid : derivedByAuthor)
                        .filter((p: any) => !isPlaceholder(p));
                      if (!derived.length && String(researcherId || '').trim()) {
                        const fromId = pubsByResearcherId[researcherId] || [];
                        if (fromId.length) {
                          derived = fromId;
                        }
                      }
                      if (!derived.length && String(researcher.name || '').trim()) {
                        const nm = String(researcher.name);
                        const fromCache = pubsByAuthor[nm] || [];
                        if (fromCache.length) {
                          derived = fromCache.map((p: any) => ({
                            title: p.title,
                            year: p.year,
                            journal: p.journal,
                          }));
                        }
                      }
                      derived = derived.slice(0, 2);

                      const items = explicit.length ? explicit : derived;
                      if (!items.length) return null; // do not fall back to placeholders
                      return (
                      <div className="border-t pt-3">
                        <h5 className="font-medium text-gray-800 mb-2">Recent Publications</h5>
                        {items.map((pub: any, idx: number) => (
                          <div key={idx} className="text-sm text-gray-600 mb-1">
                            <a
                              className="font-medium text-blue-700 hover:underline"
                              href={`https://scholar.google.com/scholar?q=${encodeURIComponent(`${pub.title} ${researcher.name}`)}`}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              {pub.title}
                            </a> {pub.year && `(${pub.year})`} {pub.journal && `- ${pub.journal}`}
                          </div>
                        ))}
                      </div>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="outcomes" className="space-y-6">
          {paginatedOutcomes.map((outcome: any) => (
            <Card key={outcome.uuid || outcome.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-blue-900 mb-1">{outcome.name || outcome.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      {outcome.type && <span>{outcome.type}</span>}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {outcome.year || '—'}
                      </span>
                      {outcome.citations && <span>{outcome.citations} citations</span>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://scholar.google.com/scholar?q=${encodeURIComponent(String(outcome.name || outcome.title || ''))}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View Paper
                    </a>
                  </Button>
                </div>

                {outcome.abstract && (
                  <p className="text-gray-700 mb-3">{outcome.abstract}</p>
                )}

                {(function(){
                  const id = String(outcome.uuid || outcome.id || '');
                  const list = (Array.isArray(outcome.authors) && outcome.authors.length ? outcome.authors : [])
                    .concat(authorsById[id] || [])
                    .concat(outcome.researcher_uuid && (researcherIdToName.get(outcome.researcher_uuid) || allResearchersMap[outcome.researcher_uuid]) ? [(researcherIdToName.get(outcome.researcher_uuid) as string) || allResearchersMap[outcome.researcher_uuid]] : []);
                  const unique = Array.from(new Set(list.filter(Boolean)));
                  if (!unique.length) return null;
                  return (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-700">Authors: </span>
                      <span className="text-sm text-gray-600">{unique.join(', ')}</span>
                    </div>
                  );
                })()}

                {outcome.journal && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Journal: </span>
                    <span className="text-sm text-gray-600">{outcome.journal}</span>
                  </div>
                )}

                {outcome.grantFunding && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Funding: </span>
                    <span className="text-sm text-gray-600">{outcome.grantFunding}</span>
                  </div>
                )}

                {Array.isArray(outcome.keywords) && (
                  <div className="flex flex-wrap gap-2">
                    {outcome.keywords.map((keyword: string) => (
                      <Badge key={keyword} variant="outline" className="text-blue-700 border-blue-200">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex items-center justify-center gap-4">
        <Button
          variant="outline"
          onClick={() => {
            setCurrentPage((p) => Math.max(1, p - 1));
            scrollToResultsTop();
          }}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          ‹
        </Button>

        <span className="text-sm">
          Page {currentPage} of {activeTotalPages}
        </span>

        <Button
          variant="outline"
          onClick={() => {
            setCurrentPage((p) => Math.min(activeTotalPages, p + 1));
            scrollToResultsTop();
          }}
          disabled={currentPage >= activeTotalPages}
          aria-label="Next page"
        >
          ›
        </Button>
      </div>
    </div>
  );
}