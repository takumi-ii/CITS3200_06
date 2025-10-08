import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface FilterSidebarProps {
  filters: {
    yearRange: number[];
    tags: string[];
    researchArea: string;
  };
  setFilters: (filters: any) => void;
}

const researchTags = [
  'Climate Change',
  'Coral Reef Health', 
  'Marine Biodiversity',
  'Ocean Acidification',
  'Deep Sea Exploration',
  'Fisheries Management',
  'Coastal Erosion',
  'Marine Pollution',
  'Ecosystem Restoration',
  'Sustainable Aquaculture',
  'Marine Protected Areas',
  'Ocean Circulation',
  'Marine Genetics',
  'Blue Carbon',
  'Microplastics'
];

const researchAreas = [
  'Marine Biology',
  'Oceanography', 
  'Marine Chemistry',
  'Marine Geology',
  'Marine Physics',
  'Marine Ecology',
  'Conservation Science',
  'Fisheries Science',
  'Coastal Management',
  'Marine Policy'
];

export default function FilterSidebar({ filters, setFilters }: FilterSidebarProps) {
  const handleYearRangeChange = (value: number[]) => {
    setFilters({ ...filters, yearRange: value });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    setFilters({ ...filters, tags: newTags });
  };

  const handleResearchAreaChange = (area: string) => {
    const newArea = area === 'all' ? '' : area;
    setFilters({ ...filters, researchArea: newArea });
  };


  const handleResetFilters = () => {
  setFilters({
    yearRange: [2000, 2024],
    researchArea: 'all',
    tags: [],
  });
};




  return (
    <div className="w-80 space-y-6">
      <Card>
        <CardHeader className="flex items-center">
  <CardTitle className="text-xl font-semibold text-black">
    Filter 
  </CardTitle>

  <div className="ml-auto">
    <button
  onClick={handleResetFilters}
  style={{
    color: '#6b7280',
    fontSize: '1rem',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.2s ease',
  }}
  onMouseEnter={(e) => (e.currentTarget.style.color = '#003087')}
  onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
>
  Reset
</button>


  </div>
</CardHeader>

       
        <CardContent className="space-y-6">
          
          {/* Year Range */}
          <div>
            <Label className="text-base font-semibold text-gray-900 mb-3 block tracking-wide">
              Publication Year ({filters.yearRange[0]} - {filters.yearRange[1]})
            </Label>
            <Slider
              value={filters.yearRange}
              onValueChange={handleYearRangeChange}
              max={2024}
              min={2000}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>2000</span>
              <span>2024</span>
            </div>
          </div>

          <Separator />

          {/* Research Area */}
          <div>
           <Label className="text-base font-semibold text-gray-900 mb-3 block tracking-wide">
              Research Area
            </Label>
            <Select value={filters.researchArea || 'all'} onValueChange={handleResearchAreaChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select research area..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {researchAreas.map(area => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Research Tags */}
          <div>
  <Label className="text-base font-semibold text-gray-900 mb-3 block tracking-wide">


    Research Focus ({filters.tags.length} selected)
  </Label>

  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    {researchTags.map((tag) => (
      <div
        key={tag}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.25rem 0.5rem",
          borderRadius: "4px",
          transition: "background-color 0.2s ease, color 0.2s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
           e.currentTarget.style.backgroundColor = "#F3F4F6"; // subtle gray (Tailwind gray-100)
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <Checkbox
          id={tag}
          checked={filters.tags.includes(tag)}
          onCheckedChange={() => handleTagToggle(tag)}
        />
        <Label
          htmlFor={tag}
          style={{
            fontSize: "0.875rem",
            color: "#4B5563",
            flex: 1,
            cursor: "pointer",
          }}
        >
          {tag}
        </Label>
      </div>
    ))}
  </div>
</div>

          {/* Selected Tags */}
          {filters.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Selected Filters
                </Label>
                <div className="flex flex-wrap gap-2">
                  {filters.tags.map(tag => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}