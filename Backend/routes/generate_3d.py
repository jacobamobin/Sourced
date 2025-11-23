"""
3D Model Generation Route
Uses Gemini to procedurally generate high-fidelity component breakdowns
simulating a "SAM 3D" experience for complex supply chain visualization.
"""

from flask import Blueprint, request, jsonify, current_app
import os
import json
import time
import google.generativeai as genai
from services.gemini_service import get_gemini_model

generate_3d_bp = Blueprint('generate_3d', __name__)

def generate_complex_components(image_path: str, product_info: dict) -> dict:
    """
    Use Gemini to analyze the product image and generate a detailed
    list of internal components with estimated 3D positions.
    """
    try:
        gemini_model = get_gemini_model()
        
        # Load image
        if not os.path.exists(image_path):
            return {"error": "Image not found"}
            
        import PIL.Image
        img = PIL.Image.open(image_path)
        
        brand = product_info.get('brand', 'Unknown')
        product_model = product_info.get('model', 'Device')
        category = product_info.get('category', 'smartphone')
        
        # Dynamic prompt construction based on category
        base_prompt = f"""
        Analyze this {brand} {product_model} ({category}) and generate a PHOTOREALISTIC 3D component layout based on ACTUAL TEARDOWNS.
        
        CRITICAL RULES:
        1. DO NOT use the original product image/appearance for internal components
        2. Generate components based on REAL teardown data (iFixit, etc.)
        3. Use varied geometry types - NOT just boxes/cubes
        4. Only the OUTER SHELL should represent the actual device appearance
        5. Internal components should look like ACTUAL parts with proper materials
        
        Research the real internal structure of this specific device model and create components that match its TRUE LAYOUT:
        
        POSITIONING COORDINATE SYSTEM:
        - X: -0.4 to +0.4 (left to right, 0 is center)
        - Y: -0.6 to +0.6 (bottom to top, 0 is center)
        - Z: -0.06 (rear/bottom) → 0.00 (center) → +0.04 (front/top)
        
        CRITICAL POSITIONING RULES:
        1. Components MUST NOT overlap - space them appropriately
        2. Use FULL coordinate range - don't cluster everything in center
        3. Position based on ACTUAL device layout from teardowns
        
        REQUIRED COMPONENTS (30-60 parts) with ACCURATE proportions and GEOMETRY:
        
        MANDATORY: You MUST include a "Shell", "Body", "Chassis", or "Frame" component that represents the EXTERIOR of the object.
        
        IMPORTANT: Adjust component types based on the category '{category}'.
        
        IF AUTOMOTIVE/CAR:
        - Chassis/Body: geometry "box" or "roundedBox", large scale (this is the SHELL)
        - Wheels: geometry "cylinder", rotation [0, 0, 1.5708], 4 positions
        - Engine Block: geometry "box", detailed, front/rear position
        - Seats: geometry "roundedBox" or "capsule"
        - Steering Wheel: geometry "torus"
        - Windows: geometry "box", thin, transparent
        - Exhaust: geometry "cylinder"
        - Suspension: geometry "cylinder" or "capsule"
        
        IF ELECTRONICS (Phone/Laptop):
        - Main Housing/Shell: geometry "roundedBox", large scale (this is the SHELL)
        - Display Assembly: geometry "box", thin
        - Logic Board: geometry "box", green/blue PCB
        - Battery: geometry "box", black/grey
        - Chips: geometry "roundedBox", black
        - Connectors: geometry "box" or "capsule"
        
        IF CLOTHING/FOOTWEAR:
        - Main Body/Upper: geometry "roundedBox" or "capsule" (this is the SHELL)
        - Sole: geometry "roundedBox", bottom
        - Laces: geometry "cylinder", thin
        - Insoles: geometry "box", thin
        
        Use REALISTIC DEVICE-SPECIFIC COLORS.
        
        GEOMETRY TYPES (choose appropriate shape for each part):
        - "box" - rectangular (display, battery, PCB, frame segments, chassis)
        - "cylinder" - round (wheels, camera lens, screws, ports, buttons, exhaust)
        - "sphere" - ball-shaped (smaller chips, connectors, joints)
        - "capsule" - rounded cylinder (speakers, microphones, battery cells, seats, tanks)
        - "roundedBox" - smooth edges (main processor, larger chips, body panels)
        - "torus" - ring-shaped (speaker grills, camera rings, steering wheels, tires)
        
        Output ONLY valid JSON (no markdown):
        {{
            "device_type": "{category}",
            "components": [
                {{
                    "id": "unique_id",
                    "name": "Specific Part (e.g. 'V6 Engine Block', 'Front Left Tire')",
                    "position": [x, y, z],
                    "scale": [w, h, d],
                    "geometry": "box|cylinder|sphere|capsule|roundedBox|torus",
                    "material": "type",
                    "type": "category",
                    "color": "#hex",
                    "rotation": [rx, ry, rz]
                }}
            ]
        }}
        """
        
        response = gemini_model.generate_content([base_prompt, img])
        text = response.text
        
        # Extract JSON
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != -1:
            json_str = text[start:end]
            return json.loads(json_str)
            
        return {"error": "Failed to parse Gemini response"}
        
    except Exception as e:
        print(f"Error generating components: {e}")
        return {"error": str(e)}

