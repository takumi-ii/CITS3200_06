/**
 * Main App Component
 * 
 * This is the root component of the Oceans Institute Research Database application.
 * It manages the overall layout and coordinates state between all major sections:
 * - Hero section with call-to-action
 * - Search and filter functionality
 * - Results display (researchers & publications)
 * - Researcher profile modal
 * - Network visualization heatmap
 * 
 * State Management:
 * - Uses custom useLocalStorageState hook to persist user preferences
 * - Loads all data from API on mount via loadAllData()
 * - Supports both API and mock data modes for development
 * 
 * @module App
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import HeroSection from './components/HeroSection';
import SearchSection from './components/SearchSection';
import FilterSidebar from './components/FilterSidebar';
import ResultsSection from './components/ResultsSection';
import NetworkHeatmap from './components/NetworkHeatmap';
import Profile from './components/profile';
import { Researcher } from './data/mockData';
import { loadAllData } from './data/api';
import MobileFilterFullScreen from './components/MobileFilterFullScreen';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import './index.css';

export default function App() {
  /* ============================================================
     DATA INITIALIZATION
     ============================================================ */
  
  /**
   * Load all researchers and research outcomes on initial mount
   * This populates the central store that all components can access
   */
  useEffect(() => {
    loadAllData();
  }, []);

  /* ============================================================
     SEARCH & FILTER STATE
     ============================================================ */
  
  /**
   * Search query entered by the user
   * Persisted to localStorage to remember between sessions
   */
  const [searchQuery, setSearchQuery] = useLocalStorageState<string>(
    'app.searchQuery',
    ''
  );

  /**
   * Filter settings for narrowing down results
   * - yearRange: Min and max publication years
   * - tags: Array of selected keyword tags
   * - researchArea: Selected research area (empty string = all areas)
   * 
   * Persisted to localStorage
   */
  const [filters, setFilters] = useLocalStorageState<{
    yearRange: [number, number];
    tags: string[];
    researchArea: string;
  }>('app.filters', {
    yearRange: [2020, 2024],
    tags: [],
    researchArea: ''
  });

  /* ============================================================
     SCROLL & NAVIGATION
     ============================================================ */
  
  /** Reference to the network heatmap section for smooth scrolling */
  const heatmapRef = useRef<HTMLDivElement | null>(null);

  /**
   * Smoothly scrolls to the network heatmap section
   * Accounts for the sticky navigation bar height
   */
  const scrollToHeatmap = () => {
    const el = heatmapRef.current;
    if (!el) return;
    const NAV_HEIGHT = 96; // Height of sticky navbar
    const top = el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  /* ============================================================
     PROFILE MODAL STATE
     ============================================================ */
  
  /**
   * Whether the researcher profile modal is currently open
   * Persisted so users can refresh without losing their place
   */
  const [profileOpen, setProfileOpen] = useLocalStorageState<boolean>(
    'app.profileOpen',
    false
  );

  /**
   * The currently selected researcher whose profile is displayed
   * Null when no profile is open
   */
  const [selectedResearcher, setSelectedResearcher] = useLocalStorageState<Researcher | null>(
    'app.selectedResearcher',
    null
  );

  /**
   * History stack for profile navigation
   * Allows users to click through related researchers and go back
   * Similar to browser back/forward functionality
   */
  const [profileHistory, setProfileHistory] = useLocalStorageState<Researcher[]>(
    'app.profileHistory',
    []
  );

  /* ============================================================
     MOBILE UI STATE
     ============================================================ */
  
  /** Whether the mobile navigation menu is open */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  /** Whether the mobile filter panel is open */
  const [MobileFilterOpen, setMobileFilterOpen] = useState(false);

  /* ============================================================
     PROFILE NAVIGATION FUNCTIONS
     ============================================================ */
  
  /**
   * Navigates to a new researcher profile (forward navigation)
   * Adds the new researcher to the history stack
   * 
   * @param r - Researcher to navigate to
   */
  const pushProfile = (r: Researcher) => {
    setProfileHistory((prev: Researcher[]) => {
      // If history is empty, seed it with the current researcher first
      const base = prev.length === 0 && selectedResearcher
        ? [selectedResearcher]
        : prev;
      return [...base, r];
    });
    setSelectedResearcher(r);
  };

  /**
   * Navigates back to the previous researcher in the history stack
   * Similar to browser "back" button
   */
  const popProfile = () => {
    setProfileHistory((prev: Researcher[]) => {
      if (prev.length <= 1) return prev;  // Can't go back further
      const next = prev.slice(0, -1);
      setSelectedResearcher(next[next.length - 1]);
      return next;
    });
  };

  /**
   * Closes the profile modal and clears all profile state
   */
  const handleCloseProfile = () => {
    setProfileOpen(false);
    setSelectedResearcher(null);
    setProfileHistory([]);
  };


  /**
   * Measures the navigation bar height for responsive calculations
   * Used to position modals and dropdowns correctly below the navbar
   */
  useEffect(() => {
    const measure = () => setNavOffset(navRef.current?.offsetHeight ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* ============================================================
     DATA SOURCE TOGGLE (Development Feature)
     ============================================================ */
  
  /**
   * Current data source: 'api' (real backend) or 'mock' (local test data)
   * Useful for development when backend is unavailable
   */
  const [dataSource, setDataSource] = useState<'api' | 'mock'>('api');

  /**
   * Toggles between API and mock data sources
   */
  const toggleDataSource = () => {
    setDataSource((prev: 'api' | 'mock') => (prev === 'mock' ? 'api' : 'mock'));
  };

  /* ============================================================
     LAYOUT MEASUREMENTS
     ============================================================ */
  
  /** Reference to the navigation element */
  const navRef = useRef<HTMLElement | null>(null);
  
  /** Reference to the header element (includes nav and dropdowns) */
  const headerRef = useRef<HTMLElement | null>(null);
  
  /** Current height of the navigation/header area in pixels */
  const [navOffset, setNavOffset] = useState(0);


  /**
   * Observes header height changes using ResizeObserver
   * This handles:
   * - Mobile menu opening/closing
   * - Window resizing
   * - Dynamic content changes
   * 
   * The measured height is used to position modals and dropdowns correctly
   */
  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;

    // ResizeObserver watches for size changes including dropdown opens/closes
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setNavOffset(Math.round(rect.height));
    });

    ro.observe(el);
    setNavOffset(el.offsetHeight);  // Initial measurement

    return () => ro.disconnect();
  }, []);



  /* ============================================================
     COMPONENT RENDER
     ============================================================ */
  
  return (
    <div className="min-h-screen bg-background">
      {/* ==================== NAVIGATION BAR ==================== */}
      {/* 
        Sticky header that stays at the top of the viewport
        Contains the UWA/Oceans Institute branding and main navigation
        Includes mobile menu toggle and data source switcher
      */}
      <header ref={headerRef} className="sticky top-0 z-[2147483650]">
        <nav
          ref={navRef}
          className="bg-blue-900 text-white px-6 py-4 sticky top-0 z-[2147483650]"
        >
  <div className="flex items-center justify-between max-w-7xl mx-auto">
    {/* Left side: Logos */}
    <div className="flex items-center space-x-4">
      <img src="/images/logo-uwacrest-white.svg" alt="UWA Crest" className="h-12" />
      <img src="/images/logo_oceans_white.svg" alt="Oceans Institute Logo" className="h-12" />
    </div>

    {/* Desktop Menu */}
    <div className="hidden md:flex space-x-6 text-sm font-medium">
      <span className="hover:text-blue-200 transition-colors cursor-pointer">About the OI</span>
      <span className="hover:text-blue-200 transition-colors cursor-pointer">Research Priorities</span>
      <span className="hover:text-blue-200 transition-colors cursor-pointer">Partnerships</span>
      <span className="hover:text-blue-200 transition-colors cursor-pointer">Expeditions</span>
      <span className="hover:text-blue-200 transition-colors cursor-pointer">Resources</span>
      <span className="hover:text-blue-200 transition-colors cursor-pointer">Awards</span>
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
      onClick={() => setMobileMenuOpen((v: boolean) => !v)}
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
  <div
    className="md:hidden fixed inset-x-0 px-4 space-y-3 text-sm bg-blue-900 text-white py-4 shadow-lg"
    style={{
      top: navOffset,               // use the measured header height
      zIndex: 21474836520,           // higher than header (2147483650) and modals
    }}
  >

    <span className="block py-2 hover:text-blue-200 transition-colors cursor-pointer">About the OI</span>
    <span className="block py-2 hover:text-blue-200 transition-colors cursor-pointer">Research Priorities</span>
    <span className="block py-2 hover:text-blue-200 transition-colors cursor-pointer">Partnerships</span>
    <span className="block py-2 hover:text-blue-200 transition-colors cursor-pointer">Expeditions</span>
    <span className="block py-2 hover:text-blue-200 transition-colors cursor-pointer">Resources</span>
    <span className="block py-2 hover:text-blue-200 transition-colors cursor-pointer">Awards</span>
    <button
      onClick={toggleDataSource}
      className="w-full mt-2 px-3 py-2 rounded bg-white text-blue-900 font-semibold hover:bg-gray-100 transition"
    >
      {dataSource === 'mock' ? 'Switch to API' : 'Switch to Mock'}
    </button>
  </div>
)}

