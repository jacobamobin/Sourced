"""
Gemini API Service
Handles all interactions with Google's Gemini API
- Product identification (Vision)
- Component analysis
- Supply chain research
"""

import os
import json
from PIL import Image
import io

# Initialize Gemini client
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

try:
    import google.generativeai as genai

    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        vision_model = genai.GenerativeModel('gemini-1.5-flash')
    else:
        model = None
        vision_model = None
except ImportError:
    model = None
    vision_model = None
    genai = None


def is_configured():
    """Check if Gemini is properly configured"""
    return model is not None and GEMINI_API_KEY is not None


def identify_product(image_path: str) -> dict:
    """
    Identify a product from an image using Gemini Vision
    Returns: {brand, model, category, year, confidence, components}
    """
    if not is_configured():
        return {"error": "Gemini API not configured"}

    try:
        # Load image
        image = Image.open(image_path)

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

        response = vision_model.generate_content([prompt, image])

        # Parse JSON from response
        response_text = response.text.strip()

        # Handle markdown code blocks
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            # Remove first and last lines (```json and ```)
            response_text = '\n'.join(lines[1:-1])

        # Also handle if it starts with ```json
        if response_text.startswith('json'):
            response_text = response_text[4:].strip()

        return json.loads(response_text)

    except json.JSONDecodeError as e:
        # Try to extract structured data from unstructured response
        try:
            return extract_product_info(response.text)
        except:
            return {
                "brand": "Unknown",
                "model": "Unknown Product",
                "category": "electronics",
                "year": "2024",
                "confidence": 30,
                "components": [],
                "error": f"JSON parse error: {str(e)}"
            }
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

        response = model.generate_content(prompt)
        text = response.text.strip()

        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1])

        return json.loads(text)
    except:
        return {
            "brand": "Unknown",
            "model": "Unknown",
            "category": "electronics",
            "year": "2024",
            "confidence": 30,
            "components": []
        }


def research_supply_chain(component: dict, product_info: dict) -> dict:
    """
    Research supply chain data for a component using Gemini
    Returns: Manufacturing locations, suppliers, raw materials, etc.
    """
    if not is_configured():
        return {"error": "Gemini API not configured"}

    try:
        component_name = component.get('name', component.get('id', 'Unknown'))
        manufacturer = component.get('manufacturer', 'Unknown')
        product_name = f"{product_info.get('brand', '')} {product_info.get('model', '')}"

        prompt = f"""Research the supply chain for this electronic component:

Component: {component_name}
Manufacturer: {manufacturer}
Used in: {product_name}

Based on your knowledge, provide:
1. Primary manufacturing locations (factory name, city, country)
2. Key suppliers in the supply chain
3. Raw materials required and their typical source countries
4. Common sustainability certifications

Return ONLY valid JSON:
{{
    "component_id": "{component.get('id', 'unknown')}",
    "component_name": "{component_name}",
    "manufacturer": "{manufacturer}",
    "manufacturing_locations": [
        {{"facility": "Factory Name", "city": "City", "country": "Country", "type": "manufacturing"}}
    ],
    "suppliers": [
        {{"name": "Supplier Name", "provides": "What they provide", "country": "Country"}}
    ],
    "raw_materials": [
        {{"material": "Material Name", "source_country": "Country"}}
    ],
    "certifications": ["ISO 14001", "RoHS"],
    "sustainability_notes": "Brief notes about sustainability practices"
}}"""

        response = model.generate_content(prompt)

        # Parse response
        text = response.text.strip()
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1])
        if text.startswith('json'):
            text = text[4:].strip()

        return json.loads(text)

    except json.JSONDecodeError:
        return {
            "component_id": component.get('id', 'unknown'),
            "component_name": component.get('name', 'Unknown'),
            "manufacturing_locations": [],
            "suppliers": [],
            "raw_materials": [],
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

Return ONLY a JSON array with positions (no markdown, no explanation):
[
    {{"id": "cpu", "position": [0, 0, 0], "scale": [0.15, 0.15, 0.02]}},
    {{"id": "battery", "position": [0, -0.2, -0.02], "scale": [0.4, 0.5, 0.03]}}
]"""

        response = model.generate_content(prompt)

        text = response.text.strip()
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1])
        if text.startswith('json'):
            text = text[4:].strip()

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
