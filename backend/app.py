"""
TOS Helper Backend API
Flask server that analyzes Terms of Service using OpenAI
"""

import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from analyzer import analyze_tos

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS for Chrome extension origins
# Allow both localhost (dev) and chrome-extension protocol (production)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "chrome-extension://*",  # Chrome extensions
            "http://localhost:*",     # Local development
            "http://127.0.0.1:*"      # Local development alternative
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Configuration
DUMMY_ANALYSIS = os.getenv('DUMMY_ANALYSIS', 'false').lower() == 'true'
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

# Helper function for dummy mode
def load_dummy_analysis():
    """Load dummy analysis from JSON file for testing"""
    dummy_file = os.path.join(os.path.dirname(__file__), 'dummy_analysis.json')
    with open(dummy_file, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    print("[HEALTH CHECK] Endpoint pinged")
    return jsonify({
        'status': 'healthy',
        'model': OPENAI_MODEL,
        'dummy_mode': DUMMY_ANALYSIS
    })

@app.route('/api/analyze', methods=['POST'])
def analyze_tos_endpoint():
    """
    Analyze Terms of Service text using OpenAI
    
    Request body:
    {
        "text": "TOS content...",
        "url": "https://example.com/terms"
    }
    
    Returns:
    {
        "overview": [...],
        "risks": [...],
        "dataSharing": {...},
        "examples": [...],
        "scores": {...},
        "overallScore": 0-100,
        "riskLevel": "low|medium|high",
        "explanation": "..."
    }
    """
    try:
        # Validate request
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        tos_text = data.get('text', '')
        url = data.get('url', 'Unknown')
        
        if not tos_text:
            return jsonify({'error': 'No TOS text provided'}), 400
        
        # Return dummy data if in dummy mode
        if DUMMY_ANALYSIS:
            print("[DUMMY MODE] Returning test analysis from dummy_analysis.json")
            analysis = load_dummy_analysis()
            return jsonify(analysis)
        
        # Call analyzer module with new signature
        analysis = analyze_tos(
            tos_text=tos_text,
            url=url,
            model=OPENAI_MODEL
        )
        
        return jsonify(analysis)
    
    except ValueError as e:
        print(f"Validation error: {e}")
        return jsonify({'error': str(e)}), 400
    
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        return jsonify({'error': 'Failed to parse LLM response'}), 500
    
    except Exception as e:
        print(f"Error analyzing TOS: {e}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.getenv('BACKEND_PORT', 5000))
    debug = os.getenv('FLASK_ENV', 'production') == 'development'
    
    print(f"Starting TOS Helper API on port {port}")
    if DUMMY_ANALYSIS:
        print(f"Dummy Analysis Mode: ENABLED (using dummy_analysis.json)")
    else:
        print(f"OpenAI Model: {OPENAI_MODEL}")
    print(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
