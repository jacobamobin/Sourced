"""
Supply Chain Route
Research and aggregate supply chain data using Gemini with Google Search grounding
"""

from flask import Blueprint, request, jsonify, current_app
import os
import json
import time
import requests

from services.gemini_service import research_supply_chain_batch, is_configured, generate_product_summary

import csv

supply_chain_bp = Blueprint('supply_chain', __name__)

# Global database
CITY_DB = {}

def load_city_database():
    global CITY_DB
    if CITY_DB:
        return

    try:
        # Construct path relative to this file
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        csv_path = os.path.join(base_dir, 'services', 'simplemaps_worldcities_basicv1.901', 'worldcities.csv')
        
        if not os.path.exists(csv_path):
            print(f"City database not found at {csv_path}")
            return

        print(f"Loading city database from {csv_path}...")
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Store by city name (lowercase)
                city = row['city_ascii'].lower()
                country = row['country'].lower()
                
                data = {
                    'lat': float(row['lat']),
                    'lng': float(row['lng']),
                    'country': row['country'],
                    'city': row['city_ascii'],
                    'population': float(row['population']) if row['population'] else 0
                }
                
                # Key: "city, country"
                key_full = f"{city}, {country}"
                CITY_DB[key_full] = data
                
                # Key: "city" (store largest population if duplicate)
                if city not in CITY_DB or data['population'] > CITY_DB[city]['population']:
                    CITY_DB[city] = data
                    
        print(f"Loaded {len(CITY_DB)} locations into memory.")
        
    except Exception as e:
        print(f"Error loading city database: {e}")

# Load on import
load_city_database()


# Simple in-memory cache for geocoding
GEOCODE_CACHE = {}

