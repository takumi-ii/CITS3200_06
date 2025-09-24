// src/data/mockData.ts


export interface ResearcherTilePub {
  id?: string;               // optional if it’s not in outputs yet
  title: string;
  year: number;
  journal?: string;
  url?: string;
  type?: string;
  keywords?: string[];
}
// used to see top collaborators 
// one edge per unique pair (a<b)
export type CollaborationEdge = {
  aId: string;
  bId: string;
  pubCount: number;    // co-authored outputs
  grantCount: number;  // co-participated grants
  total: number;       // pubCount + grantCount (or any weighting you want)
};

// whole index
export type CollaborationIndex = {
  byPair: Record<string, CollaborationEdge>;        // key = "aId|bId" with aId<bId
  byResearcher: Record<string, CollaborationEdge[]>;// adjacency lists (sorted strongest-first)
};

// make the canonical pair key
export const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);



export type Researcher = {
  id: string;
  name: string;
  role?: string;
  institution?: string;
  department?: string;

  title?: string;
  titles?: string[];
  expertise?: string[];

  // summary counts
  publicationsCount?: number;
  grantsCount?: number;
  collaboratorsCount?: number;

  // link to central list
  
  publicationIds?: string[];
  recentPublicationIds?: string[];

  // current frontend needs these objects (keep loose for now)
 recentPublications?: ResearcherTilePub[];

  // ADD these so mocks compile without squiggles

  grantIds?: string[];
  collaboratorIds?: string [];                    // all collaborators by id
  awardIds?: string [];                           // 1:1 award→recipient, but many awards per researcher
  projectIds?: string [];

  // extras
  email?: string;
  phone?: string;
  photoUrl?: string;
  bio?: string;
  mainResearchArea?: string | null;
  location?: string;
};


export type Award = {
  id: string;
  name: string;
  date?: string;
  recipientId: string;
};

export type Grant = {
  id: string ;                   // uuid
  title: string;            // title.en_GB || shortTitle.en_GB || acronym
  startDate: string;        // period.startDate
  endDate?: string | null;  // period.endDate
  type?: string | null;     // type.term.en_GB
  status?: string | null;   // inferred: Pending | Active | Completed | Curtailed
  funder?: string | null;   // externalOrganizations[0].systemName || managingOrganization.systemName
  managingOrg?: string | null;
  url?: string | null;
  // Funding fields (from schema: total_funding, top_funding_source_name)
  totalFunding?: number | null;     // e.g., 750000 (AUD)
  topFundingSourceName?: string | null;
  fundingBreakdown?: { sourceName?: string | null; amount?: number | null }[];
 

  // Relationships
  piId?: string;                // first participant with PI/Lead-like role
  coInvestigatorIds?: string[]; // other matched participants
  participantIds: string [];     // all matched researcher ids
  
  // Optional cross-links
  relatedOutputIds?: string [];
  projectIds?: string [];
 
};

export type FileAttachment = {
  id?: string | number | null;
  url?: string | null;         // download URL
  fileName?: string | null;    // e.g. "SeafoodFraud2027.pdf"
  mimeType?: string | null;    // "application/pdf"
  size?: number | null;        // in bytes if available
  title?: string | null;       // Pure sometimes has a document title
  license?: string | null;     // license.term.en_GB
  visibleOnPortalDate?: string | null;
  visibility?: string | null;  // e.g. FREE, RESTRICTED
};

export type ResearchOutcome = {
  id: string;                      // use uuid/string
  pureId?: number;
  title: string;
  subTitle?: string;
  type?: string;
  category?: string;
  authors?: string[];
  journal?: string;
  year?: number;
  status?: string;

  // extra info (often absent in mocks)
  citations?: number;
  abstract?: string;
  keywords?: string[];
  grantFundingText?: string;
  grantFundingDetails?: {
    orgName?: string;
    acronym?: string;
    fundingNumbers?: string[];
  }[];

  // links + files
  url?: string;
  links?: { url: string; alias?: string; description?: string }[];
  files?: FileAttachment[];  // <— new
};