</nav>
</header>


      {/* Hero Section */}
      <HeroSection onExploreClick={scrollToHeatmap} />
 


      {/* Search Section */}
      <SearchSection
  searchQuery={searchQuery}
  setSearchQuery={setSearchQuery}
  setMobileFilterOpen={setMobileFilterOpen}
/>

 <MobileFilterFullScreen
      open={MobileFilterOpen}
      filters={filters}
      setFilters={setFilters}
      onClose={() => setMobileFilterOpen(false)}
      onApply={() => setMobileFilterOpen(false)}
      /** NEW: push panel under the sticky nav on mobile */
      navOffset={navOffset}
    />


{/* Main Content Area */}
<div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
  <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
    {/* Sidebar (normal flow, scrolls with page) */}
    <div className="hidden lg:block basis-80 shrink-0">
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
      dataSource={dataSource}
      setSelectedResearcher={setSelectedResearcher}
      setProfileOpen={setProfileOpen}
      pushProfile={pushProfile}
      popProfile={popProfile}
      canGoBack={profileHistory.length > 1}
      /** NEW: push panel + shared-outputs modal under the sticky nav on mobile */
      navOffset={navOffset}
    />

      {/* Network Heatmap */}
     <div ref={heatmapRef}>
        <NetworkHeatmap searchQuery={searchQuery} filters={filters} />
      </div>
    </div>

    
  );
}