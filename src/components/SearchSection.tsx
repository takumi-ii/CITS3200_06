import { Search, Filter } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface SearchSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function SearchSection({ searchQuery, setSearchQuery }: SearchSectionProps) {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-white py-0">

  {/* Mobile-only full-width black banner (UTAS-style) */}
<div className="relative bg-black text-white px-6 py-8 md:hidden text-left overflow-hidden">
  {/* Animated white line at the top */}
  <div className="absolute top-0 left-0 h-[3px] bg-white animate-grow-line"></div>

  <h2 className="text-2xl font-semibold mb-3 mt-2">
    Find a researcher
  </h2>
  <p className="text-base leading-relaxed opacity-90">
    Explore our network of world-class ocean and marine science experts. 
    Browse, filter, or search to connect with researchers leading innovative projects at UWA.
  </p>

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

      <div className="max-w-4xl mx-auto px-6">
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