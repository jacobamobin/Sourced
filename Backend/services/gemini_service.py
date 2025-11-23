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
        # Use Gemini 2.0 Flash for maximum speed and efficiency
        model = genai.GenerativeModel('gemini-2.0-flash')
        vision_model = genai.GenerativeModel('gemini-2.0-flash')
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


def get_gemini_model():
    """Get the initialized Gemini model"""
    return model


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

        prompt = """Analyze this product image carefully and identify it with EXTREME DETAIL.

1. Brand name
2. Model name/number
3. Product category
4. Approximate release year
5. A COMPREHENSIVE list of internal components (aim for 30-50+ distinct parts). Include everything from the main processor to specific sensors, connectors, screws, adhesives, and shielding.

Return ONLY valid JSON in this exact format:
{
    "brand": "Brand",
    "model": "Model",
    "category": "category",
    "year": "YYYY",
    "confidence": 95,
    "components": [
        {"id": "unique_id", "name": "Detailed Component Name", "manufacturer": "Specific Manufacturer"},
        ...
    ]
}

Be specific about manufacturers (e.g., 'Murata' for capacitors, 'Bosch' for sensors)."""

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
    # Fallback to batch implementation for single item to maintain consistency
    result = research_supply_chain_batch([component], product_info)
    return result[0] if result else {}

def research_supply_chain_batch(components: list, product_info: dict) -> list:
    """
    Research supply chain data for multiple components in a single Gemini call
    to improve performance and reduce API calls.
    """
    if not is_configured():
        return []

    try:
        product_name = f"{product_info.get('brand', '')} {product_info.get('model', '')}"
        
        # Prepare simplified component list for prompt
        comp_list_str = json.dumps([
            {
                "id": c.get('id'),
                "name": c.get('name'),
                "manufacturer": c.get('manufacturer', 'Unknown')
            } 
            for c in components
        ], indent=2)

        prompt = f"""Research the global supply chain for these components of a {product_name}.
        
        Components:
        {comp_list_str}
        
        For EACH component, provide:
        1. Likely manufacturing location (City, Country). BE SPECIFIC. Do not just say "China". Say "Shenzhen, China" or "Hsinchu, Taiwan".
        2. Key raw materials and their source countries.
        3. A short AI summary (2-3 sentences) explaining the supply chain complexity and ethical/environmental considerations for this specific component.
        
        Return a JSON ARRAY where each object matches this structure:
        {{
            "component_id": "id_from_input",
            "component_name": "name_from_input",
            "manufacturer": "manufacturer_from_input",
            "manufacturing_locations": [
                {{"facility": "Specific Factory Name", "city": "City", "country": "Country", "type": "manufacturing"}}
            ],
            "suppliers": [
                {{"name": "Supplier Name", "provides": "Material/Part", "country": "Country"}}
            ],
            "raw_materials": [
                {{"material": "Specific Material (e.g. Cobalt, Gold)", "source_country": "Country"}}
            ],
            "ai_summary": "Short explanation of supply chain complexity..."
        }}
        
        IMPORTANT:
        - The goal is to visualize a GLOBAL network. Use diverse real-world locations.
        - Include raw material sources from Africa, South America, Australia, etc.
        - Return ONLY the JSON array.
        """

        response = model.generate_content(prompt)
        
        # Parse response
        text = response.text.strip()
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1])
        if text.startswith('json'):
            text = text[4:].strip()
            
        results = json.loads(text)
        
        # Ensure we have a list
        if isinstance(results, dict):
            results = [results]
            
        return results

    except Exception as e:
        print(f"Batch supply chain error: {e}")
        # Return empty structures with error for each component
        return [{
            "component_id": c.get('id'),
            "error": "Failed to fetch data"
        } for c in components]


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


def generate_product_summary(product_info: dict, components: list) -> dict:
    """
    Generate a high-level AI summary of the product's supply chain complexity
    and environmental impact.
    """
    if not is_configured():
        return {
            "summary": "Gemini API not configured.",
            "complexity_score": 0,
            "sustainability_rating": "Unknown"
        }

    try:
        product_name = f"{product_info.get('brand', '')} {product_info.get('model', '')}"
        category = product_info.get('category', 'device')
        
        prompt = f"""
        Analyze the supply chain complexity and environmental impact of a {product_name} ({category}).
        
        Based on typical supply chains for this type of product (containing components like {', '.join([c.get('name', '') for c in components[:5]])}), provide:
        
        1. A concise Executive Summary (3-4 sentences) explaining the global nature of its production.
        2. A Complexity Score (1-100) based on the number of countries and specialized processes involved.
        3. A Sustainability Rating (Low/Medium/High) with a brief reason why.
        4. Key Ethical/Environmental Risks (bullet points).
        
        Return valid JSON:
        {{
            "summary": "Executive summary text...",
            "complexity_score": 85,
            "sustainability_rating": "Medium",
            "sustainability_reason": "Reasoning...",
            "key_risks": ["Risk 1", "Risk 2"]
        }}
        """
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1])
        if text.startswith('json'):
            text = text[4:].strip()
            
        return json.loads(text)
        
    except Exception as e:
        print(f"Error generating product summary: {e}")
        return {
            "summary": "Failed to generate summary.",
            "complexity_score": 0,
            "sustainability_rating": "Unknown",
            "key_risks": []
        }