# Fallback coordinates for common countries/cities to avoid API calls
GEOCODE_FALLBACK = {
    "china": {"lat": 35.8617, "lng": 104.1954},
    "shenzhen, china": {"lat": 22.5431, "lng": 114.0579},
    "taiwan": {"lat": 23.6978, "lng": 120.9605},
    "usa": {"lat": 37.0902, "lng": -95.7129},
    "united states": {"lat": 37.0902, "lng": -95.7129},
    "japan": {"lat": 36.2048, "lng": 138.2529},
    "south korea": {"lat": 35.9078, "lng": 127.7669},
    "vietnam": {"lat": 14.0583, "lng": 108.2772},
    "india": {"lat": 20.5937, "lng": 78.9629},
    "germany": {"lat": 51.1657, "lng": 10.4515},
    "netherlands": {"lat": 52.1326, "lng": 5.2913},
    "australia": {"lat": -25.2744, "lng": 133.7751},
    "brazil": {"lat": -14.2350, "lng": -51.9253},
    "dr congo": {"lat": -4.0383, "lng": 21.7587},
    "chile": {"lat": -35.6751, "lng": -71.5430},
    "indonesia": {"lat": -0.7893, "lng": 113.9213},
    "democratic republic of the congo": {"lat": -4.0383, "lng": 21.7587},
    "dr congo": {"lat": -4.0383, "lng": 21.7587},
    "congo": {"lat": -4.0383, "lng": 21.7587},
    "south africa": {"lat": -30.5595, "lng": 22.9375},
    "turkey": {"lat": 38.9637, "lng": 35.2433},
    "thailand": {"lat": 15.8700, "lng": 100.9925},
    "malaysia": {"lat": 4.2105, "lng": 101.9758},
    "philippines": {"lat": 12.8797, "lng": 121.7740},
    "singapore": {"lat": 1.3521, "lng": 103.8198},
    "mexico": {"lat": 23.6345, "lng": -102.5528},
    "canada": {"lat": 56.1304, "lng": -106.3468},
    "uk": {"lat": 55.3781, "lng": -3.4360},
    "united kingdom": {"lat": 55.3781, "lng": -3.4360},
    "france": {"lat": 46.2276, "lng": 2.2137},
    "italy": {"lat": 41.8719, "lng": 12.5674},
    "spain": {"lat": 40.4637, "lng": -3.7492},
    "russia": {"lat": 61.5240, "lng": 105.3188},
    "peru": {"lat": -9.1900, "lng": -75.0152},
    "argentina": {"lat": -38.4161, "lng": -63.6167},
    "bolivia": {"lat": -16.2902, "lng": -63.5887},
    "zambia": {"lat": -13.1339, "lng": 27.8493},
    "morocco": {"lat": 31.7917, "lng": -7.0926},
    "egypt": {"lat": 26.8206, "lng": 30.8025},
    "saudi arabia": {"lat": 23.8859, "lng": 45.0792},
    "uae": {"lat": 23.4241, "lng": 53.8478},
    "israel": {"lat": 31.0461, "lng": 34.8516},
    "switzerland": {"lat": 46.8182, "lng": 8.2275},
    "sweden": {"lat": 60.1282, "lng": 18.6435},
    "finland": {"lat": 61.9241, "lng": 25.7482},
    "norway": {"lat": 60.4720, "lng": 8.4689},
    "poland": {"lat": 51.9194, "lng": 19.1451},
    "czech republic": {"lat": 49.8175, "lng": 15.4730},
    "hungary": {"lat": 47.1625, "lng": 19.5033},
    "romania": {"lat": 45.9432, "lng": 24.9668},
    "ukraine": {"lat": 48.3794, "lng": 31.1656},
    "belgium": {"lat": 50.5039, "lng": 4.4699},
    "austria": {"lat": 47.5162, "lng": 14.5501},
    "ireland": {"lat": 53.1424, "lng": -7.6921},
    "denmark": {"lat": 56.2639, "lng": 9.5018},
    "portugal": {"lat": 39.3999, "lng": -8.2245},
    "greece": {"lat": 39.0742, "lng": 21.8243},
    "myanmar": {"lat": 21.9162, "lng": 95.9560},
    "burma": {"lat": 21.9162, "lng": 95.9560},
    "algeria": {"lat": 28.0339, "lng": 1.6596},
    "rwanda": {"lat": -1.9403, "lng": 29.8739},
    "ghana": {"lat": 7.9465, "lng": -1.0232},
    "qatar": {"lat": 25.3548, "lng": 51.1839},
    "sierra leone": {"lat": 8.4606, "lng": -11.7799},
    "mozambique": {"lat": -18.6657, "lng": 35.5296},
    "gabon": {"lat": -0.8037, "lng": 11.6094}
}

def geocode_location(location_name: str) -> dict:
    """
    Convert location name to lat/lng coordinates using:
    1. Cache
    2. Local City Database (SimpleMaps)
    3. Hardcoded Fallbacks
    4. Nominatim API (OpenStreetMap)

    Args:
        location_name: City, Country or full address

    Returns:
        {lat, lng} or None if not found
    """
    if not location_name:
        return None
        
    # Normalize for cache/fallback lookup
    loc_lower = location_name.lower().strip()
    
    # 1. Check Cache
    if loc_lower in GEOCODE_CACHE:
        return GEOCODE_CACHE[loc_lower]

    # 2. Check Local City Database
    # Try exact match "city, country" or just "city"
    if loc_lower in CITY_DB:
        coords = {
            "lat": CITY_DB[loc_lower]['lat'],
            "lng": CITY_DB[loc_lower]['lng']
        }
        GEOCODE_CACHE[loc_lower] = coords
        return coords
    
    # Try splitting "City, Country" to match "city, country" key in DB
    # This handles cases where input is "Shenzhen, China" and DB has "shenzhen, china"
    # (Already handled by exact match above if format matches, but let's be robust)
    if ',' in loc_lower:
        parts = [p.strip() for p in loc_lower.split(',')]
        if len(parts) >= 2:
            city_part = parts[0]
            country_part = parts[-1]
            key = f"{city_part}, {country_part}"
            if key in CITY_DB:
                coords = {
                    "lat": CITY_DB[key]['lat'],
                    "lng": CITY_DB[key]['lng']
                }
                GEOCODE_CACHE[loc_lower] = coords
                return coords

    # 3. Check Fallback List
    if loc_lower in GEOCODE_FALLBACK:
        return GEOCODE_FALLBACK[loc_lower]
        
    # Try partial match in fallback (e.g. "Shenzhen" in "Shenzhen, China")
    for key, coords in GEOCODE_FALLBACK.items():
        if key in loc_lower or loc_lower in key:
            return coords

    # 4. Try API with retries
    max_retries = 3
    for attempt in range(max_retries):
        try:
            url = "https://nominatim.openstreetmap.org/search"
            # Add a small delay to respect rate limits (1 request per second is OSM policy)
            time.sleep(1.1) 
            
            response = requests.get(
                url,
                params={
                    "q": location_name,
                    "format": "json",
                    "limit": 1
                },
                headers={'User-Agent': 'SupplyChainTransparencyApp/1.0 (hackathon project; contact: jacob@example.com)'},
                timeout=10  # Increased timeout
            )

            if response.status_code == 200:
                results = response.json()
                if results:
                    coords = {
                        "lat": float(results[0]['lat']),
                        "lng": float(results[0]['lon'])
                    }
                    # Cache the result
                    GEOCODE_CACHE[loc_lower] = coords
                    return coords
            elif response.status_code == 429:
                # Rate limited
                print(f"Rate limited by Nominatim for {location_name}, waiting...")
                time.sleep(2 * (attempt + 1))
                continue
                
        except Exception as e:
            print(f"Geocoding error for {location_name} (Attempt {attempt+1}/{max_retries}): {e}")
            time.sleep(1)

    print(f"Failed to geocode {location_name} after {max_retries} attempts")
    return None


