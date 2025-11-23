"""
Cache Management Route
"""

from flask import Blueprint, request, jsonify, current_app
import os
import glob

cache_bp = Blueprint('cache', __name__)

@cache_bp.route('/clear-cache', methods=['POST'])
def clear_cache():
    """
    Clear all cached data (3D models, supply chain data, etc.)
    """
    try:
        cache_folder = current_app.config['CACHE_FOLDER']
        
        # Count files before deletion
        files = glob.glob(os.path.join(cache_folder, '*'))
        count = len(files)
        
        # Delete all cache files
        for file in files:
            try:
                os.remove(file)
            except Exception as e:
                print(f"Failed to delete {file}: {e}")
        
        return jsonify({
            'success': True,
            'message': f'Cleared {count} cached files',
            'deleted_count': count
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