def generate_placeholder_model(image_id: str, product_info: dict = None) -> dict:
    """
    Generate a placeholder/demo 3D model response
    Used when Gemini generation fails or for quick demos
    """
    category = product_info.get('category', 'smartphone') if product_info else 'smartphone'

    # Component positions vary by device type
    component_configs = {
        'smartphone': [
            {"id": "display", "name": "Display Screen", "position": [0, 0.3, 0.04], "scale": [0.35, 0.7, 0.01], "geometry": "box", "color": "#1a1a2e", "internal": False},
            {"id": "cpu", "name": "Processor", "position": [0, 0.1, 0], "scale": [0.08, 0.08, 0.02], "geometry": "roundedBox", "color": "#4a5568", "internal": True},
            {"id": "battery", "name": "Battery", "position": [0, -0.15, 0], "scale": [0.3, 0.35, 0.03], "geometry": "box", "color": "#2d3748", "internal": True},
            {"id": "camera", "name": "Camera Module", "position": [-0.12, 0.55, 0.03], "scale": [0.12, 0.12, 0.02], "geometry": "cylinder", "rotation": [1.5708, 0, 0], "color": "#1a202c", "internal": False},
            {"id": "memory", "name": "RAM Module", "position": [0.08, 0.15, 0], "scale": [0.06, 0.04, 0.01], "geometry": "box", "color": "#718096", "internal": True},
        ]
    }

    components = component_configs.get(category, component_configs['smartphone'])

    return {
        "model_url": f"/models/{image_id}.glb",
        "model_type": "placeholder",
        "components": components,
        "device_type": category,
        "bounds": {
            "width": 0.4 if category == 'smartphone' else 0.8,
            "height": 0.8 if category == 'smartphone' else 0.6,
            "depth": 0.08
        }
    }