def get_demo_supply_chain_data():
    """
    Return demo supply chain data for iPhone 15 Pro
    Used when Gemini is not configured or for testing
    """
    return {
        "product": "Apple iPhone 15 Pro",
        "supply_chain": [
            {
                "component_id": "cpu",
                "component_name": "A17 Pro Processor",
                "manufacturer": "TSMC",
                "manufacturing_locations": [
                    {"facility": "TSMC Fab 18", "city": "Tainan", "country": "Taiwan", "lat": 22.9908, "lng": 120.2133, "type": "chip_fabrication"}
                ],
                "suppliers": [
                    {"name": "ASML", "provides": "EUV Lithography", "country": "Netherlands"},
                    {"name": "Applied Materials", "provides": "Chip Manufacturing Equipment", "country": "USA"}
                ],
                "raw_materials": [
                    {"material": "Silicon Wafers", "source_country": "Taiwan", "lat": 25.0330, "lng": 121.5654},
                    {"material": "Rare Earth Elements", "source_country": "China", "lat": 40.8516, "lng": 111.5246}
                ],
                "certifications": ["ISO 14001", "IECQ QC 080000"]
            },
            {
                "component_id": "display",
                "component_name": "Super Retina XDR OLED Display",
                "manufacturer": "Samsung Display",
                "manufacturing_locations": [
                    {"facility": "Samsung Display Asan", "city": "Asan", "country": "South Korea", "lat": 36.7898, "lng": 127.0045, "type": "display_manufacturing"}
                ],
                "suppliers": [
                    {"name": "Corning", "provides": "Cover Glass", "country": "USA"},
                    {"name": "Universal Display", "provides": "OLED Materials", "country": "USA"}
                ],
                "raw_materials": [
                    {"material": "Indium", "source_country": "China", "lat": 31.2304, "lng": 121.4737},
                    {"material": "Glass Substrates", "source_country": "Japan", "lat": 35.6762, "lng": 139.6503}
                ],
                "certifications": ["ISO 14001", "RoHS"]
            },
            {
                "component_id": "battery",
                "component_name": "Lithium-ion Battery",
                "manufacturer": "ATL/BYD",
                "manufacturing_locations": [
                    {"facility": "ATL Ningde Factory", "city": "Ningde", "country": "China", "lat": 26.6617, "lng": 119.5283, "type": "battery_manufacturing"},
                    {"facility": "BYD Shenzhen", "city": "Shenzhen", "country": "China", "lat": 22.5431, "lng": 114.0579, "type": "battery_manufacturing"}
                ],
                "suppliers": [
                    {"name": "Ganfeng Lithium", "provides": "Lithium Compounds", "country": "China"},
                    {"name": "CATL", "provides": "Battery Cells", "country": "China"}
                ],
                "raw_materials": [
                    {"material": "Lithium", "source_country": "Australia", "lat": -31.9505, "lng": 115.8605},
                    {"material": "Cobalt", "source_country": "DR Congo", "lat": -4.4419, "lng": 15.2663},
                    {"material": "Nickel", "source_country": "Indonesia", "lat": -0.7893, "lng": 113.9213}
                ],
                "certifications": ["ISO 14001", "UL 2054"]
            },
            {
                "component_id": "camera_main",
                "component_name": "48MP Main Camera Sensor",
                "manufacturer": "Sony",
                "manufacturing_locations": [
                    {"facility": "Sony Kumamoto Factory", "city": "Kumamoto", "country": "Japan", "lat": 32.7898, "lng": 130.7417, "type": "sensor_fabrication"}
                ],
                "suppliers": [
                    {"name": "Canon", "provides": "Lens Elements", "country": "Japan"}
                ],
                "raw_materials": [
                    {"material": "Silicon", "source_country": "Japan", "lat": 35.6762, "lng": 139.6503},
                    {"material": "Optical Glass", "source_country": "Germany", "lat": 50.9375, "lng": 6.9603}
                ],
                "certifications": ["ISO 14001"]
            },
            {
                "component_id": "memory",
                "component_name": "8GB LPDDR5 RAM",
                "manufacturer": "SK Hynix",
                "manufacturing_locations": [
                    {"facility": "SK Hynix Icheon", "city": "Icheon", "country": "South Korea", "lat": 37.2792, "lng": 127.4425, "type": "memory_fabrication"}
                ],
                "suppliers": [
                    {"name": "Lam Research", "provides": "Etch Equipment", "country": "USA"}
                ],
                "raw_materials": [
                    {"material": "Silicon Wafers", "source_country": "South Korea", "lat": 37.5665, "lng": 126.9780},
                    {"material": "Copper", "source_country": "Chile", "lat": -33.4489, "lng": -70.6693}
                ],
                "certifications": ["ISO 14001", "ISO 50001"]
            }
        ],
        "assembly_location": {
            "facility": "Foxconn Zhengzhou",
            "city": "Zhengzhou",
            "country": "China",
            "lat": 34.7466,
            "lng": 113.6253,
            "type": "final_assembly"
        },
        "total_countries": 9,
        "sustainability_score": 72,
        "demo": True
    }


