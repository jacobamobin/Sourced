"""
Gemini API Service
Handles all interactions with Google's Gemini 2.5 Pro API
- Product identification (Vision)
- Component analysis
- Supply chain research (with Google Search grounding)
"""

import os
import json
import base64
from PIL import Image
import io

# Initialize Gemini client
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

try:
    from google import genai
    from google.genai import types

    if GEMINI_API_KEY:
        client = genai.Client(api_key=GEMINI_API_KEY)
    else:
        client = None
except ImportError:
    client = None
    genai = None
    types = None


def is_configured():
    """Check if Gemini is properly configured"""
    return client is not None and GEMINI_API_KEY is not None


def identify_product(image_path: str) -> dict:
    """
    Identify a product from an image using Gemini Vision
    Returns: {brand, model, category, year, confidence, components}
    """
    if not is_configured():
        return {"error": "Gemini API not configured"}

    try:
        # Read and encode image
        with open(image_path, 'rb') as f:
            image_data = f.read()

        image = Image.open(io.BytesIO(image_data))

        prompt = """Analyze this product image carefully and identify:

1. Brand name (e.g., Apple, Samsung, Sony)
2. Model name/number (e.g., iPhone 15 Pro, Galaxy S24)
3. Product category (smartphone, laptop, tablet, headphones, camera, etc.)
4. Approximate release year
5. List of known internal components for this specific product

Return ONLY valid JSON in this exact format:
{
    "brand": "Apple",
    "model": "iPhone 15 Pro",
    "category": "smartphone",
    "year": "2023",
    "confidence": 95,
    "components": [
        {"id": "cpu", "name": "A17 Pro Processor", "manufacturer": "TSMC"},
        {"id": "display", "name": "Super Retina XDR OLED Display", "manufacturer": "Samsung/LG"},
        {"id": "battery", "name": "Lithium-ion Battery 3274mAh", "manufacturer": "ATL/BYD"},
        {"id": "camera", "name": "48MP Main Camera Sensor", "manufacturer": "Sony"},
        {"id": "memory", "name": "8GB LPDDR5 RAM", "manufacturer": "SK Hynix/Micron"}
    ]
}

Be specific about component manufacturers when known. If unsure, provide best estimate."""

        response = client.models.generate_content(
            model="gemini-2.5-pro-preview-05-06",
            contents=[prompt, image]
        )

        # Parse JSON from response
        response_text = response.text.strip()

        # Handle markdown code blocks
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1])

        return json.loads(response_text)

    except json.JSONDecodeError as e:
        # Try to extract structured data from unstructured response
        return extract_product_info(response.text)
    except Exception as e:
        return {"error": str(e)}


def extract_product_info(raw_text: str) -> dict:
    """Fallback: Extract product info from unstructured text"""
    if not is_configured():
        return {"error": "Gemini API not configured"}

    try:
        prompt = f"""Extract product information from this text and return as valid JSON:

{raw_text}

Return format:
{{"brand": "...", "model": "...", "category": "...", "year": "...", "confidence": 0-100, "components": []}}"""

        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-05-20",
            contents=prompt
        )

        return json.loads(response.text.strip())
    except:
        return {
            "brand": "Unknown",
            "model": "Unknown",
            "category": "electronics",
            "year": "2024",
            "confidence": 30,
            "components": []
        }


def search_component_images(component_name: str, product_info: dict) -> list:
    """
    Use Gemini with Google Search grounding to find teardown/component images
    Returns: List of image URLs for the component
    """
    if not is_configured():
        return []

    try:
        grounding_tool = types.Tool(google_search=types.GoogleSearch())

        product_name = f"{product_info.get('brand', '')} {product_info.get('model', '')}"

        prompt = f"""Search for teardown or component images of: {component_name}
For product: {product_name}

Find high-quality images showing this specific component isolated or in a teardown.
Look for iFixit teardowns, technical review sites, and official documentation.

Return ONLY a JSON array of image URLs (max 3):
["url1", "url2", "url3"]

If no specific images found, return an empty array: []"""

        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-05-20",
            contents=prompt,
            config=types.GenerateContentConfig(tools=[grounding_tool])
        )

        # Parse URLs from response
        text = response.text.strip()
        if text.startswith('['):
            return json.loads(text)
        return []

    except Exception as e:
        print(f"Error searching component images: {e}")
        return []


