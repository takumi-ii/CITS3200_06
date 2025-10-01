# Complete Project Setup Guide

## Overview
This guide covers the complete setup process for the Oceans Institute project, including database recreation, favicon implementation, and frontend building. The system has been designed to preserve all features when the database is recreated.

## Quick Setup (Recommended)

For a complete setup that ensures all features are properly implemented:

```bash
python setup_project.py --full-setup
```

This single command will:
- ✅ Set up the favicon properly
- ✅ Recreate the database with all features
- ✅ Install frontend dependencies
- ✅ Build the frontend application
- ✅ Verify everything is working correctly

## Database Setup

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

## Usage Options

### Option 1: Complete Setup (Recommended)
```bash
python setup_project.py --full-setup
```

### Option 2: Database Only
```bash
python db/create_db.py
```

### Option 3: Individual Components
```bash
# Just rebuild database
python setup_project.py --rebuild-db

# Just build frontend
python setup_project.py --build-frontend

# Just ensure favicon is set up
python setup_project.py
```

## Favicon Implementation

The favicon has been automatically implemented and will be preserved during database recreation:

- **Source**: `university-of-western-australia-seeklogo.png`
- **Location**: `public/favicon.png`
- **HTML Integration**: Added to both `index.html` and `build/index.html`

The setup script automatically:
1. Copies the PNG file to the public directory
2. Adds favicon links to HTML files
3. Ensures the favicon is accessible in both development and production builds

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

### If Favicon Is Not Showing:
1. Run `python setup_project.py` to ensure favicon is properly set up
2. Check that `public/favicon.png` exists
3. Verify HTML files contain the favicon link
4. Clear browser cache and refresh

### If Frontend Build Fails:
1. Ensure Node.js and npm are installed
2. Run `npm install` to install dependencies
3. Check for any missing files in `package.json`
4. Try `python setup_project.py --build-frontend`

### If Database Creation Fails:
1. Check that all JSON files exist in `db/` directory
2. Ensure Python 3.x is installed
3. Verify SQLite3 is available
4. Check file permissions on the project directory

### If Setup Script Fails:
1. Run individual components to isolate the issue:
   ```bash
   python setup_project.py --rebuild-db
   python setup_project.py --build-frontend
   ```
2. Check error messages for specific issues
3. Ensure all required files are present
4. Verify Python and Node.js versions are compatible

## Files Modified/Created

### New Files
- `setup_project.py` - Comprehensive setup script
- `public/favicon.png` - Favicon file (copied from source)

### Modified Files
- `index.html` - Added favicon link
- `build/index.html` - Added favicon link
- `DATABASE_SETUP.md` - Enhanced documentation

### Existing Files (No Changes)
- `db/create_db.py` - Enhanced with external collaborator functions
- `flask_server.py` - Flask server configuration
- `vite.config.ts` - Vite build configuration
- `package.json` - Frontend dependencies

## Features Preserved During Database Recreation

### ✅ **Database Features**
- Internal UWA researchers (236 researchers)
- External collaborators (7,429+ researchers)
- Research outputs (3,191 outputs)
- Awards and grants
- Project relationships
- Expertise tags and keywords
- Meta information and statistics

### ✅ **Frontend Features**
- Favicon implementation
- All React components and UI elements
- Search functionality
- Filter sidebar
- Network heatmap
- Profile pages
- Results section
- Responsive design

### ✅ **Configuration Features**
- Vite build configuration
- Flask server setup
- API endpoints
- Database connections
- Static file serving
- Development and production modes

## Dependencies

### Required Software
- Python 3.x
- Node.js and npm
- SQLite3

### Required Files
- JSON data files in `db/` directory:
  - `OIPersons.json`
  - `OIResearchOutputs.json`
  - `OIAwards.json`
  - `OIProjects.json`
- `university-of-western-australia-seeklogo.png` (for favicon)
- `package.json` (for frontend dependencies)

### Python Dependencies
- sqlite3 (built-in)
- pandas
- json (built-in)
- uuid (built-in)
- html (built-in)
- re (built-in)
- datetime (built-in)

### Frontend Dependencies
- React 18.3.1
- Vite 6.3.5
- Tailwind CSS
- Radix UI components
- Lucide React icons
- Recharts for visualizations
