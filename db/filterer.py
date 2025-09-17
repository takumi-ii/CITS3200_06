import json

def filter_by_organization(input_file, output_file, target_uuid='b3a31a78-ac4b-46f0-91e0-89423a64aea6'):
    try:
        # Read the JSON file with UTF-8 encoding
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Check if 'items' key exists
        if type(data) is dict and 'items' in data:
            data = data['items']
        # Filter items where organizationalUuid matches the target
        filtered_data = []
        for item in data:
            # print(f"Item: {item}")
            organizations = item.get('organisationalUnits', [])
            
            if len(organizations) > 0:
                if target_uuid == organizations[0].get('uuid'):
                    filtered_data.append(item)
        
        # Write the filtered data to a new JSON file (UTF-8 as well)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(filtered_data, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully filtered {len(filtered_data)} items out of {len(data)} total items")
        
    except FileNotFoundError:
        print(f"Error: Could not find the input file {input_file}")
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in input file")

if __name__ == "__main__":
    input_file = "db\\projects.json"  # Replace with your input JSON file name
    output_file = "db\\OIProjects.json"
    filter_by_organization(input_file, output_file)