@supply_chain_bp.route('/supply-chain', methods=['POST'])
def get_supply_chain():
    """
    Research supply chain data for product components

    Request: {
        product_info: {brand, model, category},
        components: [{id, name, manufacturer}]
    }

    Response: {
        supply_chain: [{
            component_id,
            manufacturing_locations: [{facility, city, country, lat, lng}],
            suppliers: [{name, provides, country}],
            raw_materials: [{material, source_country, lat, lng}]
        }],
        assembly_location: {facility, city, country, lat, lng},
        total_countries: number,
        globe_data: {nodes: [], arcs: []}
    }
    """
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Request body required'}), 400

    product_info = data.get('product_info', {})
    components = data.get('components', [])
    use_demo = data.get('use_demo', False)

    # Check cache
    cache_key = f"{product_info.get('brand', '')}_{product_info.get('model', '')}".replace(' ', '_').lower()
    cache_folder = current_app.config['CACHE_FOLDER']
    cache_path = os.path.join(cache_folder, f"{cache_key}_supply.json")

    if os.path.exists(cache_path) and not data.get('force_refresh', False):
        with open(cache_path, 'r') as f:
            cached_result = json.load(f)
        cached_result['cached'] = True
        return jsonify(cached_result)

    # Return demo data if requested or if Gemini not configured
    if use_demo or not is_configured():
        result = get_demo_supply_chain_data()
        result['globe_data'] = build_globe_data(result)
        return jsonify(result)

    # Research supply chain using Gemini (Batch Mode)
    # We process all components in one go for efficiency
    
    # Limit to 50 components to avoid token limits if list is huge
    components_to_process = components[:50]
    
    # Parallel execution: Research Supply Chain AND Generate Product Summary
    import concurrent.futures
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_chain = executor.submit(research_supply_chain_batch, components_to_process, product_info)
        future_summary = executor.submit(generate_product_summary, product_info, components_to_process)
        
        supply_chain_data = future_chain.result()
        product_summary = future_summary.result()

    # Geocode locations for all results
    locations_to_geocode = []
    
    for chain_data in supply_chain_data:
        # Collect manufacturing locations
        for loc in chain_data.get('manufacturing_locations', []):
            if 'lat' not in loc:
                loc_str = f"{loc.get('city', '')}, {loc.get('country', '')}"
                locations_to_geocode.append(('man', loc, loc_str))

        # Collect raw materials
        for material in chain_data.get('raw_materials', []):
            if 'lat' not in material:
                loc_str = material.get('source_country', '')
                locations_to_geocode.append(('mat', material, loc_str))

    # Parallel geocoding
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        future_to_loc = {
            executor.submit(geocode_location, loc_str): (type_, obj) 
            for type_, obj, loc_str in locations_to_geocode
        }
        
        for future in concurrent.futures.as_completed(future_to_loc):
            type_, obj = future_to_loc[future]
            try:
                coords = future.result()
                if coords:
                    obj.update(coords)
            except Exception as exc:
                print(f"Geocoding generated an exception: {exc}")

    result = {
        'product': f"{product_info.get('brand', '')} {product_info.get('model', '')}",
        'supply_chain': supply_chain_data,
        'ai_summary': product_summary,
        'assembly_location': {
            'facility': 'Main Assembly',
            'city': 'Zhengzhou',
            'country': 'China',
            'lat': 34.7466,
            'lng': 113.6253,
            'type': 'final_assembly'
        },
        'cached': False
    }

    # Build globe visualization data
    result['globe_data'] = build_globe_data(result)

    # Calculate stats
    countries = set()
    for chain in supply_chain_data:
        for loc in chain.get('manufacturing_locations', []):
            countries.add(loc.get('country'))
        for mat in chain.get('raw_materials', []):
            countries.add(mat.get('source_country'))

    result['total_countries'] = len(countries)

    # Cache result
    with open(cache_path, 'w') as f:
        json.dump(result, f, indent=2)

    return jsonify(result)