def research_supply_chain(component: dict, product_info: dict) -> dict:
    """
    Research supply chain data for a component using Gemini with Google Search grounding
    Returns: Manufacturing locations, suppliers, raw materials, etc.
    """
    if not is_configured():
        return {"error": "Gemini API not configured"}

    try:
        grounding_tool = types.Tool(google_search=types.GoogleSearch())

        component_name = component.get('name', component.get('id', 'Unknown'))
        manufacturer = component.get('manufacturer', 'Unknown')
        product_name = f"{product_info.get('brand', '')} {product_info.get('model', '')}"

        prompt = f"""Research the supply chain for this electronic component:

Component: {component_name}
Manufacturer: {manufacturer}
Used in: {product_name}

Find and return:
1. Primary manufacturing locations (factory name, city, country)
2. Key suppliers in the supply chain
3. Raw materials required and their source countries
4. Any sustainability certifications (ISO 14001, RoHS, etc.)

Focus on verifiable information from:
- Company sustainability reports
- Industry analysis
- News articles about supply chain
- Official company statements

Return ONLY valid JSON:
{{
    "component_id": "{component.get('id', 'unknown')}",
    "component_name": "{component_name}",
    "manufacturer": "{manufacturer}",
    "manufacturing_locations": [
        {{"facility": "TSMC Fab 18", "city": "Tainan", "country": "Taiwan", "type": "chip_fabrication"}}
    ],
    "suppliers": [
        {{"name": "ASML", "provides": "EUV Lithography Machines", "country": "Netherlands"}}
    ],
    "raw_materials": [
        {{"material": "Silicon", "source_country": "China", "source_region": "Xinjiang"}},
        {{"material": "Rare Earth Elements", "source_country": "China", "source_region": "Inner Mongolia"}}
    ],
    "certifications": ["ISO 14001", "RoHS"],
    "sustainability_notes": "Brief notes about sustainability practices"
}}"""

        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-05-20",
            contents=prompt,
            config=types.GenerateContentConfig(tools=[grounding_tool])
        )

        # Parse response
        text = response.text.strip()
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1])

        data = json.loads(text)

        # Extract source citations if available
        try:
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    metadata = candidate.grounding_metadata
                    if hasattr(metadata, 'grounding_chunks'):
                        data['sources'] = [
                            {
                                "url": chunk.web.uri if hasattr(chunk, 'web') else "",
                                "title": chunk.web.title if hasattr(chunk.web, 'title') else ""
                            }
                            for chunk in metadata.grounding_chunks[:5]
                        ]
        except:
            pass

        return data

    except json.JSONDecodeError:
        return {
            "component_id": component.get('id', 'unknown'),
            "component_name": component.get('name', 'Unknown'),
            "error": "Could not parse supply chain data"
        }
    except Exception as e:
        return {
            "component_id": component.get('id', 'unknown'),
            "error": str(e)
        }


def estimate_component_positions(components: list, product_info: dict) -> list:
    """
    Use Gemini to estimate 3D positions of components within a product
    Returns: Components with position data
    """
    if not is_configured():
        return components

    try:
        category = product_info.get('category', 'smartphone')

        prompt = f"""For a {category} ({product_info.get('brand', '')} {product_info.get('model', '')}),
estimate the 3D positions of these internal components in a normalized coordinate system (-1 to 1):

Components: {json.dumps([c.get('name', c.get('id')) for c in components])}

Consider typical {category} internal layout:
- Screen at front (positive Z)
- Battery usually takes large central area
- Processor/CPU typically center
- Camera modules at top corners
- Memory near processor

Return JSON array with positions:
[
    {{"id": "cpu", "position": [0, 0, 0], "scale": [0.15, 0.15, 0.02]}},
    {{"id": "battery", "position": [0, -0.2, -0.02], "scale": [0.4, 0.5, 0.03]}}
]

Use realistic proportions for a {category}."""

        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-05-20",
            contents=prompt
        )

        text = response.text.strip()
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1])

        positions = json.loads(text)

        # Merge positions with component data
        position_map = {p['id']: p for p in positions}
        for comp in components:
            if comp['id'] in position_map:
                comp['position'] = position_map[comp['id']].get('position', [0, 0, 0])
                comp['scale'] = position_map[comp['id']].get('scale', [0.1, 0.1, 0.1])

        return components

    except Exception as e:
        # Default positions if estimation fails
        default_positions = [
            [0, 0.3, 0.05],      # Display - top front
            [0, 0, 0],           # CPU - center
            [0, -0.2, 0],        # Battery - lower center
            [-0.3, 0.35, 0.05],  # Camera - top left
            [0.1, 0.05, 0],      # Memory - near CPU
        ]

        for i, comp in enumerate(components):
            if 'position' not in comp:
                comp['position'] = default_positions[i % len(default_positions)]
                comp['scale'] = [0.1, 0.1, 0.05]

        return components
