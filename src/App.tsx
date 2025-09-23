import { useState } from 'react';
import HeroSection from './components/HeroSection';
import SearchSection from './components/SearchSection';
import FilterSidebar from './components/FilterSidebar';
import ResultsSection from './components/ResultsSection';
import NetworkHeatmap from './components/NetworkHeatmap';
import Profile from './components/profile';


type Researcher = {
  id?: number | string;
  uuid?: string;
  name: string;
  title?: string;
  department?: string;
  bio?: string;
  expertise?: string[];
  // add anything else you’ll show in the modal
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    yearRange: [2020, 2024],
    tags: [],
    researchArea: ''
  });



   const [profileOpen, setProfileOpen] = useState(false);
   const [selectedResearcher, setSelectedResearcher] = useState<Researcher | null>(null);


    const handleCloseProfile = () => {
    setProfileOpen(false);
    setSelectedResearcher(null); // optional: clear on close
  };


  const [dataSource, setDataSource] = useState<'api' | 'mock'>('mock');

  const toggleDataSource = () => {
    setDataSource(prev => (prev === 'mock' ? 'api' : 'mock'));
  };



  


  return (
    <div className="min-h-screen bg-background">
   {/* Top Navigation Bar */}
<nav className="bg-blue-900 text-white px-6 py-4">
  <div className="flex items-center justify-between max-w-7xl mx-auto">
    {/* Left side: Logos */}
    <div className="flex items-center space-x-4">
      <img
        src="/images/logo-uwacrest-white.svg"
        alt="UWA Crest"
        className="h-12"
      />
      <img
        src="/images/logo_oceans_white.svg"
        alt="Oceans Institute Logo"
        className="h-12"
      />
    </div>

    {/* Right side: Menu */}
    <div className="hidden md:flex space-x-6 text-sm font-medium">
      <span>About the OI</span>
      <span>Research Priorities</span>
      <span>Partnerships</span>
      <span>Expeditions</span>
      <span>Resources</span>
      <span>Awards</span>
       <button
        onClick={toggleDataSource}
        className="ml-4 px-3 py-1 rounded bg-white text-blue-900 font-semibold hover:bg-gray-100 transition"
      >
        {dataSource === 'mock' ? 'Switch to API' : 'Switch to Mock'}
      </button>

      
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
    <ResultsSection
            searchQuery={searchQuery}
            filters={filters}
            setProfileOpen={setProfileOpen}
            setSelectedResearcher={setSelectedResearcher}
            dataSource = {dataSource}
          />
        </div>
      </div>

       <Profile
        open={profileOpen}
        onClose={handleCloseProfile}
        person={selectedResearcher}
      />


      {/* Network Heatmap */}
      <NetworkHeatmap searchQuery={searchQuery} filters={filters} />
    </div>

    
  );
}