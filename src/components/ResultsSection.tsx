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
const [sortBy, setSortBy] = useLocalStorageState<'default'|'recent-publications'|'position-rank'>('results.sortBy', 'default');

  const PER_PAGE = 6; // how many results per page (researchers/outcomes)

  const didMount = useRef(false);
  // only reset after the first render
useEffect(() => {
  if (didMount.current) {
    setCurrentPage(1);
  } else {
    didMount.current = true;
  }
}, [sortBy]);

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

// base arrays: real store data or mocks, depending on dataSource
const sourceResearchers = dataSource === 'mock' ? mockResearchers : researchers;
const sourceOutcomes    = dataSource === 'mock' ? mockResearchOutcomes : outcomes;

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

// --- Filter, group (promote/no_show), and sort ---
const visibleResearchers = sourceResearchers.filter((researcher: any) => {
  const labels: string[] = Array.isArray(researcher.labels) ? researcher.labels : [];

  // 🔹 Drop any researcher with the no_show label or explicit flag
  if (researcher.noShow === true || labels.includes("no_show")) return false;

  const matchesQuery =
    !q ||
    (researcher.name || "").toLowerCase().includes(q) ||
    (researcher.expertise || []).some((exp: string) =>
      (exp || "").toLowerCase().includes(q)
    );

  const matchesTags =
    (filters.tags?.length ?? 0) === 0 ||
    filters.tags.some((tag) =>
      (researcher.expertise || []).some((exp: string) =>
        (exp || "").toLowerCase().includes((tag || "").toLowerCase())
      )
    );

  return matchesQuery && matchesTags;
});

// 🔹 Split promoted vs non-promoted
const promoted = visibleResearchers.filter((r) => {
  const labels: string[] = Array.isArray(r.labels) ? r.labels : [];
  return labels.includes("promote") || r.primaryLabel === "promote";
});

const nonPromoted = visibleResearchers.filter((r) => {
  const labels: string[] = Array.isArray(r.labels) ? r.labels : [];
  return !labels.includes("promote") && r.primaryLabel !== "promote";
});

// 🔹 Sort each subset using your existing sort logic
const sortedPromoted = sortResearchers(promoted, sortBy);
const sortedNonPromoted = sortResearchers(nonPromoted, sortBy);

// 🔹 Combine promoted first
const filteredResearchers = [...sortedPromoted, ...sortedNonPromoted];

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


  

  return (
    <div className="flex-1 min-w-0">
     

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 rounded-xl p-1">
     <TabsTrigger value="researchers" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
  <Users className="w-4 h-4" />
  Researchers ({filteredResearchers.length})
</TabsTrigger>
<TabsTrigger value="outcomes" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
  <BookOpen className="w-4 h-4" />
  Research Outcomes ({filteredOutcomes.length})
</TabsTrigger>



          
        </TabsList>
 <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-medium text-gray-500">
            Search Results
          </h3>
          <div className="flex items-center gap-2">
 

{/* MOBILE: round icon-only button */}
<div className="md:hidden">
  <Select value={sortBy} onValueChange={setSortBy}>
    <SelectTrigger
      aria-label="Sort"
      className="
        h-10 w-10 p-0 rounded-full
        flex items-center justify-center
        border border-gray-300 bg-white
        hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-300
        transition
        /* hide SelectValue text + default chevron only on this trigger */
        [&>span]:sr-only                 /* the SelectValue span */
        [&>svg:last-child]:hidden        /* Radix chevron is appended last */
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
  <Select value={sortBy} onValueChange={setSortBy}>
    <SelectTrigger className="w-56 border border-gray-300 hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 rounded-md text-sm bg-white transition">
      <SelectValue placeholder="Sort options..." />
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

        </div>
       <p className="text-gray-600">
  <p className="text-gray-600">
  Found {filteredResearchers.length} researchers and {filteredOutcomes.length} research outcomes
</p>

</p>

      </div>
        <div ref={resultsTopRef} />

        <TabsContent value="researchers" className="space-y-6">
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
    <p className="text-gray-700 bioClamp3">
      {researcher.bio}
    </p>
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



                    {(researcher.publicationsCount || researcher.grantsCount || researcher.collaboratorsCount) && (
    <div className="grid grid-cols-3 gap-2 md:gap-4 text-[11px] md:text-sm text-gray-600 mb-3">
  {typeof researcher.publicationsCount === 'number' && (
    <div className="flex items-center gap-[3px] md:gap-1.5 whitespace-nowrap">
      <BookOpen className="w-3 h-3 md:w-4 md:h-4" />
      <span className="tabular-nums">{researcher.publicationsCount}</span>
      <span>Publications</span>
    </div>
  )}

  {typeof researcher.grantsCount === 'number' && (
    <div className="flex items-center gap-[3px] md:gap-1.5 whitespace-nowrap">
      <Award className="w-3 h-3 md:w-4 md:h-4" />
      <span className="tabular-nums">{researcher.grantsCount}</span>
      <span>Grants</span>
    </div>
  )}

  {typeof researcher.collaboratorsCount === 'number' && (
    <div className="flex items-center gap-[3px] md:gap-1.5 whitespace-nowrap">
      <Users className="w-3 h-3 md:w-4 md:h-4" />
      <span className="tabular-nums">{researcher.collaboratorsCount}</span>
      <span>Collaborations</span>
    </div>
  )}
</div>

)}


                    {Array.isArray(researcher.recentPublications) && (
                      <div className="border-t pt-3">
                        <h5 className="font-medium text-gray-800 mb-2">Recent Publications</h5>
                        {researcher.recentPublications.map((pub: any, idx: number) => (
                          <div key={idx} className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">{pub.title}</span> {pub.year && `(${pub.year})`} {pub.journal && `- ${pub.journal}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="outcomes" className="space-y-6">
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
                  {outcome.url && (
                    <a
  href={outcome.url}
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
                  <p className="text-gray-700 mb-3">{outcome.abstract}</p>
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