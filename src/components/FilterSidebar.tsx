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

  return (
    <div className="w-80 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">Filter Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Year Range */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
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
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
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
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              Research Focus ({filters.tags.length} selected)
            </Label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {researchTags.map(tag => (
                <div key={tag} className="flex items-center space-x-2">
                  <Checkbox
                    id={tag}
                    checked={filters.tags.includes(tag)}
                    onCheckedChange={() => handleTagToggle(tag)}
                  />
                  <Label 
                    htmlFor={tag} 
                    className="text-sm text-gray-600 cursor-pointer flex-1"
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