// -------- Central publications (single source of truth) -------
export const mockResearchOutcomes: ResearchOutcome[] = [
  // (6 in the last 5 years for Suzan: 2021–2025)
  {
    id: 'ro-101',
    title: 'Sustainable Seafood Provenance Framework',
    type: 'Article',
    authors: ['Suzan Perfect', 'Sarah Chen'],
    journal: 'Ocean and Society',
    year: 2025,
    url: 'https://example.org/seafood-provenance',
    abstract: 'A framework aligning provenance, sustainability, and traceability standards.',
    keywords: ['Seafood', 'Provenance', 'Traceability', 'Governance']
  },
  {
    id: 'ro-102',
    title: 'Traceability Pipelines for Marine Supply Chains',
    type: 'Article',
    authors: ['Suzan Perfect', 'Emma Thompson'],
    journal: 'Marine Policy',
    year: 2024,
    url: 'https://example.org/traceability-pipelines',
    abstract: 'End-to-end traceability with verifiable credentials in marine supply chains.',
    keywords: ['Traceability', 'Supply Chains', 'Marine Policy']
  },
  {
    id: 'ro-103',
    title: 'AI-Assisted Monitoring of Illegal, Unreported, and Unregulated Fishing',
    type: 'Article',
    authors: ['Suzan Perfect', 'Michael Rodriguez'],
    journal: 'Frontiers in Marine Science',
    year: 2024,
    url: 'https://example.org/ai-iuu',
    abstract: 'Machine learning to detect IUU fishing from satellite and AIS.',
    keywords: ['IUU Fishing', 'Machine Learning', 'Monitoring']
  },
  {
    id: 'ro-104',
    title: 'Blockchain for Fisheries Certification',
    type: 'Article',
    authors: ['Suzan Perfect'],
    journal: 'Conservation Letters',
    year: 2023,
    url: 'https://example.org/blockchain-fisheries',
    abstract: 'Assessing DLT suitability for certification and ecolabel integrity.',
    keywords: ['Blockchain', 'Certification', 'Ecolabels']
  },
  {
    id: 'ro-105',
    title: 'Portable DNA Barcoding for Seafood Fraud Prevention',
    type: 'Article',
    authors: ['Suzan Perfect', 'Sarah Chen', 'Emma Thompson'],
    journal: 'Environmental DNA',
    year: 2022,
    url: 'https://example.org/dna-barcoding-seafood',
    abstract: 'Field-ready DNA barcoding to identify mislabelled seafood.',
    keywords: ['DNA Barcoding', 'Seafood Fraud']
  },
  {
    id: 'ro-106',
    title: 'Governance Gaps in Ocean Food Systems',
    type: 'Article',
    authors: ['Suzan Perfect'],
    journal: 'Global Environmental Change',
    year: 2021,
    url: 'https://example.org/governance-gaps',
    abstract: 'Mapping regulatory gaps and coordination issues across ocean food systems.',
    keywords: ['Governance', 'Food Systems', 'Policy']
  },

  // (older items to bring Suzan’s total to 10)
  {
    id: 'ro-107',
    title: 'Open Data Standards for Marine Observations',
    type: 'Article',
    authors: ['Suzan Perfect'],
    journal: 'Earth System Science Data',
    year: 2020,
    url: 'https://example.org/open-data-standards',
    abstract: 'A proposal for interoperable marine observation data standards.',
    keywords: ['Open Data', 'Standards', 'Interoperability']
  },
  {
    id: 'ro-108',
    title: 'Quantifying Seafood Supply Chain Emissions',
    type: 'Article',
    authors: ['Suzan Perfect', 'Michael Rodriguez'],
    journal: 'Nature Food',
    year: 2019,
    url: 'https://example.org/seafood-emissions',
    abstract: 'Accounting methods for emissions in seafood supply chains.',
    keywords: ['Emissions', 'Life Cycle Assessment', 'Seafood']
  },
  {
    id: 'ro-109',
    title: 'Ethical Labelling in Marine Products',
    type: 'Article',
    authors: ['Suzan Perfect'],
    journal: 'Journal of Business Ethics',
    year: 2018,
    url: 'https://example.org/ethical-labelling',
    abstract: 'Ethical considerations in labelling and consumer trust.',
    keywords: ['Ethics', 'Labelling', 'Consumer Trust']
  },
  {
    id: 'ro-110',
    title: 'Remote Sensing for Coastal Risk Profiling',
    type: 'Article',
    authors: ['Suzan Perfect', 'Michael Rodriguez'],
    journal: 'Remote Sensing of Environment',
    year: 2017,
    url: 'https://example.org/coastal-risk',
    abstract: 'Using multi-sensor remote sensing to assess coastal risks.',
    keywords: ['Remote Sensing', 'Coastal Risk']
  },

  // keep your earlier core papers as well (for the other researchers)
  {
    id: 'ro-1',
    title: 'Coral Adaptation to Ocean Acidification',
    type: 'Article',
    authors: ['Sarah Chen'],
    journal: 'Nature Climate Change',
    year: 2024,
    url: 'https://example.org/coral-acidification',
    abstract: 'Genetic and ecological adaptations of corals to increasing ocean acidity.',
    keywords: ['Coral Reefs', 'Ocean Acidification', 'Climate Change', 'Marine Ecology']
  },
  {
    id: 'ro-2',
    title: 'Marine Protected Area Effectiveness',
    type: 'Article',
    authors: ['Sarah Chen', 'Emma Thompson'],
    journal: 'Conservation Biology',
    year: 2023,
    url: 'https://example.org/mpa-effectiveness',
    abstract: 'Evaluation of global MPAs and their role in conserving biodiversity.',
    keywords: ['Marine Protected Areas', 'Conservation', 'Biodiversity', 'Ecosystem Management']
  },
  {
    id: 'ro-3',
    title: 'Deep Ocean Carbon Sequestration',
    type: 'Article',
    authors: ['Michael Rodriguez'],
    journal: 'Science',
    year: 2024,
    url: 'https://example.org/deep-carbon',
    abstract: 'Carbon sequestration processes in the deep ocean.',
    keywords: ['Carbon Sequestration', 'Deep Sea', 'Climate Change', 'Oceanography']
  },
  {
    id: 'ro-4',
    title: 'Microplastic Distribution in Australian Waters',
    type: 'Article',
    authors: ['Emma Thompson'],
    journal: 'Environmental Science & Technology',
    year: 2024,
    url: 'https://example.org/microplastics-au',
    abstract: 'Survey of microplastic contamination levels across Australian waters.',
    keywords: ['Microplastics', 'Marine Pollution', 'Environmental Monitoring', 'Australia']
  },
  {
    id: 'ro-5',
    title: 'Ocean pH Monitoring Systems',
    type: 'Article',
    authors: ['Emma Thompson'],
    journal: 'Marine Chemistry',
    year: 2023,
    url: 'https://example.org/ocean-ph',
    abstract: 'Next-gen monitoring systems for continuous ocean pH assessment.',
    keywords: ['Ocean Monitoring', 'pH Systems', 'Marine Chemistry', 'Acidification']
  }
];