def enrich_sam_components(sam_components: list, product_info: dict) -> list:
    """
    Use Gemini to assign meaningful names and geometry types to SAM-detected components
    based on their relative positions and sizes.
    """
    try:
        gemini_model = get_gemini_model()
        category = product_info.get('category', 'device')
        brand = product_info.get('brand', 'Unknown')
        model = product_info.get('model', 'Product')
        
        # Create a simplified representation of components for the prompt
        comp_list_str = json.dumps([{
            "id": c["id"],
            "position_x": round(c["position"][0], 2),
            "position_y": round(c["position"][1], 2),
            "width": round(c["scale"][0], 2),
            "height": round(c["scale"][1], 2)
        } for c in sam_components], indent=2)
        
        prompt = f"""
        I have analyzed an image of a {brand} {model} ({category}) and detected {len(sam_components)} internal components using AI segmentation.
        
        Here is the list of detected components with their normalized 2D positions (x, y from -1 to 1) and sizes (width, height from 0 to 1):
        {comp_list_str}
        
        Your task is to IDENTIFY what each component likely is based on its position and size in a typical {category}, and assign it a 3D geometry type.
        
        CRITICAL VISUAL RULES (INDUSTRIAL DESIGN):
        1. **NO GENERIC BOXES:** Unless it is a screen or battery, DO NOT use "box".
        2. **USE "roundedBox"** for chips, boards, modules, and cases. It looks much more premium.
        3. **USE "cylinder"** for ANY circular part (wheels, fans, capacitors, screws, lenses).
        4. **USE "torus"** for tires, rings, gaskets, or circular frames.
        5. **USE "capsule"** for tanks, handles, or organic shapes.
        
        ACCURACY RULES:
        1. **ROTATION IS KEY:** 
           - Wheels/Tires MUST be rotated [0, 0, 1.5708] (90 deg on Z) to face outward.
           - Steering wheels/Rings MUST be rotated [1.5708, 0, 0] (90 deg on X) to face up/forward.
        2. **NAMING:** Use specific, technical names (e.g., "A15 Bionic", "Li-Ion Cell", "V8 Block", "Brembo Caliper").
        3. **MATERIALS:** Assign "metal", "glass", "plastic", "silicon", "battery", "pcb" correctly.
        
        GEOMETRY & MATERIAL MAPPING:
        - Wheels -> "cylinder" (rotated) OR "torus" (for the tire part), material: "plastic" (rubber)
        - Chips -> "roundedBox", material: "silicon", color: "#111827"
        - PCB -> "roundedBox", material: "pcb", color: "#064e3b"
        - Battery -> "box", material: "battery", color: "#0f172a"
        - Lens -> "cylinder", material: "glass", color: "#e2e8f0"
        - Frame -> "roundedBox" or "capsule", material: "metal", color: "#64748b"
        
        Return a JSON object mapping component IDs to their new attributes:
        {{
            "sam_0": {{ "name": "...", "geometry": "...", "material": "...", "color": "...", "rotation": [x, y, z] }},
            "sam_1": {{ ... }}
        }}
        """
        
        response = gemini_model.generate_content(prompt)
        text = response.text
        
        # Extract JSON
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != -1:
            enrichment_map = json.loads(text[start:end])
            
            # Apply enrichment
            enriched_components = []
            for comp in sam_components:
                if comp["id"] in enrichment_map:
                    attrs = enrichment_map[comp["id"]]
                    comp["name"] = attrs.get("name", comp["name"])
                    comp["geometry"] = attrs.get("geometry", "box")
                    comp["color"] = attrs.get("color", "#888888")
                    
                    # Special handling for wheels/cylinders to rotate them correctly
                    if comp["geometry"] == "cylinder" and ("wheel" in comp["name"].lower() or "tire" in comp["name"].lower()):
                        comp["rotation"] = [0, 0, 1.5708] # Rotate to face outward
                    elif comp["geometry"] == "torus":
                        comp["rotation"] = [1.5708, 0, 0]
                        
                enriched_components.append(comp)
            return enriched_components
            
        return sam_components # Return original if parsing fails
        
    except Exception as e:
        print(f"Error enriching SAM components: {e}")
        return sam_components

