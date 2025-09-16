import React, { useEffect, useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('researchers');
  const [researchers, setResearchers] = useState<Member[]>([]);
  const [outcomes, setOutcomes] = useState<ResearchOutput[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      const q = searchQuery?.trim();
      if (!q) {
        setResearchers([]);
        setOutcomes([]);
        return;
      }
      try {
        setLoading(true);
        const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
        const data = await resp.json();
        setResearchers(Array.isArray(data.members) ? data.members : []);
        setOutcomes(Array.isArray(data.research_outputs) ? data.research_outputs : []);
      } catch (err) {
        // Fallback to mock data if backend not available
        const filteredResearchers = mockResearchers.filter(researcher => {
          const matchesQuery = !searchQuery || 
            researcher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            researcher.expertise.some(exp => exp.toLowerCase().includes(searchQuery.toLowerCase()));
          const matchesTags = filters.tags.length === 0 || 
            filters.tags.some(tag => researcher.expertise.some(exp => exp.includes(tag)));
          return matchesQuery && matchesTags;
        });
        const filteredOutcomes = mockResearchOutcomes.filter(outcome => {
          const matchesQuery = !searchQuery || 
            outcome.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            outcome.keywords.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()));
          const matchesTags = filters.tags.length === 0 || 
            filters.tags.some(tag => outcome.keywords.includes(tag));
          const matchesYear = outcome.year >= filters.yearRange[0] && outcome.year <= filters.yearRange[1];
          return matchesQuery && matchesTags && matchesYear;
        });
        setResearchers(filteredResearchers as unknown as Member[]);
        setOutcomes(filteredOutcomes as unknown as ResearchOutput[]);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [searchQuery, filters]);

  return (
    <div className="flex-1">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Search Results
        </h3>
        <p className="text-gray-600">
          {loading ? 'Searching…' : `Found ${researchers.length} researchers and ${outcomes.length} research outcomes`}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="researchers" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Researchers ({researchers.length})
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Research Outcomes ({outcomes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="researchers" className="space-y-6">
          {researchers.map((researcher: any) => (
            <Card key={researcher.uuid || researcher.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-blue-600" />
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
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View Profile
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
                    
                    {(researcher.publications || researcher.grants || researcher.collaborations) && (
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
          {outcomes.map((outcome: any) => (
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
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View Paper
                  </Button>
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
    </div>
  );
}