// -------- Central grants (12 for Suzan) --------
export const mockGrants: Grant[] = Array.from({ length: 12 }).map((_, i) => {
  const n = i + 1;
  const totalFundingSeries = [
    850000, 1250000, 640000, 980000, 1500000, 720000,
    1100000, 930000, 560000, 1320000, 875000, 1010000
  ];
  return {
    id: `gr-20${n.toString().padStart(2, '0')}`,
    title: [
      'Seafood Integrity and Traceability',
      'Ocean Governance Pathways',
      'IUU Detection at Scale',
      'Blue Food Ethics and Labelling',
      'Coastal Risk & Remote Sensing',
      'Open Marine Data Infrastructure',
      'Fisheries Certification Readiness',
      'Marine Supply Chain Decarbonisation',
      'Rapid DNA for Seafood',
      'AI for Marine Compliance',
      'Trusted Data Exchange for Oceans',
      'Scalable Provenance Analytics'
    ][i],
    startDate: `202${Math.min(4, Math.floor(i/3))}-01-01`,
    endDate: `202${Math.min(6, Math.floor(i/3)+2)}-12-31`,
    type: 'ARC / Program',
    status: 'Active',
    funder: ['ARC', 'CRC', 'Industry', 'Govt'][i % 4],
    managingOrg: 'UWA',
    url: 'https://example.org/grant/' + n,
    totalFunding: totalFundingSeries[i],
    topFundingSourceName: ['ARC', 'CRC', 'Industry', 'Govt'][i % 4],
    piId: 'suzan-perfect',
    coInvestigatorIds: (['sarah-chen', 'michael-rodriguez', 'emma-thompson'] as string[]).slice(0, (i % 3) + 1),
    participantIds: ['suzan-perfect', 'sarah-chen', 'michael-rodriguez', 'emma-thompson'] // all involved for simplicity
  } as Grant;
});

