"""
Supply Chain Transparency 3D Visualizer - Backend API
Built for Sheridan Datathon 2025
Theme: Data Science for Social Good (UN SDG 12: Responsible Consumption)
"""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

# Configuration - use absolute paths based on script location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.config.update(
    UPLOAD_FOLDER=os.path.join(BASE_DIR, 'uploads'),
    CACHE_FOLDER=os.path.join(BASE_DIR, 'cache'),
    MODELS_FOLDER=os.path.join(BASE_DIR, 'models'),
    MAX_CONTENT_LENGTH=16 * 1024 * 1024  # 16MB max upload
)

# Ensure directories exist
for folder in [app.config['UPLOAD_FOLDER'], app.config['CACHE_FOLDER'], app.config['MODELS_FOLDER']]:
    os.makedirs(folder, exist_ok=True)

# Import and register routes
from routes.upload import upload_bp
from routes.identify import identify_bp
from routes.generate_3d import generate_3d_bp
from routes.supply_chain import supply_chain_bp
from routes.cache import cache_bp

app.register_blueprint(upload_bp, url_prefix='/api')
app.register_blueprint(identify_bp, url_prefix='/api')
app.register_blueprint(generate_3d_bp, url_prefix='/api')
app.register_blueprint(supply_chain_bp, url_prefix='/api')
app.register_blueprint(cache_bp, url_prefix='/api')


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "project": "Supply Chain Transparency 3D Visualizer",
        "hackathon": "Sheridan Datathon 2025",
        "sdg": "12 - Responsible Consumption and Production",
        "gemini_configured": bool(os.environ.get('GEMINI_API_KEY')),
    })


@app.route('/', methods=['GET'])
def index():
    """Root endpoint with API documentation"""
    return jsonify({
        "message": "Supply Chain Transparency API",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/upload": "Upload product image",
            "POST /api/identify": "Identify product using Gemini Vision",
            "POST /api/generate-3d": "Generate 3D model using SAM 3D",
            "POST /api/components": "Discover internal components with 3D models",
            "POST /api/supply-chain": "Research supply chain data with Gemini grounding",
            "GET /uploads/<filename>": "Serve uploaded images",
            "GET /models/<filename>": "Serve generated 3D models",
            "GET /health": "Health check"
        }
    })


# Static file serving
@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """Serve uploaded images"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/models/<path:filename>')
def serve_model(filename):
    """Serve generated 3D models"""
    return send_from_directory(app.config['MODELS_FOLDER'], filename)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_ENV') != 'production'
    print(f"Starting Supply Chain Transparency API on port {port}")
    print(f"Gemini API configured: {bool(os.environ.get('GEMINI_API_KEY'))}")
    app.run(host='0.0.0.0', port=port, debug=debug)
