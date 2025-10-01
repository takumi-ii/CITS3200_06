# Database Setup Guide

## Overview
The `db/create_db.py` script has been enhanced to automatically handle external collaborators every time the database is recreated. This ensures that external collaborators are never lost when the database is rebuilt.

## What the Script Does

### Step-by-Step Process:
1. **Create Database Schema** - Rebuilds the database from `create_db.sql`
2. **Load Internal UWA Researchers** - From `OIPersons.json`
3. **Load Research Outputs** - From `OIResearchOutputs.json`
4. **Load Awards** - From `OIAwards.json`
5. **Load Projects** - From `OIProjects.json`
6. **Add External Collaborators** - Automatically identifies and adds all external collaborators
7. **Update External Names** - Extracts real names from research outputs and updates placeholders
8. **Fill Meta Information** - Populates relationship and metadata

### External Collaborator Handling:
- **Identifies** all collaborator UUIDs that don't exist in `OIMembers`
- **Adds placeholder entries** with names like "External Researcher (abc12345)"
- **Extracts real names** from research outputs JSON data
- **Updates placeholders** with actual researcher names when available
- **Handles duplicates** by skipping names that already exist for other researchers

## Usage

### To Recreate the Database:
```bash
python db/create_db.py
```

### What You'll See:
```
============================================================
CREATING OCEANS INSTITUTE DATABASE
============================================================

[STEP 1] Creating database schema...
[STEP 2] Loading internal UWA researchers...
[STEP 3] Loading research outputs...
[STEP 4] Loading awards...
[STEP 5] Loading projects...
[STEP 6] Adding external collaborators...
[INFO] Found 7429 missing external researchers
[INFO] Successfully added 7429 external researchers to OIMembers
[STEP 7] Updating external collaborator names...
[INFO] Extracted 564 unique author UUID->name mappings
[INFO] Updated 347 external researchers with real names
[STEP 8] Filling meta information...
============================================================
DATABASE CREATION COMPLETE!
============================================================
Internal UWA researchers: 236
External collaborators: 7429
Research outputs: 3191
Total researchers: 7665
```

## Key Features

### ✅ **Robust & Automatic**
- No manual intervention required
- Handles external collaborators automatically
- Works every time the database is recreated

### ✅ **Smart Name Extraction**
- Extracts names from research outputs JSON
- Handles multiple name formats
- Prevents duplicate names
- Falls back to placeholders when names unavailable

### ✅ **Comprehensive Coverage**
- Processes all 7,429+ external collaborators
- Updates ~347 with real names
- Keeps placeholders for remaining ~7,082

### ✅ **Error Handling**
- Handles Unicode encoding issues
- Graceful fallbacks for missing data
- Detailed progress reporting

## Troubleshooting

### If External Collaborators Are Missing:
1. Run `python db/create_db.py` to recreate the database
2. The script will automatically add all external collaborators
3. Check the output for any error messages

### If Names Are Still Placeholders:
- This is normal for ~7,082 external collaborators
- Real names are only available for ~347 collaborators
- The system extracts names from research outputs data

## Files Modified

- `db/create_db.py` - Enhanced with external collaborator functions
- `DATABASE_SETUP.md` - This documentation file

## Dependencies

- Python 3.x
- SQLite3
- JSON data files in `db/` directory:
  - `OIPersons.json`
  - `OIResearchOutputs.json`
  - `OIAwards.json`
  - `OIProjects.json`
