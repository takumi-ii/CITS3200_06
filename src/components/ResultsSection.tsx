import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MapPin, Calendar, BookOpen, Users, Award, ExternalLink, User, Book, ArrowUpDown } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import ProfileAvatar from './ProfileAvatar';
import { mockResearchers,mockResearchOutcomes } from '../data/mockData';
import { getAllOutcomes,getAllResearchers,subscribe} from '../data/api';
import PageNavigation from './ui/PageNavigation';
import SafeHtmlRenderer from './SafeHtmlRenderer';



interface ResultsSectionProps {
  searchQuery: string;
  filters: {
    yearRange: number[];
    tags: string[];
    researchArea: string;
  };
   // NEW: allow parent to control the Profile modal
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedResearcher: React.Dispatch<React.SetStateAction<any>>; // or your Researcher type
  dataSource:'api' | 'mock'; 
}

export default function ResultsSection({ searchQuery, filters, setProfileOpen, setSelectedResearcher ,dataSource}: ResultsSectionProps) {

  const resultsTopRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useLocalStorageState<'researchers'|'outcomes'>('results.activeTab', 'researchers');
const [currentPage, setCurrentPage] = useLocalStorageState<number>('results.page', 1);
const [researcherSortBy, setResearcherSortBy] = useLocalStorageState<'default'|'recent-publications'|'position-rank'>('results.researcherSortBy', 'default');
const [outcomeSortBy, setOutcomeSortBy] = useLocalStorageState<'recent'|'cited'|'alphabetical'|'journal'|'oldest'>('results.outcomeSortBy', 'recent');

  const PER_PAGE = 6; // how many results per page (researchers/outcomes)

  const didMount = useRef(false);
  // only reset after the first render
useEffect(() => {
  if (didMount.current) {
    setCurrentPage(1);
  } else {
    didMount.current = true;
  }
}, [researcherSortBy, outcomeSortBy]);

// Also reset page to 1 when the search query or tag filters change (after initial mount)
useEffect(() => {
  if (didMount.current) {
    setCurrentPage(1);
  }
}, [searchQuery, filters.tags]);

  // Live data from central store (no fetching here)
const [researchers, setResearchers] = useState<any[]>(getAllResearchers());
const [outcomes, setOutcomes] = useState<any[]>(getAllOutcomes());

// 🔎 Debug counts
console.log(
  "ResultsSection initial store snapshot:",
  "researchers:", researchers.length,
  "outcomes:", outcomes.length
);


const handleStoreChange = React.useCallback(() => {
  const r = getAllResearchers();
  const o = getAllOutcomes();
  console.log('ResultsSection store updated:', r.length, o.length);
  setResearchers(r);
  setOutcomes(o);
}, []);

useEffect(() => {
  const unsub = subscribe(handleStoreChange);
  return () => unsub();
}, [handleStoreChange]);
  // Choose live data if available; otherwise use mocks (only when no active search)
const q = (searchQuery || '').toLowerCase();
const [rItems, setRItems] = useState<any[]>([]);
const [rTotal, setRTotal] = useState(0);
const [oItems, setOItems] = useState<any[]>([]);
const [oTotal, setOTotal] = useState(0);


// Sorting functions
const sortResearchers = (researchers: any[], sortOption: string) => {
  switch (sortOption) {
    case 'recent-publications':
      return [...researchers].sort((a, b) => {
        // Sort by most recent publication year
        const aRecentYear = Math.max(...(a.recentPublications || []).map((p: any) => p.year || 0), 0);
        const bRecentYear = Math.max(...(b.recentPublications || []).map((p: any) => p.year || 0), 0);
        
        // If both have no publications or same year, sort by publication count
        if (aRecentYear === bRecentYear) {
          return (b.publicationsCount || 0) - (a.publicationsCount || 0);
        }
        
        return bRecentYear - aRecentYear;
      });
    
    case 'position-rank':
      return [...researchers].sort((a, b) => {
        // Complete position hierarchy based on comprehensive dataset analysis
        const positionRank: { [key: string]: number } = {
          // Leadership positions (Rank 10-6)
          'Director': 10,
          'Deputy Director': 9,
          'Chief Executive Officer': 9,
          'Head of Department': 8,
          'Centre Manager': 7,
          'Manager': 7,
          'Manager - School & Research Initiatives (Oceans Graduate School)': 7,
          'Program Coordinator': 6,
          
          // Academic positions (Rank 8-3)
          'Winthrop Professor': 8,
          'Professor': 7,
          'Professorial Fellow': 7,
          'Emeritus Professor': 6,
          'Associate Professor': 6,
          'Senior Lecturer': 5,
          'Lecturer': 4,
          'Adjunct Senior Lecturer': 3,
          
          // Research positions (Rank 5-2)
          'Senior Research Fellow': 5,
          'Senior Research Engineer': 5,
          'Senior Research Officer': 4,
          'Senior Research Officer (Field)': 4,
          'Research Fellow': 4,
          'Research Fellow - Floating Offshore Wind': 4,
          'Research Associate': 3,
          'Research Officer': 3,
          'Scientific Officer': 3,
          'Research Assistant': 2,
          
          // Fellowships (Rank 5-4)
          'Premier\'s Science Fellow': 5,
          'DECRA Fellow': 4,
          
          // Adjunct positions (Rank 2)
          'Adjunct Professor': 2,
          'Adjunct Associate Professor': 2,
          'Adjunct Senior Research Fellow': 2,
          'Adjunct Research Fellow': 2,
          
          // Honorary positions (Rank 3-2)
          'Senior Honorary Fellow': 3,
          'Senior Honorary Research Fellow': 3,
          'Honorary Research Fellow': 2,
          'Honorary Research Associate': 2,
          'Honorary Fellow': 2,
          
          // Administrative/Technical positions (Rank 2-1)
          'Administrative Officer': 2,
          'Electronics Engineer': 2,
          'Field Assistant': 1,
          'Technician (Soils Lab)': 1,
          
          // Other positions (Rank 2-0)
          'Casual Teaching': 2,
          'Contractor / Visitor': 1,
          'Contractor/Visitor': 1,
          'External Collaborator': 0,
        };
        
        const aRank = positionRank[a.role] || 0;
        const bRank = positionRank[b.role] || 0;
        
        // If same rank, sort by publication count
        if (aRank === bRank) {
          return (b.publicationsCount || 0) - (a.publicationsCount || 0);
        }
        
        return bRank - aRank;
      });
    
    case 'default':
    default:
      // Default: Professors and Current staff first, then by publication count
      return [...researchers].sort((a, b) => {
        // Check if role indicates current staff vs adjunct/honorary
        const isCurrentStaff = (role: string) => {
          if (!role) return false;
          const lowerRole = role.toLowerCase();
          return !lowerRole.includes('adjunct') && !lowerRole.includes('honorary') && !lowerRole.includes('emeritus');
        };
        
        const aIsCurrent = isCurrentStaff(a.role);
        const bIsCurrent = isCurrentStaff(b.role);
        
        // Current staff first
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;
        
        // Then by publication count
        return (b.publicationsCount || 0) - (a.publicationsCount || 0);
      });
  }
};

// Researchers are now fetched from an API endpoint. The client drives q/tags/sort/page.
// Results are stored in rItems and rTotal (server-side pagination + promote/exclude handled server-side).
useEffect(() => {
  // If using local/mock data source, just populate from the mock set
  if (dataSource !== 'api') {
    const mockFiltered = mockResearchers || [];
    setRItems(mockFiltered);
    setRTotal(mockFiltered.length);
    return;
  }

  const ac = new AbortController();
  const params = new URLSearchParams({
    q: searchQuery || "",
    tags: (filters.tags || []).join(","),
    sort: researcherSortBy,
    page: String(currentPage),
    per_page: String(PER_PAGE),
    promote_first: "true",
    exclude_no_show: "true",
  });

  fetch(`/api/researchers?${params.toString()}`, { signal: ac.signal })
    .then(r => {
      if (!r.ok) throw new Error('Network response was not ok');
      return r.json();
    })
    .then(({ items, total }) => {
      setRItems(items || []);
      setRTotal(total || 0);
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      // swallow other errors but log for debugging
      console.error('Failed to fetch researchers', err);
    });

  return () => ac.abort();
}, [searchQuery, filters.tags, filters.yearRange, researcherSortBy, currentPage, dataSource]);

// Use server-provided items as the filtered/paginated researchers list
const filteredResearchers = rItems;

  const sourceOutcomes = (outcomes && outcomes.length) ? outcomes : mockResearchOutcomes;

  // If using API, fetch outcomes for the list view (server handles filtering/pagination)
  useEffect(() => {
    if (dataSource !== 'api') {
      const fallback = sourceOutcomes || [];
      setOItems(fallback);
      setOTotal(fallback.length);
      return;
    }

    const ac = new AbortController();
   const params = new URLSearchParams({
  q: searchQuery || "",
  tags: (filters.tags || []).join(","),
  page: String(currentPage),
  per_page: String(PER_PAGE),
  year_min: String(filters.yearRange[0]),
  year_max: String(filters.yearRange[1]),
  sort: outcomeSortBy,
});

    fetch(`/api/researchOutcomes?${params.toString()}`, { signal: ac.signal })
      .then(r => {
        if (!r.ok) throw new Error('Network response was not ok');
        return r.json();
      })
      .then(({ items, total }) => {
        setOItems(items || []);
        setOTotal(total || 0);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to fetch outcomes', err);
      });

    return () => ac.abort();
 }, [searchQuery, filters.tags, filters.yearRange, currentPage, dataSource, outcomeSortBy]);

  const filteredOutcomes = sourceOutcomes.filter((outcome: any) => {
    const title = (outcome.title || outcome.name || '') as string;
    const keywords: string[] = Array.isArray(outcome.keywords) ? outcome.keywords : [];
    const journal = (outcome.journal || outcome.publisher_name || '') as string;

    const matchesQuery = !q ||
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

    return matchesQuery && matchesTags && matchesYear;
  });

  const startIndex = (currentPage - 1) * PER_PAGE;
  const endIndex = startIndex + PER_PAGE;
  
  // Sort research outcomes when not using API
  const sortOutcomes = (outcomes: any[], sortOption: 'recent'|'cited'|'alphabetical'|'journal'|'oldest') => {
    return [...outcomes].sort((a, b) => {
      switch (sortOption) {
        case 'recent':
          // Most recent first (null years last)
          const aYear = a.year || 0;
          const bYear = b.year || 0;
          if (aYear === 0 && bYear === 0) return 0;
          if (aYear === 0) return 1;
          if (bYear === 0) return -1;
          return bYear - aYear;
          
        case 'cited':
          // Most cited first
          const aCitations = a.citations || 0;
          const bCitations = b.citations || 0;
          if (aCitations !== bCitations) return bCitations - aCitations;
          // Tiebreaker: most recent
          return (b.year || 0) - (a.year || 0);
          
        case 'alphabetical':
          // Alphabetical by title
          const aTitle = (a.title || a.name || '').toLowerCase();
          const bTitle = (b.title || b.name || '').toLowerCase();
          return aTitle.localeCompare(bTitle);
          
        case 'journal':
          // By journal name, then by title
          const aJournal = (a.journal || '').toLowerCase();
          const bJournal = (b.journal || '').toLowerCase();
          if (aJournal !== bJournal) return aJournal.localeCompare(bJournal);
          const aTitle2 = (a.title || a.name || '').toLowerCase();
          const bTitle2 = (b.title || b.name || '').toLowerCase();
          return aTitle2.localeCompare(bTitle2);
          
        case 'oldest':
          // Oldest first (null years last)
          const aYearOld = a.year || 0;
          const bYearOld = b.year || 0;
          if (aYearOld === 0 && bYearOld === 0) return 0;
          if (aYearOld === 0) return 1;
          if (bYearOld === 0) return -1;
          return aYearOld - bYearOld;
          
        default:
          return 0;
      }
    });
  };
  
  const sortedOutcomes = dataSource === 'api' ? oItems : sortOutcomes(filteredOutcomes, outcomeSortBy);

  const totalPagesResearchers = Math.max(1, Math.ceil(rTotal / PER_PAGE));
  const totalPagesOutcomes  = Math.max(1, Math.ceil((dataSource === 'api' ? oTotal : sortedOutcomes.length) / PER_PAGE));
  const activeTotalPages = activeTab === 'researchers' ? totalPagesResearchers : totalPagesOutcomes;

  const HEADER_OFFSET = 300;
  const scrollToResultsTop = () => {
    const el = resultsTopRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const paginatedOutcomes = dataSource === 'api' ? oItems : sortedOutcomes.slice(startIndex, endIndex);
  // rItems is already server-paginated for the requested page when dataSource==='api'
  const paginatedResearchers  = rItems;

  return (
    <div className="flex-1 min-w-0">

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
         <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 rounded-xl p-1">
         <TabsTrigger value="researchers" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
      <Users className="w-4 h-4" />
      Researchers ({dataSource === 'api' ? rTotal : filteredResearchers.length})
    </TabsTrigger>
    <TabsTrigger value="outcomes" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
      <BookOpen className="w-4 h-4" />
      Research Outcomes ({dataSource === 'api' ? oTotal : sortedOutcomes.length})
    </TabsTrigger>



          
        </TabsList>
 <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-medium text-gray-500">
            Search Results
          </h3>
        </div>
       <p className="text-gray-600">
  <p className="text-gray-600">
  Found {dataSource === 'api' ? rTotal : filteredResearchers.length} researchers and {dataSource === 'api' ? oTotal : sortedOutcomes.length} research outcomes
</p>

</p>

      </div>
        <div ref={resultsTopRef} />

        <TabsContent value="researchers" className="space-y-6">
          {/* Researcher Sorting Dropdown */}
          <div className="flex justify-end items-center gap-2 mb-4">
            {/* MOBILE: round icon-only button */}
            <div className="md:hidden">
              <Select value={researcherSortBy} onValueChange={setResearcherSortBy}>
                <SelectTrigger
                  aria-label="Sort Researchers"
                  className="
                    h-10 w-10 p-0 rounded-full
                    flex items-center justify-center
                    border border-gray-300 bg-white
                    hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-300
                    transition
                    [&>span]:sr-only
                    [&>svg:last-child]:hidden
                  "
                >
                  <ArrowUpDown className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>

                <SelectContent className="border border-gray-200 shadow-md">
                  <SelectItem value="default" className="hover:bg-gray-50 focus:bg-gray-50">
                    Default (Current Staff First)
                  </SelectItem>
                  <SelectItem value="recent-publications" className="hover:bg-gray-50 focus:bg-gray-50">
                    Recent Publications
                  </SelectItem>
                  <SelectItem value="position-rank" className="hover:bg-gray-50 focus:bg-gray-50">
                    Position Rank
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* DESKTOP: standard text dropdown */}
            <div className="hidden md:flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-600" />
              <Select value={researcherSortBy} onValueChange={setResearcherSortBy}>
                <SelectTrigger className="w-56 border border-gray-300 hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 rounded-md text-sm bg-white transition">
                  <SelectValue placeholder="Sort researchers..." />
                </SelectTrigger>

                <SelectContent className="border border-gray-200 shadow-md">
                  <SelectItem value="default" className="hover:bg-gray-50 focus:bg-gray-50">
                    Default (Current Staff First)
                  </SelectItem>
                  <SelectItem value="recent-publications" className="hover:bg-gray-50 focus:bg-gray-50">
                    Recent Publications
                  </SelectItem>
                  <SelectItem value="position-rank" className="hover:bg-gray-50 focus:bg-gray-50">
                    Position Rank
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {paginatedResearchers.map((researcher: any) => (
            <Card key={researcher.uuid || researcher.id} className="card-cohesive">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <ProfileAvatar 
                    photoUrl={researcher.photoUrl}
                    name={researcher.name}
                    size="lg"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-lg font-semibold text-blue-900">{researcher.name}</h4>
                        {researcher.title && (
                          <p className="text-gray-600">{researcher.title}</p>
                        )}
                       {researcher.role && (
  <p className="text-gray-600 font-bold">{researcher.role}</p>
)}
                        {researcher.department && (
                          <p className="text-sm text-gray-500">{researcher.department}</p>
                        )}
                      </div>
<Button
  size="sm"
  onClick={() => {
    console.log('[ResultsSection] selecting', researcher);
    setSelectedResearcher(researcher);
    setProfileOpen(true);
  }}
  className="
    border border-gray-300          /* light grey border */
    bg-white text-[#003087]         /* white background, UWA blue text */
    hover:bg-blue-50                /* subtle light blue hover */
    hover:border-[#003087]          /* accent the border on hover */
    btn-cohesive
    inline-flex items-center
  "
>
  <ExternalLink className="w-4 h-4 mr-1 text-[#003087]" />
  View Profile
</Button>




                    </div>

                    {researcher.bio && (
  <div className="mb-3">
    <SafeHtmlRenderer 
      content={researcher.bio}
      className="text-gray-700 bioClamp3"
    />
    <button
      className="mt-1 text-sm  text-gray-400 hover:underline"
      onClick={() => {
        setSelectedResearcher(researcher);
        setProfileOpen(true);
      }}
    >
      Read more
    </button>
  </div>
)}

<div className="flex flex-wrap gap-2 mb-3">
  {/* 🔹 First show fingerprint concepts (if any) */}
  {(researcher.fingerprints || [])
    .filter((fp: any) => fp.conceptName && fp.conceptName.length <= 50)
    .sort((a: any, b: any) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .map((fp: any) => (
      <Badge
        key={`fp-${fp.conceptId}`}
        variant="secondary"
        className="bg-blue-100 text-blue-800"
        title={`Rank: ${fp.rank ?? '-'}, Score: ${fp.score?.toFixed?.(3) ?? '-'}`}
      >
        {fp.conceptName}
      </Badge>
    ))}

  {/* 🔹 Also include existing expertise tags (useful during transition) */}
  {(researcher.expertise || [])
    .filter((exp: string) => exp && exp.length <= 50)
    .map((exp: string) => (
      <Badge
        key={`exp-${exp}`}
        variant="secondary"
        className="bg-blue-100 text-blue-800"
      >
        {exp}
      </Badge>
    ))}
</div>



                    <div className="grid grid-cols-3 gap-2 md:gap-4 text-[11px] md:text-sm text-gray-600 mb-3">
  <div className="flex items-center gap-[3px] md:gap-1.5 whitespace-nowrap">
    <BookOpen className="w-3 h-3 md:w-4 md:h-4" />
    <span className="tabular-nums">{typeof researcher.publicationsCount === 'number' ? researcher.publicationsCount : 0}</span>
    <span>Publications</span>
  </div>

  <div className="flex items-center gap-[3px] md:gap-1.5 whitespace-nowrap">
    <Award className="w-3 h-3 md:w-4 md:h-4" />
    <span className="tabular-nums">{typeof researcher.grantsCount === 'number' ? researcher.grantsCount : 0}</span>
    <span>Grants</span>
  </div>

  <div className="flex items-center gap-[3px] md:gap-1.5 whitespace-nowrap">
    <Users className="w-3 h-3 md:w-4 md:h-4" />
    <span className="tabular-nums">{typeof researcher.collaboratorsCount === 'number' ? researcher.collaboratorsCount : 0}</span>
    <span>Collaborations</span>
  </div>
</div>


                    {Array.isArray(researcher.recentPublications) && researcher.recentPublications.length > 0 && (
                      <div className="border-t pt-3">
                        <h5 className="font-medium text-gray-800 mb-2">Recent Publications</h5>
                        {researcher.recentPublications.slice(0, 2).map((pub: any, idx: number) => (
                          <div key={idx} className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">{pub.title}</span> {pub.year && `(${pub.year})`} {pub.journal && `- ${pub.journal}`}
                          </div>
                        ))}
                        {researcher.recentPublications.length > 2 && (
                          <button
                            className="mt-1 text-sm text-gray-500 hover:underline"
                            onClick={() => {
                              // open profile modal to show full publication list
                              setSelectedResearcher(researcher);
                              setProfileOpen(true);
                            }}
                          >
                            and {researcher.recentPublications.length - 2} more
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="outcomes" className="space-y-6">
          {/* Research Outcomes Sorting Dropdown */}
          <div className="flex justify-end items-center gap-2 mb-4">
            {/* MOBILE: round icon-only button */}
            <div className="md:hidden">
              <Select value={outcomeSortBy} onValueChange={setOutcomeSortBy}>
                <SelectTrigger
                  aria-label="Sort Research Outcomes"
                  className="
                    h-10 w-10 p-0 rounded-full
                    flex items-center justify-center
                    border border-gray-300 bg-white
                    hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-300
                    transition
                    [&>span]:sr-only
                    [&>svg:last-child]:hidden
                  "
                >
                  <ArrowUpDown className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>

                <SelectContent className="border border-gray-200 shadow-md">
                  <SelectItem value="recent" className="hover:bg-gray-50 focus:bg-gray-50">
                    Most Recent
                  </SelectItem>
                  <SelectItem value="cited" className="hover:bg-gray-50 focus:bg-gray-50">
                    Most Cited
                  </SelectItem>
                  <SelectItem value="alphabetical" className="hover:bg-gray-50 focus:bg-gray-50">
                    Alphabetical
                  </SelectItem>
                  <SelectItem value="journal" className="hover:bg-gray-50 focus:bg-gray-50">
                    Journal Name
                  </SelectItem>
                  <SelectItem value="oldest" className="hover:bg-gray-50 focus:bg-gray-50">
                    Oldest First
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* DESKTOP: standard text dropdown */}
            <div className="hidden md:flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-600" />
              <Select value={outcomeSortBy} onValueChange={setOutcomeSortBy}>
                <SelectTrigger className="w-56 border border-gray-300 hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 rounded-md text-sm bg-white transition">
                  <SelectValue placeholder="Sort research outcomes..." />
                </SelectTrigger>

                <SelectContent className="border border-gray-200 shadow-md">
                  <SelectItem value="recent" className="hover:bg-gray-50 focus:bg-gray-50">
                    Most Recent
                  </SelectItem>
                  <SelectItem value="cited" className="hover:bg-gray-50 focus:bg-gray-50">
                    Most Cited
                  </SelectItem>
                  <SelectItem value="alphabetical" className="hover:bg-gray-50 focus:bg-gray-50">
                    Alphabetical
                  </SelectItem>
                  <SelectItem value="journal" className="hover:bg-gray-50 focus:bg-gray-50">
                    Journal Name
                  </SelectItem>
                  <SelectItem value="oldest" className="hover:bg-gray-50 focus:bg-gray-50">
                    Oldest First
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {paginatedOutcomes.map((outcome: any) => (
            <Card key={outcome.uuid || outcome.id} className="card-cohesive">
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
                  {outcome.link_to_paper && (
                    <a
  href={outcome.link_to_paper}
  target="_blank"
  rel="noreferrer"
  className="
    inline-flex items-center gap-1.5
    border border-gray-300
    bg-white text-black
    px-3 py-1.5 rounded-md
    text-sm font-medium
    hover:bg-gray-100
    transition
  "
  style={{ textDecoration: "none" }}
>
  <Book className="w-4 h-4 mr-1 text-black" />
  View Paper
</a>

                  )}
                </div>

                {outcome.abstract && (
                  <SafeHtmlRenderer 
                    content={outcome.abstract}
                    className="text-gray-700 mb-3"
                  />
                )}

                {Array.isArray(outcome.authors) && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Authors: </span>
                    <span className="text-sm text-gray-600">{outcome.authors.join(', ')}</span>
                  </div>
                )}

                {outcome.journal && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Journal: </span>
                    <span className="text-sm text-gray-600">{outcome.journal}</span>
                  </div>
                )}

                {outcome.grantFunding && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Funding: </span>
                    <SafeHtmlRenderer 
                      content={outcome.grantFunding}
                      className="text-sm text-gray-600"
                    />
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
        <PageNavigation
  currentPage={currentPage}
  totalPages={activeTotalPages}
  onPageChange={(page) => setCurrentPage(page)}
  scrollToResultsTop={scrollToResultsTop}
/>
      </div>
    </div>
  );
}