@supply_chain_bp.route('/supply-chain/single', methods=['POST'])
def get_supply_chain_single():
    """
    Research supply chain data for a SINGLE component
    Used for parallel/incremental loading in frontend
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    product_info = data.get('product_info', {})
    component = data.get('component', {})
    
    if not component:
        return jsonify({'error': 'Component required'}), 400

    # Research single component
    from services.gemini_service import research_supply_chain
    import concurrent.futures
    
    try:
        chain_data = research_supply_chain(component, product_info)
        
        if chain_data:
            # Collect all locations to geocode
            locations_to_geocode = []
            
            # Manufacturing locations
            for loc in chain_data.get('manufacturing_locations', []):
                if 'lat' not in loc:
                    loc_str = f"{loc.get('city', '')}, {loc.get('country', '')}"
                    locations_to_geocode.append(('man', loc, loc_str))

            # Raw materials
            for material in chain_data.get('raw_materials', []):
                if 'lat' not in material:
                    loc_str = material.get('source_country', '')
                    locations_to_geocode.append(('mat', material, loc_str))
            
            # Parallel geocoding
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                future_to_loc = {
                    executor.submit(geocode_location, loc_str): (type_, obj) 
                    for type_, obj, loc_str in locations_to_geocode
                }
                
                for future in concurrent.futures.as_completed(future_to_loc):
                    type_, obj = future_to_loc[future]
                    try:
                        coords = future.result()
                        if coords:
                            obj.update(coords)
                    except Exception as exc:
                        print(f"Geocoding generated an exception: {exc}")

        return jsonify(chain_data)
        
    except Exception as e:
        print(f"Error researching component {component.get('name')}: {e}")
        return jsonify({'error': str(e)}), 500


def build_globe_data(supply_chain_result: dict) -> dict:
    """
    Transform supply chain data into globe visualization format

    Returns:
        {
            nodes: [{id, name, lat, lng, type, size}],
            arcs: [{startLat, startLng, endLat, endLng, color, weight, label}]
        }
    """
    nodes = []
    arcs = []
    node_ids = set()

    assembly = supply_chain_result.get('assembly_location', {})
    if assembly.get('lat'):
        assembly_id = f"assembly_{assembly.get('city', 'main')}"
        nodes.append({
            'id': assembly_id,
            'name': assembly.get('facility', 'Final Assembly'),
            'lat': assembly['lat'],
            'lng': assembly['lng'],
            'type': 'assembly',
            'size': 1.5,
            'color': '#ef4444'  # Red for assembly
        })
        node_ids.add(assembly_id)

    for chain in supply_chain_result.get('supply_chain', []):
        component_id = chain.get('component_id', 'unknown')

        # Manufacturing locations
        for loc in chain.get('manufacturing_locations', []):
            if loc.get('lat'):
                loc_id = f"mfg_{loc.get('facility', loc.get('city', ''))}".replace(' ', '_').lower()
                if loc_id not in node_ids:
                    nodes.append({
                        'id': loc_id,
                        'name': loc.get('facility', loc.get('city', '')),
                        'lat': loc['lat'],
                        'lng': loc['lng'],
                        'type': 'manufacturing',
                        'size': 1.0,
                        'color': '#3b82f6',  # Blue for manufacturing
                        'component': component_id
                    })
                    node_ids.add(loc_id)

                # Arc from manufacturing to assembly
                if assembly.get('lat'):
                    arcs.append({
                        'startLat': loc['lat'],
                        'startLng': loc['lng'],
                        'endLat': assembly['lat'],
                        'endLng': assembly['lng'],
                        'color': '#3b82f6',
                        'weight': 2,
                        'label': chain.get('component_name', component_id),
                        'type': 'component_to_assembly'
                    })

        # Raw materials
        for material in chain.get('raw_materials', []):
            if material.get('lat'):
                mat_id = f"mat_{material.get('material', '')}_{material.get('source_country', '')}".replace(' ', '_').lower()
                if mat_id not in node_ids:
                    nodes.append({
                        'id': mat_id,
                        'name': material.get('material', 'Raw Material'),
                        'lat': material['lat'],
                        'lng': material['lng'],
                        'type': 'raw_material',
                        'size': 0.6,
                        'color': '#10b981',  # Green for raw materials
                        'source_country': material.get('source_country')
                    })
                    node_ids.add(mat_id)

                # Find first manufacturing location for this component
                mfg_locs = chain.get('manufacturing_locations', [])
                if mfg_locs and mfg_locs[0].get('lat'):
                    arcs.append({
                        'startLat': material['lat'],
                        'startLng': material['lng'],
                        'endLat': mfg_locs[0]['lat'],
                        'endLng': mfg_locs[0]['lng'],
                        'color': '#10b981',
                        'weight': 1,
                        'label': material.get('material', ''),
                        'type': 'material_to_manufacturing'
                    })

    return {
        'nodes': nodes,
        'arcs': arcs,
        'stats': {
            'total_nodes': len(nodes),
            'total_arcs': len(arcs),
            'manufacturing_sites': len([n for n in nodes if n['type'] == 'manufacturing']),
            'material_sources': len([n for n in nodes if n['type'] == 'raw_material'])
        }
    }


@supply_chain_bp.route('/supply-chain/demo', methods=['GET'])
def get_demo_data():
    """
    Return demo supply chain data for testing

    Response: Full supply chain data for iPhone 15 Pro
    """
    result = get_demo_supply_chain_data()
    result['globe_data'] = build_globe_data(result)
    return jsonify(result)
