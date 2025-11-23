"""
Product Identification Route
Uses Gemini Vision to identify products and their components
"""

from flask import Blueprint, request, jsonify, current_app
import os
import json

from services.gemini_service import identify_product, is_configured

identify_bp = Blueprint('identify', __name__)


@identify_bp.route('/identify', methods=['POST'])
def identify():
    """
    Identify a product from an uploaded image using Gemini Vision

    Request: {image_id: string}
    Response: {brand, model, category, year, confidence, components[]}
    """
    if not is_configured():
        return jsonify({'error': 'Gemini API not configured. Set GEMINI_API_KEY environment variable.'}), 500

    data = request.get_json()

    if not data or 'image_id' not in data:
        return jsonify({'error': 'image_id is required'}), 400

    image_id = data['image_id']

    # Check if image exists
    upload_folder = current_app.config['UPLOAD_FOLDER']
    image_path = os.path.join(upload_folder, f"{image_id}.jpg")

    if not os.path.exists(image_path):
        return jsonify({'error': 'Image not found. Please upload first.'}), 404

    # Check cache
    cache_folder = current_app.config['CACHE_FOLDER']
    cache_path = os.path.join(cache_folder, f"{image_id}_identify.json")

    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            cached_result = json.load(f)
        cached_result['cached'] = True
        return jsonify(cached_result)

    # Identify product using Gemini
    result = identify_product(image_path)

    if 'error' in result:
        return jsonify(result), 500

    # Cache result
    with open(cache_path, 'w') as f:
        json.dump(result, f, indent=2)

    result['cached'] = False
    return jsonify(result)


@identify_bp.route('/identify/demo', methods=['GET'])
def identify_demo():
    """
    Return demo product data for testing without API calls

    Response: Example product identification data
    """
    return jsonify({
        "brand": "Apple",
        "model": "iPhone 15 Pro",
        "category": "smartphone",
        "year": "2023",
        "confidence": 95,
        "components": [
            {
                "id": "cpu",
                "name": "A17 Pro Processor",
                "manufacturer": "TSMC",
                "description": "3nm chip with 6-core CPU and 6-core GPU"
            },
            {
                "id": "display",
                "name": "Super Retina XDR OLED Display",
                "manufacturer": "Samsung Display",
                "description": "6.1-inch ProMotion display with 120Hz refresh rate"
            },
            {
                "id": "battery",
                "name": "Lithium-ion Battery",
                "manufacturer": "ATL/BYD",
                "description": "3274mAh internal battery"
            },
            {
                "id": "camera_main",
                "name": "48MP Main Camera Sensor",
                "manufacturer": "Sony",
                "description": "Sony IMX803 with 2nd gen sensor-shift OIS"
            },
            {
                "id": "memory",
                "name": "8GB LPDDR5 RAM",
                "manufacturer": "SK Hynix",
                "description": "High-speed mobile memory"
            },
            {
                "id": "storage",
                "name": "256GB NAND Flash",
                "manufacturer": "Kioxia",
                "description": "Internal storage module"
            },
            {
                "id": "modem",
                "name": "Qualcomm X70 5G Modem",
                "manufacturer": "Qualcomm",
                "description": "5G cellular connectivity"
            }
        ],
        "demo": True
    })
