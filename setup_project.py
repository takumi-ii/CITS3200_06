#!/usr/bin/env python3
"""
Comprehensive Project Setup Script
==================================

This script ensures that ALL project features are properly implemented when the database
is recreated. It handles:

1. Database recreation with all features
2. Favicon implementation
3. Frontend build process
4. Static file management
5. Configuration verification

Usage:
    python setup_project.py [--rebuild-db] [--build-frontend] [--full-setup]
"""

import os
import sys
import shutil
import subprocess
import argparse
from pathlib import Path

def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)

def print_step(step_num, description):
    """Print a formatted step."""
    print(f"\n[STEP {step_num}] {description}")

def run_command(command, description, cwd=None):
    """Run a command and handle errors."""
    print(f"  Running: {command}")
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            cwd=cwd or os.getcwd(),
            capture_output=True, 
            text=True, 
            check=True
        )
        if result.stdout:
            print(f"  Output: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ERROR: {e}")
        if e.stderr:
            print(f"  Error details: {e.stderr}")
        return False

def ensure_favicon():
    """Ensure favicon is properly set up."""
    print_step(1, "Setting up favicon...")
    
    # Check if favicon exists in public directory
    favicon_path = Path("public/favicon.png")
    source_favicon = Path("university-of-western-australia-seeklogo.png")
    
    if not favicon_path.exists():
        if source_favicon.exists():
            print(f"  Copying {source_favicon} to {favicon_path}")
            shutil.copy2(source_favicon, favicon_path)
        else:
            print(f"  WARNING: Source favicon {source_favicon} not found!")
            return False
    
    # Check if HTML files have favicon links
    html_files = ["index.html", "build/index.html"]
    favicon_link = '<link rel="icon" type="image/png" href="/favicon.png" />'
    
    for html_file in html_files:
        if Path(html_file).exists():
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if favicon_link not in content:
                print(f"  Adding favicon link to {html_file}")
                # Add favicon link after title
                content = content.replace(
                    '<title>Ocean Themed Search Page</title>',
                    f'<title>Ocean Themed Search Page</title>\n      {favicon_link}'
                )
                
                with open(html_file, 'w', encoding='utf-8') as f:
                    f.write(content)
            else:
                print(f"  Favicon already configured in {html_file}")
    
    print("  [OK] Favicon setup complete")
    return True

def recreate_database():
    """Recreate the database with all features."""
    print_step(2, "Recreating database with all features...")
    
    # Check if create_db.py exists
    if not Path("db/create_db.py").exists():
        print("  ERROR: db/create_db.py not found!")
        return False
    
    # Run the database creation script
    success = run_command("python db/create_db.py", "Creating database")
    
    if success:
        print("  [OK] Database recreation complete")
        return True
    else:
        print("  [ERROR] Database recreation failed")
        return False

def install_dependencies():
    """Install frontend dependencies."""
    print_step(3, "Installing frontend dependencies...")
    
    if not Path("package.json").exists():
        print("  ERROR: package.json not found!")
        return False
    
    success = run_command("npm install", "Installing npm dependencies")
    
    if success:
        print("  [OK] Dependencies installed")
        return True
    else:
        print("  [ERROR] Dependency installation failed")
        return False

def build_frontend():
    """Build the frontend application."""
    print_step(4, "Building frontend application...")
    
    success = run_command("npm run build", "Building frontend")
    
    if success:
        print("  [OK] Frontend build complete")
        return True
    else:
        print("  [ERROR] Frontend build failed")
        return False

def verify_setup():
    """Verify that all components are properly set up."""
    print_step(5, "Verifying setup...")
    
    checks = [
        ("Database file", Path("data.db").exists()),
        ("Favicon file", Path("public/favicon.png").exists()),
        ("Frontend build", Path("build").exists() and Path("build/index.html").exists()),
        ("Root HTML with favicon", check_html_favicon("index.html")),
        ("Build HTML with favicon", check_html_favicon("build/index.html")),
    ]
    
    all_passed = True
    for check_name, passed in checks:
        status = "[OK]" if passed else "[ERROR]"
        print(f"  {status} {check_name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("  [OK] All verifications passed!")
    else:
        print("  [ERROR] Some verifications failed!")
    
    return all_passed

def check_html_favicon(html_file):
    """Check if HTML file has favicon link."""
    if not Path(html_file).exists():
        return False
    
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    return '<link rel="icon" type="image/png" href="/favicon.png" />' in content

def main():
    """Main setup function."""
    parser = argparse.ArgumentParser(description="Comprehensive project setup")
    parser.add_argument("--rebuild-db", action="store_true", help="Rebuild database")
    parser.add_argument("--build-frontend", action="store_true", help="Build frontend")
    parser.add_argument("--full-setup", action="store_true", help="Run complete setup")
    
    args = parser.parse_args()
    
    print_header("OCEANS INSTITUTE PROJECT SETUP")
    print("This script ensures all features are properly implemented.")
    
    success = True
    
    # Always ensure favicon is set up
    if not ensure_favicon():
        success = False
    
    # Rebuild database if requested or full setup
    if args.rebuild_db or args.full_setup:
        if not recreate_database():
            success = False
    
    # Build frontend if requested or full setup
    if args.build_frontend or args.full_setup:
        if not install_dependencies():
            success = False
        elif not build_frontend():
            success = False
    
    # Always verify setup
    if not verify_setup():
        success = False
    
    print_header("SETUP COMPLETE")
    if success:
        print("[SUCCESS] All features have been successfully implemented!")
        print("\nYour project is ready with:")
        print("  [OK] Database with all researchers and external collaborators")
        print("  [OK] Favicon properly configured")
        print("  [OK] Frontend built and ready")
        print("  [OK] All static files in place")
        print("\nTo start the development server:")
        print("  npm run dev")
        print("\nTo start the production server:")
        print("  python flask_server.py")
    else:
        print("[ERROR] Setup encountered some issues.")
        print("Please check the error messages above and try again.")
        sys.exit(1)

if __name__ == "__main__":
    main()
