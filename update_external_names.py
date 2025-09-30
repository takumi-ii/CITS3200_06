"""
Update external researcher names from the research outputs JSON data.
Extracts actual author names from personAssociations and updates OIMembers.
"""
import json
import sqlite3
from collections import defaultdict

def extract_author_names_from_json():
    """
    Parse OIResearchOutputs.json and build a mapping of UUID -> real name
    from personAssociations (both internal persons and externalPersons)
    """
    with open('db/OIResearchOutputs.json', 'r', encoding='utf-8') as f:
        research_outputs = json.load(f)
    
    # Map UUID to name (will collect all names for each UUID)
    uuid_to_names = defaultdict(set)
    
    total_outputs = len(research_outputs)
    print(f"Processing {total_outputs} research outputs...")
    
    for idx, output in enumerate(research_outputs):
        if (idx + 1) % 500 == 0:
            print(f"  Processed {idx + 1}/{total_outputs}...")
        
        person_associations = output.get('personAssociations', [])
        
        for assoc in person_associations:
            # Get the name (format: {'firstName': 'J.', 'lastName': 'Gould'})
            name_obj = assoc.get('name', {})
            if isinstance(name_obj, dict):
                first_name = name_obj.get('firstName', '')
                last_name = name_obj.get('lastName', '')
                if first_name or last_name:
                    name_text = f"{first_name} {last_name}".strip()
                else:
                    # Fallback for other formats
                    name_text = name_obj.get('value') or str(name_obj.get('text', [{}])[0].get('value', ''))
            else:
                name_text = str(name_obj) if name_obj else None
            
            if not name_text or name_text == '{}':
                continue
            
            # Get UUID from person or externalPerson
            person_uuid = None
            
            if 'person' in assoc:
                person_obj = assoc['person']
                person_uuid = person_obj.get('uuid')
            elif 'externalPerson' in assoc:
                ext_person_obj = assoc['externalPerson']
                person_uuid = ext_person_obj.get('uuid')
            
            if person_uuid:
                uuid_to_names[person_uuid].add(name_text.strip())
    
    # Convert sets to single names (take the most common or first one)
    uuid_to_name = {}
    for uuid, names in uuid_to_names.items():
        if len(names) == 1:
            uuid_to_name[uuid] = list(names)[0]
        else:
            # If multiple names for same UUID, pick the longest (usually most complete)
            uuid_to_name[uuid] = max(names, key=len)
    
    print(f"\nExtracted {len(uuid_to_name)} unique author UUID->name mappings")
    return uuid_to_name

def update_external_researcher_names(uuid_to_name):
    """
    Update OIMembers table with real names for external researchers
    """
    conn = sqlite3.connect('data.db')
    cur = conn.cursor()
    
    # Get all external researchers with placeholder names
    cur.execute("""
        SELECT uuid, name 
        FROM OIMembers 
        WHERE position = 'External Collaborator'
        AND name LIKE 'External Researcher (%)'
    """)
    
    external_researchers = cur.fetchall()
    print(f"\nFound {len(external_researchers)} external researchers with placeholder names")
    
    updated = 0
    not_found = 0
    
    for uuid, current_name in external_researchers:
        if uuid in uuid_to_name:
            real_name = uuid_to_name[uuid]
            
            # Check if this name already exists (to avoid duplicates)
            cur.execute("SELECT uuid FROM OIMembers WHERE name = ? AND uuid != ?", (real_name, uuid))
            existing = cur.fetchone()
            
            if existing:
                # Name already exists for another UUID, keep placeholder but add note
                print(f"  Skipping {uuid[:8]}: Name '{real_name}' already exists for another researcher")
                not_found += 1
            else:
                # Update with real name
                cur.execute("""
                    UPDATE OIMembers 
                    SET name = ?
                    WHERE uuid = ?
                """, (real_name, uuid))
                updated += 1
                
                if updated <= 10:  # Show first 10 updates
                    print(f"  Updated: {current_name} -> {real_name}")
        else:
            not_found += 1
    
    conn.commit()
    
    print(f"\nUpdated {updated} external researchers with real names")
    print(f"{not_found} external researchers kept placeholder names (no data available)")
    
    # Show some examples of updated names
    print("\nSample of updated external researchers:")
    cur.execute("""
        SELECT name 
        FROM OIMembers 
        WHERE position = 'External Collaborator'
        AND name NOT LIKE 'External Researcher (%)'
        LIMIT 10
    """)
    
    for (name,) in cur.fetchall():
        print(f"  - {name}")
    
    conn.close()
    
    return updated, not_found

def main():
    print("=" * 70)
    print("Updating External Researcher Names from Research Outputs")
    print("=" * 70)
    
    # Step 1: Extract names from JSON
    uuid_to_name = extract_author_names_from_json()
    
    # Step 2: Update database
    updated, not_found = update_external_researcher_names(uuid_to_name)
    
    print("=" * 70)
    print("Done!")
    print(f"Summary: {updated} updated with real names, {not_found} kept placeholder names")
    print("=" * 70)

if __name__ == "__main__":
    main()