// -------- Central awards (a “decent” set for Suzan) --------
// NOTE: your Award type currently requires both recipientId and recipientIds.
// To avoid squiggles, we fill both, but feel free to drop recipientId later.
export const mockAwards: Award[] = [
  { id: 'aw-301', name: 'Early Career Researcher Award', date: '2022-06-15', recipientId: 'suzan-perfect' },
  { id: 'aw-302', name: 'Blue Food Innovation Award',    date: '2023-11-05', recipientId: 'suzan-perfect' },
  { id: 'aw-303', name: 'Sustainability Leadership Medal', date: '2024-09-01', recipientId: 'suzan-perfect' },
  { id: 'aw-304', name: 'Best Paper Award (Marine Policy)', date: '2025-03-20', recipientId: 'suzan-perfect' },
];

// -------- Central projects (5 for Suzan) --------
export const mockProjects = [
  { id: 'pr-401', title: 'Seafood Provenance Pilot', memberIds: ['suzan-perfect', 'sarah-chen'] },
  { id: 'pr-402', title: 'AI IUU Observatory',      memberIds: ['suzan-perfect', 'michael-rodriguez'] },
  { id: 'pr-403', title: 'Open Ocean Data Hub',     memberIds: ['suzan-perfect'] },
  { id: 'pr-404', title: 'Blue Food Labelling',     memberIds: ['suzan-perfect', 'emma-thompson'] },
  { id: 'pr-405', title: 'Coastal Risk Toolkit',    memberIds: ['suzan-perfect', 'michael-rodriguez'] },
];

