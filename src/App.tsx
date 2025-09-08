import { useState } from 'react';
import HeroSection from './components/HeroSection';
import SearchSection from './components/SearchSection';
import FilterSidebar from './components/FilterSidebar';
import ResultsSection from './components/ResultsSection';
import NetworkHeatmap from './components/NetworkHeatmap';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    yearRange: [2020, 2024],
    tags: [],
    researchArea: ''
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar - Reference only */}
      <nav className="bg-blue-900 text-white px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="text-lg font-medium">University of Western Australia | OCEANS INSTITUTE</div>
          </div>
          <div className="hidden md:flex space-x-6">
            <span>About the OI</span>
            <span>Research Priorities</span>
            <span>Partnerships</span>
            <span>Expeditions</span>
            <span>Resources</span>
            <span>Awards</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection />

      {/* Search Section */}
      <SearchSection searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Filter Sidebar */}
          <FilterSidebar filters={filters} setFilters={setFilters} />
          
          {/* Results Section */}
          <ResultsSection searchQuery={searchQuery} filters={filters} />
        </div>
      </div>

      {/* Network Heatmap */}
      <NetworkHeatmap searchQuery={searchQuery} filters={filters} />
    </div>
  );
}