@generate_3d_bp.route('/generate-3d', methods=['POST'])
def generate_3d():
    """
    Generate detailed 3D model data from uploaded image
    """
    data = request.get_json()

    if not data or 'image_id' not in data:
        return jsonify({'error': 'image_id is required'}), 400

    image_id = data['image_id']
    product_info = data.get('product_info', {})
    force_regenerate = data.get('force_regenerate', False)

    # Check if image exists
    upload_folder = current_app.config['UPLOAD_FOLDER']
    image_path = os.path.join(upload_folder, f"{image_id}.jpg")

    if not os.path.exists(image_path):
        # Try png if jpg doesn't exist
        image_path = os.path.join(upload_folder, f"{image_id}.png")
        if not os.path.exists(image_path):
            return jsonify({'error': 'Image not found'}), 404

    # Check cache
    cache_folder = current_app.config['CACHE_FOLDER']
    cache_path = os.path.join(cache_folder, f"{image_id}_complex_3d.json")

    if os.path.exists(cache_path) and not force_regenerate:
        with open(cache_path, 'r') as f:
            cached_result = json.load(f)
        cached_result['cached'] = True
        return jsonify(cached_result)

    start_time = time.time()

    # Check for local SAM 3D availability
    # Always try to use local SAM first (it will fall back to Gemini if it fails or isn't installed)
    use_local_sam = True
    
    if use_local_sam:
        try:
            print("Attempting to use local SAM 3D service...")
            from services.sam3d_service import sam_service
            sam_components = sam_service.generate_3d_masks(image_path)
            
            # Only use SAM if it found multiple meaningful components (not just the whole object)
            if sam_components and len(sam_components) >= 5:
                # Enrich SAM components with Gemini understanding
                print(f"SAM found {len(sam_components)} components. Enriching with Gemini...")
                enriched_components = enrich_sam_components(sam_components, product_info)
                
                result = {
                    "device_type": product_info.get('category', 'device'),
                    "components": enriched_components,
                    "method": "local_sam_base_plus_gemini",
                    "processing_time": time.time() - start_time,
                    "cached": False
                }
                
                # Cache result
                with open(cache_path, 'w') as f:
                    json.dump(result, f, indent=2)
                    
                return jsonify(result)
            else:
                print(f"Local SAM only found {len(sam_components) if sam_components else 0} components (need 5+), falling back to Gemini procedural generation")
                
        except Exception as e:
            print(f"Local SAM failed with error: {e}")
            import traceback
            traceback.print_exc()
            print("Falling back to Gemini procedural generation")
            # Fallthrough to Gemini procedural generation

    # Generate complex components using Gemini
    result = generate_complex_components(image_path, product_info)
    
    if "error" in result:
        # Fallback to simple placeholder if Gemini fails
        print(f"Gemini generation failed: {result['error']}")
        # Fallback
        result = generate_placeholder_model(image_id, product_info)
        result['note'] = 'Using placeholder model due to generation error.'

    result['processing_time'] = time.time() - start_time
    result['cached'] = False
    result['method'] = 'gemini_procedural'
    result['model_url'] = None # We are rendering procedurally, not loading a GLB

    # Cache result
    with open(cache_path, 'w') as f:
        json.dump(result, f, indent=2)

    return jsonify(result)

@generate_3d_bp.route('/generate-3d/status', methods=['GET'])
def generation_status():
    return jsonify({
        'sam3d_available': True, # We simulate this now
        'methods_available': ['gemini_procedural'],
        'recommended_method': 'gemini_procedural'
    })

@generate_3d_bp.route('/components', methods=['POST'])
def generate_components():
    """
    Generate 3D models for internal components using Gemini + SAM 3D
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    product_info = data.get('product_info', {})
    components = data.get('components', [])

    if not components:
        return jsonify({'error': 'No components provided'}), 400

    from services.gemini_service import estimate_component_positions, is_configured

    if is_configured():
        # Use Gemini to estimate positions
        positioned_components = estimate_component_positions(components, product_info)
    else:
        # Default positions
        default_positions = [
            {"position": [0, 0.3, 0.04], "scale": [0.35, 0.7, 0.01]},
            {"position": [0, 0.1, 0], "scale": [0.08, 0.08, 0.02]},
            {"position": [0, -0.15, 0], "scale": [0.3, 0.35, 0.03]},
            {"position": [-0.12, 0.55, 0.03], "scale": [0.12, 0.12, 0.02]},
            {"position": [0.08, 0.15, 0], "scale": [0.06, 0.04, 0.01]},
        ]

        positioned_components = []
        for i, comp in enumerate(components):
            pos_data = default_positions[i % len(default_positions)]
            positioned_components.append({
                **comp,
                "position": pos_data["position"],
                "scale": pos_data["scale"],
                "model_url": None,
                "color": ["#4a5568", "#2d3748", "#718096", "#1a202c", "#4a5568"][i % 5]
            })

    return jsonify({
        'components': positioned_components,
        'total': len(positioned_components),
        'has_3d_models': False,
        'method': 'gemini_positioning' if is_configured() else 'default_positioning'
    })
