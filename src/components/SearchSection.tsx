import { Search, Filter } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';


export interface SearchSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  setMobileFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;

}


export default function SearchSection({
  searchQuery,
  setSearchQuery,

  setMobileFilterOpen,

}: SearchSectionProps) {
  return (
  <section className="bg-gradient-to-b from-blue-50 to-white py-0">

    {/* 🔹 Mobile-only full-width black banner */}
    <div className="relative bg-black text-white px-6 py-8 md:hidden text-left overflow-hidden">
      {/* Animated white line at the top */}
      <div className="absolute top-0 left-0 h-[3px] bg-white animate-grow-line"></div>

      <h2 className="text-2xl font-semibold mb-3 mt-2 inline-block border-white pb-1">
        Find a researcher
      </h2>
      <p className="text-base leading-relaxed opacity-90">
        Explore our network of world-class ocean and marine science experts.
        Browse, filter, or search to connect with researchers leading innovative projects at UWA.
      </p>

      {/* Mobile search area (black background version) */}
   {/* Mobile search area (black background version) */}
<div className="mt-8">
  {/* Search input + button row */}
<div className="flex gap-3">
  <div className="flex-1 relative">
  {/* Search Input */}
  <Input
    type="text"
    placeholder="Search researchers..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pr-14 pl-4 py-6 text-xl bg-black text-white border-2 border-gray-500 focus:border-[#00AEEF] w-full placeholder-gray-400 shadow-md rounded-none"
  />

  {/* Magnifying glass icon on the right */}
  <Search className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-300 w-7 h-7 pointer-events-none " />
</div>

</div>


  {/* NEW: Filter button below search bar */}
  <div className="mt-4">
    <Button
  size="lg"
  className="w-full py-5 bg-[#00AEEF] text-[#002042] text-lg font-bold rounded-none hover:bg-[#0095cc] transition"
  onClick={() => setMobileFilterOpen(true)} 
>
  Filter Results
</Button>


  </div>
</div>


      {/* Inline styles for animation */}
      <style>{`
        @keyframes growLine {
          0% { width: 0; }
          100% { width: 100%; }
        }
        .animate-grow-line {
          animation: growLine 1.2s ease-out forwards;
        }
      `}</style>
    </div>

    {/* 🔹 Desktop / Tablet white version (unchanged) */}
    <div className="hidden md:block max-w-4xl mx-auto px-6 py-12">
      <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search researchers, publications, grants, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-6 text-lg border-2 border-blue-200 focus:border-blue-500 rounded-xl"
            />
          </div>
          <Button 
            size="lg" 
            className="px-8 py-6 bg-blue-600 hover:bg-blue-700 rounded-xl"
          >
            <Search className="w-5 h-5 mr-2" />
            Search
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          <span className="text-sm text-gray-600">Popular searches:</span>
          {['Climate Change', 'Coral Reefs', 'Marine Biology', 'Ocean Conservation', 'Deep Sea Research'].map((term) => (
            <button
              key={term}
              onClick={() => setSearchQuery(term)}
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-sm transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  </section>
);

}