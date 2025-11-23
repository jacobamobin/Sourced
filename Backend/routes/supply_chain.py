"""
Supply Chain Route
Research and aggregate supply chain data using Gemini with Google Search grounding
"""

from flask import Blueprint, request, jsonify, current_app
import os
import json
import time
import requests

from services.gemini_service import research_supply_chain, is_configured

supply_chain_bp = Blueprint('supply_chain', __name__)


def geocode_location(location_name: str) -> dict:
    """
    Convert location name to lat/lng coordinates using Nominatim

    Args:
        location_name: City, Country or full address

    Returns:
        {lat, lng} or None if not found
    """
    try:
        url = "https://nominatim.openstreetmap.org/search"
        response = requests.get(
            url,
            params={
                "q": location_name,
                "format": "json",
                "limit": 1
            },
            headers={'User-Agent': 'SupplyChainTransparencyApp/1.0 (hackathon project)'},
            timeout=5
        )

        results = response.json()
        if results:
            return {
                "lat": float(results[0]['lat']),
                "lng": float(results[0]['lon'])
            }
    except Exception as e:
        print(f"Geocoding error for {location_name}: {e}")

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

    # Research supply chain using Gemini
    supply_chain_data = []

    for component in components[:5]:  # Limit to 5 components for API rate limits
        chain_data = research_supply_chain(component, product_info)

        # Geocode locations that don't have coordinates
        for loc in chain_data.get('manufacturing_locations', []):
            if 'lat' not in loc:
                location_str = f"{loc.get('city', '')}, {loc.get('country', '')}"
                coords = geocode_location(location_str)
                if coords:
                    loc.update(coords)

        for material in chain_data.get('raw_materials', []):
            if 'lat' not in material:
                coords = geocode_location(material.get('source_country', ''))
                if coords:
                    material.update(coords)

        supply_chain_data.append(chain_data)

        # Respect API rate limits (Gemini free tier)
        time.sleep(2)

    result = {
        'product': f"{product_info.get('brand', '')} {product_info.get('model', '')}",
        'supply_chain': supply_chain_data,
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
