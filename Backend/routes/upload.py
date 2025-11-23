"""
Image Upload Route
Handles product image uploads with validation and preprocessing
"""

from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from PIL import Image
import hashlib
import os
import io

upload_bp = Blueprint('upload', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@upload_bp.route('/upload', methods=['POST'])
def upload_image():
    """
    Upload a product image for analysis

    Request: multipart/form-data with 'image' file
    Response: {image_id, preview_url, status}
    """
    # Debug logging
    print(f"Upload request received - Content-Type: {request.content_type}")
    print(f"Files in request: {list(request.files.keys())}")
    print(f"Form data: {list(request.form.keys())}")
    
    # Validate file presence
    if 'image' not in request.files:
        print("ERROR: No 'image' field in request.files")
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['image']

    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({
            'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'
        }), 400

    try:
        # Read file data
        image_data = file.read()

        # Generate unique hash for caching
        image_hash = hashlib.md5(image_data).hexdigest()

        # Process image
        image = Image.open(io.BytesIO(image_data))

        # Convert to RGB if necessary (handles RGBA, P mode, etc.)
        if image.mode in ('RGBA', 'P', 'LA'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        # Resize if too large (max 2048px on longest side)
        max_size = 2048
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)

        # Save processed image
        filename = f"{image_hash}.jpg"
        upload_folder = current_app.config['UPLOAD_FOLDER']
        filepath = os.path.join(upload_folder, filename)

        image.save(filepath, 'JPEG', quality=95)

        # Get image dimensions
        width, height = image.size

        return jsonify({
            'image_id': image_hash,
            'preview_url': f'/uploads/{filename}',
            'width': width,
            'height': height,
            'status': 'ready'
        })

    except Exception as e:
        return jsonify({'error': f'Failed to process image: {str(e)}'}), 500


@upload_bp.route('/upload/<image_id>', methods=['GET'])
def get_upload_status(image_id):
    """
    Check if an uploaded image exists

    Response: {exists, preview_url}
    """
    upload_folder = current_app.config['UPLOAD_FOLDER']
    filepath = os.path.join(upload_folder, f"{image_id}.jpg")

    if os.path.exists(filepath):
        return jsonify({
            'exists': True,
            'preview_url': f'/uploads/{image_id}.jpg'
        })
    else:
        return jsonify({
            'exists': False
        }), 404
