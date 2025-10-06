import { useState, useRef, useEffect } from 'react';
import HeroSection from './components/HeroSection';
import SearchSection from './components/SearchSection';
import FilterSidebar from './components/FilterSidebar';
import ResultsSection from './components/ResultsSection';
import NetworkHeatmap from './components/NetworkHeatmap';
import Profile from './components/profile';
import { Researcher } from './data/mockData';
import { loadAllData } from './data/api';
// src/main.tsx or src/main.jsx
import './index.css';





export default function App() {
// App.tsx
useEffect(() => {
  console.log('App: calling loadAllData');
  loadAllData();
}, []);


  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    yearRange: [2020, 2024],
    tags: [],
    researchArea: ''
  });


  
  //target to scroll to
  const heatmapRef = useRef<HTMLDivElement | null>(null);

  // smooth scroll (accounts for the sticky top-nav height)
   const scrollToHeatmap = () => {
    const el = heatmapRef.current;
    if (!el) return;
    const NAV_HEIGHT = 96; // adjust if your navbar height changes
    const top = el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
    window.scrollTo({ top, behavior: 'smooth' });
  };



   const [profileOpen, setProfileOpen] = useState(false);
   const [selectedResearcher, setSelectedResearcher] = useState<Researcher | null>(null);
   const [profileHistory, setProfileHistory] = useState<Researcher[]>([]);
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  const openProfile = (r: Researcher) => {
    setSelectedResearcher(r);
    setProfileHistory([r]);     // start a fresh stack
    setProfileOpen(true);
  };

const pushProfile = (r: Researcher) => {
  setProfileHistory(prev => {
    // if empty, seed with the current person first
    const base = prev.length === 0 && selectedResearcher
      ? [selectedResearcher]
      : prev;
    return [...base, r];
  });
  setSelectedResearcher(r);
};
  const popProfile = () => {
    setProfileHistory(prev => {
      if (prev.length <= 1) return prev;     // nothing to pop
      const next = prev.slice(0, -1);
      setSelectedResearcher(next[next.length - 1]);
      return next;
    });
  };

  const handleCloseProfile = () => {
    setProfileOpen(false);
    setSelectedResearcher(null);
    setProfileHistory([]); // clear on close
  };



  const [dataSource, setDataSource] = useState<'api' | 'mock'>('api');

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
      <img src="/images/logo-uwacrest-white.svg" alt="UWA Crest" className="h-12" />
      <img src="/images/logo_oceans_white.svg" alt="Oceans Institute Logo" className="h-12" />
    </div>

    {/* Desktop Menu */}
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

    {/* Mobile Menu Button */}
    <div className="md:hidden flex items-center">
  <div className="flex overflow-hidden shadow">
    {/* Hamburger block (dark navy) */}
    <button
      onClick={() => setMobileMenuOpen(v => !v)}
      aria-label="Menu"
      className="h-10 w-12 grid place-items-center bg-[#0B1E51] focus:outline-none focus:ring-2 focus:ring-white"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
           viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    {/* Search block (light blue) */}
    <button
      aria-label="Search"
      className="h-10 w-12 grid place-items-center bg-[#3DA4ED] focus:outline-none focus:ring-2 focus:ring-white"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
           viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
    </button>
  </div>
</div>
  </div>

  {/* Mobile dropdown (appears when open) */}
  {mobileMenuOpen && (
    <div className="md:hidden mt-4 px-4 space-y-3 text-sm">
      <span className="block">About the OI</span>
      <span className="block">Research Priorities</span>
      <span className="block">Partnerships</span>
      <span className="block">Expeditions</span>
      <span className="block">Resources</span>
      <span className="block">Awards</span>
      <button
        onClick={toggleDataSource}
        className="w-full mt-2 px-3 py-2 rounded bg-white text-blue-900 font-semibold hover:bg-gray-100 transition"
      >
        {dataSource === 'mock' ? 'Switch to API' : 'Switch to Mock'}
      </button>
    </div>
  )}
</nav>


      {/* Hero Section */}
      <HeroSection onExploreClick={scrollToHeatmap} />

      {/* Search Section */}
      <SearchSection searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
{/* Main Content Area */}
<div className="max-w-7xl mx-auto px-6 py-8">
  <div className="flex flex-col lg:flex-row gap-8">
    {/* Sidebar (normal flow, scrolls with page) */}
    <div className="basis-80 shrink-0">
      <FilterSidebar filters={filters} setFilters={setFilters} />
    </div>

    {/* Results Section (normal flow, scrolls with page) */}
    <div className="flex-1 min-w-0">
      <ResultsSection
        searchQuery={searchQuery}
        filters={filters}
        setProfileOpen={setProfileOpen}
        setSelectedResearcher={setSelectedResearcher}
        dataSource={dataSource}
      />
    </div>
  </div>
</div>



       <Profile
        open={profileOpen}
        onClose={handleCloseProfile}
        person={selectedResearcher}
        dataSource = {dataSource}
         setSelectedResearcher={setSelectedResearcher}   // add this
         setProfileOpen={setProfileOpen} 
        pushProfile={pushProfile}
      popProfile={popProfile}
      canGoBack={profileHistory.length > 1}              // add this
      />


      {/* Network Heatmap */}
     <div ref={heatmapRef}>
        <NetworkHeatmap searchQuery={searchQuery} filters={filters} />
      </div>
    </div>

    
  );
}