// -------- Researchers (existing 3 + NEW: Suzan Perfect) --------
export const mockResearchers: Researcher[] = [
  {
    id: 'sarah-chen',
    name: 'Dr. Sarah Chen',
    title: 'Marine Biologist',
    department: 'School of Biological Sciences',
    expertise: ['Coral Reef Ecology', 'Climate Change', 'Marine Conservation'],

    publicationsCount: 42,
    grantsCount: 8,
    collaboratorsCount: 15,

    recentPublications: [
      { id: 'ro-1', title: 'Coral Adaptation to Ocean Acidification', year: 2024, journal: 'Nature Climate Change' },
      { id: 'ro-2', title: 'Marine Protected Area Effectiveness', year: 2023, journal: 'Conservation Biology' }
    ],

    publicationIds: ['ro-1', 'ro-2'],
    recentPublicationIds: ['ro-1', 'ro-2'],

    // optional deprecated fields if you still need them temporarily
    // grants: [...],
    // collaborators: [...]
  },
  {
    id: 'michael-rodriguez',
    name: 'Prof. Michael Rodriguez',
    title: 'Oceanographer',
    department: 'Oceans Institute',
    expertise: ['Deep Sea Research', 'Ocean Circulation', 'Marine Geology'],

    publicationsCount: 67,
    grantsCount: 12,
    collaboratorsCount: 23,

    recentPublications: [
      { id: 'ro-3', title: 'Deep Ocean Carbon Sequestration', year: 2024, journal: 'Science' }
    ],

    publicationIds: ['ro-3'],
    recentPublicationIds: ['ro-3'],
  },
  {
    id: 'emma-thompson',
    name: 'Dr. Emma Thompson',
    title: 'Marine Chemist',
    department: 'School of Molecular Sciences',
    expertise: ['Ocean Acidification', 'Marine Pollution', 'Biogeochemistry'],

    publicationsCount: 34,
    grantsCount: 6,
    collaboratorsCount: 18,

    recentPublications: [
      { id: 'ro-4', title: 'Microplastic Distribution in Australian Waters', year: 2024, journal: 'Environmental Science & Technology' },
      { id: 'ro-5', title: 'Ocean pH Monitoring Systems', year: 2023, journal: 'Marine Chemistry' }
    ],

    publicationIds: ['ro-4', 'ro-5'],
    recentPublicationIds: ['ro-4', 'ro-5'],
  },

  // --- NEW: Suzan Perfect (the “perfect scenario”) ---
  {
    id: 'suzan-perfect',
    name: 'Dr. Suzan Perfect',
    title: 'Ocean Governance & Seafood Systems',
    department: 'UWA Law School',
    institution: 'UWA',

    // 15 areas of expertise
    expertise: [
      'Seafood Fraud', 'Traceability', 'Provenance', 'Governance', 'Sustainability',
      'Supply Chains', 'Fisheries Policy', 'IUU Fishing', 'Open Data',
      'Blockchain', 'Ethical Labelling', 'Remote Sensing', 'AI Monitoring',
      'Marine Compliance', 'Coastal Risk'
    ],

    // required counts for scenario
    publicationsCount: 10,
    grantsCount: 12,
    collaboratorsCount: 3,

    // 6 recent pubs in the last 5 years (tile-friendly)
    recentPublications: [
      { id: 'ro-101', title: 'Sustainable Seafood Provenance Framework', year: 2025, journal: 'Ocean and Society' },
      { id: 'ro-102', title: 'Traceability Pipelines for Marine Supply Chains', year: 2024, journal: 'Marine Policy' },
      { id: 'ro-103', title: 'AI-Assisted Monitoring of IUU Fishing', year: 2024, journal: 'Frontiers in Marine Science' },
      { id: 'ro-104', title: 'Blockchain for Fisheries Certification', year: 2023, journal: 'Conservation Letters' },
      { id: 'ro-105', title: 'Portable DNA Barcoding for Seafood Fraud Prevention', year: 2022, journal: 'Environmental DNA' },
      { id: 'ro-106', title: 'Governance Gaps in Ocean Food Systems', year: 2021, journal: 'Global Environmental Change' },
    ],

    // link all 10 publications
    publicationIds: ['ro-101','ro-102','ro-103','ro-104','ro-105','ro-106','ro-107','ro-108','ro-109','ro-110'],
    recentPublicationIds: ['ro-101','ro-102','ro-103','ro-104','ro-105','ro-106'],

    // collaborator IDs = the other three people
    collaboratorIds: ['sarah-chen', 'michael-rodriguez', 'emma-thompson'],

    // link 12 grants by id
    grantIds: Array.from({ length: 12 }).map((_, i) => `gr-20${(i+1).toString().padStart(2,'0')}`),

    // awards (linked via central list)
    awardIds: ['aw-301','aw-302','aw-303','aw-304'],

    // projects (5)
    projectIds: ['pr-401','pr-402','pr-403','pr-404','pr-405'],
  }
];
const collabIdx: CollaborationIndex = {
  byPair: {
    "suzan-perfect|sarah-chen": { aId:"suzan-perfect", bId:"sarah-chen", pubCount:2, grantCount:1, total:3 },
    "suzan-perfect|michael-rodriguez": { aId:"michael-rodriguez", bId:"suzan-perfect", pubCount:1, grantCount:1, total:2 },
    "suzan-perfect|emma-thompson": { aId:"emma-thompson", bId:"suzan-perfect", pubCount:3, grantCount:2, total:5 }
  },
  byResearcher: {
    "suzan-perfect": [
      { aId:"suzan-perfect", bId:"sarah-chen", pubCount:2, grantCount:1, total:3 },
      { aId:"suzan-perfect", bId:"michael-rodriguez", pubCount:1, grantCount:1, total:2 },
      { aId:"suzan-perfect", bId:"emma-thompson", pubCount:3, grantCount:2, total:5 }
    ],
    "sarah-chen": [
      { aId:"suzan-perfect", bId:"sarah-chen", pubCount:2, grantCount:1, total:3 }
    ],
    "michael-rodriguez": [
      { aId:"michael-rodriguez", bId:"suzan-perfect", pubCount:1, grantCount:1, total:2 }
    ],
    "emma-thompson": [
      { aId:"emma-thompson", bId:"suzan-perfect", pubCount:3, grantCount:2, total:5 }
    ]
  }
};

export { collabIdx };
