# taskhub-server/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from auth import require_auth, supabase
import concurrent.futures
from ai_service import generate_image_background_task # NEW IMPORT

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per minute"],
    storage_uri="memory://" 
)

# NEW: Create a background thread pool
executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)

@app.route('/api/health', methods=['GET'])
@limiter.exempt 
def health_check():
    return jsonify({"status": "healthy", "message": "TaskHub API is running."}), 200

@app.route('/api/me', methods=['GET'])
@require_auth
def get_my_profile():
    return jsonify({
        "message": "Authentication successful",
        "user_id": request.user.id,
        "email": request.user.email
    }), 200

# UPDATED: The Generate Route
@app.route('/api/generate', methods=['POST'])
@require_auth
@limiter.limit("5 per hour") 
def trigger_ai_generation():
    data = request.get_json()
    
    # 1. Validate Input
    if not data or 'prompt' not in data:
        return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
    prompt = data['prompt']
    user_id = request.user.id
    
    try:
        # 2. Create the Initial Task in Supabase (Status: Pending)
        task_response = supabase.table('tasks').insert({
            "user_id": user_id,
            "title": f"AI Generation: {prompt[:20]}...",
            "description": "Triggered via API",
            "base_image_url": "none", # Adjust based on your schema requirements
            "status": "pending"
        }).execute()
        
        task_id = task_response.data[0]['id']
        
        # 3. Hand the heavy lifting off to the background thread!
        executor.submit(generate_image_background_task, task_id, prompt, user_id)
        
        # 4. Immediately return a success message to the frontend
        return jsonify({
            "message": "AI generation job queued successfully",
            "task_id": task_id,
            "status": "pending"
        }), 202
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)