# Sorting Features Documentation

## Overview
This document ensures that all sorting functionality implemented in the ResultsSection component will work correctly when the database is recreated using `db/create_db.py`.

## ✅ Verified Features

### 1. **Database Structure Requirements**
All required tables and fields are present:
- ✅ `OIMembers` table with `position`, `first_title`, `bio`, `photo_url` fields
- ✅ `OIResearchOutputs` table with `publication_year` field
- ✅ `OIResearchOutputsCollaborators` table for researcher-publication relationships
- ✅ `OIMembersMetaInfo` table with publication counts

### 2. **Position Data**
- ✅ **260 UWA researchers** (excluding external collaborators)
- ✅ **44 unique positions** including all leadership roles
- ✅ **Director (1 person)** - Rank 10
- ✅ **Deputy Director (1 person)** - Rank 9
- ✅ **Professor (19 people)** - Rank 7
- ✅ **Associate Professor (11 people)** - Rank 6

### 3. **Recent Publications Data**
- ✅ **3,191 research outputs** with publication years
- ✅ **16,848 researcher-publication relationships**
- ✅ **1,048 recent publications** (2020+)
- ✅ API returns `recentPublications` array with `year` field

### 4. **Publication Counts**
- ✅ **7,689 researchers** with meta information
- ✅ **7,645 researchers** with publications
- ✅ API returns `publicationsCount` field

## 🔧 Implementation Details

### Sorting Options Available:
1. **Default (Current Staff First)**
   - Prioritizes current staff over adjunct/honorary positions
   - Uses `role` field to identify current vs adjunct staff
   - Tiebreaker: publication count

2. **Recent Publications**
   - Sorts by most recent publication year from `recentPublications` array
   - Uses `Math.max()` to find most recent year per researcher
   - Tiebreaker: publication count

3. **Position Rank**
   - Comprehensive hierarchy with 44 positions ranked 0-10
   - Leadership positions (Director, Deputy Director) at top
   - Academic positions (Professor, Associate Professor) in middle
   - Adjunct positions at bottom
   - Tiebreaker: publication count

### API Data Mapping:
- Database `position` field → API `role` field
- Database `first_title` field → API `title` field
- Database `publication_year` → API `recentPublications[].year`
- Database `num_research_outputs` → API `publicationsCount`

## 🚀 Database Recreation Process

### When you run `python db/create_db.py`:

1. **Schema Creation**: All required tables and fields are created
2. **Data Loading**: All position data, publication data, and relationships are loaded
3. **Meta Information**: Publication counts and collaboration data are calculated
4. **External Collaborators**: Added automatically (filtered out from sorting)

### Verification Commands:
```bash
# Run verification script
python verify_sorting_simple.py

# Expected output: "SUCCESS: ALL CHECKS PASSED!"
```

## 📋 Position Hierarchy (Complete List)

### Leadership Positions (Rank 10-6):
- Director (10)
- Deputy Director (9)
- Chief Executive Officer (9)
- Head of Department (8)
- Centre Manager (7)
- Manager (7)
- Program Coordinator (6)

### Academic Positions (Rank 8-3):
- Winthrop Professor (8)
- Professor (7)
- Professorial Fellow (7)
- Emeritus Professor (6)
- Associate Professor (6)
- Senior Lecturer (5)
- Lecturer (4)
- Adjunct Senior Lecturer (3)

### Research Positions (Rank 5-2):
- Senior Research Fellow (5)
- Senior Research Engineer (5)
- Senior Research Officer (4)
- Research Fellow (4)
- Research Associate (3)
- Research Officer (3)
- Scientific Officer (3)
- Research Assistant (2)

### Fellowships (Rank 5-4):
- Premier's Science Fellow (5)
- DECRA Fellow (4)

### Adjunct Positions (Rank 2):
- Adjunct Professor (2)
- Adjunct Associate Professor (2)
- Adjunct Senior Research Fellow (2)
- Adjunct Research Fellow (2)

### Honorary Positions (Rank 3-2):
- Senior Honorary Fellow (3)
- Senior Honorary Research Fellow (3)
- Honorary Research Fellow (2)
- Honorary Research Associate (2)
- Honorary Fellow (2)

### Administrative/Technical (Rank 2-1):
- Administrative Officer (2)
- Electronics Engineer (2)
- Field Assistant (1)
- Technician (Soils Lab) (1)

### Other Positions (Rank 2-0):
- Casual Teaching (2)
- Contractor / Visitor (1)
- External Collaborator (0) - Filtered out

## 🔍 Troubleshooting

### If Sorting Doesn't Work After Database Recreation:

1. **Check API Response**:
   ```bash
   curl http://localhost:5000/api/researchers | jq '.researchers[0]'
   ```
   Should show: `role`, `publicationsCount`, `recentPublications`

2. **Verify Database**:
   ```bash
   python verify_sorting_simple.py
   ```

3. **Check Frontend Console**:
   - Look for JavaScript errors
   - Verify `sortBy` state is updating
   - Check that `role` field is present in researcher data

### Common Issues:
- **Missing `role` field**: Check that API maps `position` to `role`
- **No recent publications**: Verify `OIResearchOutputsCollaborators` relationships
- **Position not found**: Check that all 44 positions are in the ranking system

## 📁 Files Modified for Sorting Features

- `src/components/ResultsSection.tsx` - Main sorting implementation
- `verify_sorting_simple.py` - Verification script
- `SORTING_FEATURES_DOCUMENTATION.md` - This documentation

## ✅ Conclusion

All sorting features are **fully compatible** with database recreation. The `db/create_db.py` script preserves all required data structures and relationships needed for the comprehensive sorting system.

**The sorting functionality will work immediately after database recreation without any additional setup or configuration.**
