// src/data/mockData.ts

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
  recentPublications?: any[];

  // ADD these so mocks compile without squiggles
  grants?: any[];
  collaborators?: any[];

  // extras
  email?: string;
  phone?: string;
  photoUrl?: string;
  mainResearchArea?: string | null;
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
};

// -------- Central publications (single source of truth) --------
export const mockResearchOutcomes: ResearchOutcome[] = [
  {
    id: 'ro-1',
    title: 'Coral Adaptation to Ocean Acidification',
    type: 'Article',
    authors: ['Sarah Chen'],
    journal: 'Nature Climate Change',
    year: 2024,
    url: 'https://example.org/coral-acidification'
  },
  {
    id: 'ro-2',
    title: 'Marine Protected Area Effectiveness',
    type: 'Article',
    authors: ['Sarah Chen', 'Emma Thompson'],
    journal: 'Conservation Biology',
    year: 2023,
    url: 'https://example.org/mpa-effectiveness'
  },
  {
    id: 'ro-3',
    title: 'Deep Ocean Carbon Sequestration',
    type: 'Article',
    authors: ['Michael Rodriguez'],
    journal: 'Science',
    year: 2024,
    url: 'https://example.org/deep-carbon'
  },
  {
    id: 'ro-4',
    title: 'Microplastic Distribution in Australian Waters',
    type: 'Article',
    authors: ['Emma Thompson'],
    journal: 'Environmental Science & Technology',
    year: 2024,
    url: 'https://example.org/microplastics-au'
  },
  {
    id: 'ro-5',
    title: 'Ocean pH Monitoring Systems',
    type: 'Article',
    authors: ['Emma Thompson'],
    journal: 'Marine Chemistry',
    year: 2023,
    url: 'https://example.org/ocean-ph'
  }
];

// -------- Researchers (additive: objects for today + IDs for later) --------
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

    // works with current frontend
    recentPublications: [
      { title: 'Coral Adaptation to Ocean Acidification', year: 2024, journal: 'Nature Climate Change' },
      { title: 'Marine Protected Area Effectiveness', year: 2023, journal: 'Conservation Biology' }
    ],

    // future-proof linking
    publicationIds: ['ro-1', 'ro-2'],
    recentPublicationIds: ['ro-1', 'ro-2'],

    // loose lists so components won’t error
    grants: [
      { id: 'gr-1', title: 'Indo-Pacific Reef Resilience', funders: [{ name: 'ARC' }], role: 'CI', status: 'Active' }
    ],
    collaborators: [
      { id: 'col-1', name: 'Jane Smith', role: 'Co-Investigator', affiliation: 'UWA' },
      { id: 'col-2', name: 'Alan Brown', role: 'Partner Investigator', affiliation: 'Oxford' }
    ]
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
      { title: 'Deep Ocean Carbon Sequestration', year: 2024, journal: 'Science' }
    ],

    publicationIds: ['ro-3'],
    recentPublicationIds: ['ro-3'],

    grants: [
      { id: 'gr-2', title: 'Southern Ocean Carbon Fluxes', funders: [{ name: 'NHMRC' }], role: 'PI', status: 'Active' }
    ],
    collaborators: [
      { id: 'col-3', name: 'Lisa Park', role: 'Co-Investigator', affiliation: 'CSIRO' }
    ]
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
      { title: 'Microplastic Distribution in Australian Waters', year: 2024, journal: 'Environmental Science & Technology' },
      { title: 'Ocean pH Monitoring Systems', year: 2023, journal: 'Marine Chemistry' }
    ],

    publicationIds: ['ro-4', 'ro-5'],
    recentPublicationIds: ['ro-4', 'ro-5'],

    grants: [
      { id: 'gr-3', title: 'Microplastics in Food Webs', funders: [{ name: 'CRC' }], role: 'CI', status: 'Completed' }
    ],
    collaborators: [
      { id: 'col-4', name: 'David Brown', role: 'Partner Investigator', affiliation: 'UNSW' }
    ]
  }
];
