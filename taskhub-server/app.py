from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from auth import require_auth, supabase
import concurrent.futures
from ai_service import generate_image_background_task

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per minute"],
    storage_uri="memory://" 
)

executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)

@app.route('/api/health', methods=['GET'])
@limiter.exempt 
def health_check():
    return jsonify({"status": "healthy", "message": "TaskHub API is running."}), 200

@app.route('/api/generate', methods=['POST'])
@require_auth
@limiter.limit("50 per hour") 
def trigger_ai_generation():
    data = request.get_json()
    
    if not data or 'prompt' not in data or 'task_id' not in data or 'image_type' not in data:
        return jsonify({"error": "Missing required fields"}), 400
        
    task_id = data['task_id']
    prompt = data['prompt']
    image_type = data['image_type']
    original_image = data.get('original_image', '')
    
    try:
        # 1. Check if an image row already exists for this task and type
        existing = supabase.table('generated_images').select('id').eq('task_id', task_id).eq('image_type', image_type).execute()
        
        if existing.data and len(existing.data) > 0:
            # UPDATE existing row
            generation_id = existing.data[0]['id']
            supabase.table('generated_images').update({
                "prompt_used": prompt,
                "status": "processing",
                "image_url": "generating..." 
            }).eq('id', generation_id).execute()
        else:
            # INSERT new row
            insert_resp = supabase.table('generated_images').insert({
                "task_id": task_id,
                "image_type": image_type,
                "prompt_used": prompt,
                "status": "processing",
                "image_url": "generating..." 
            }).execute()
            generation_id = insert_resp.data[0]['id']
        
        # Fire background worker
        executor.submit(
            generate_image_background_task, 
            task_id, 
            generation_id, 
            prompt, 
            image_type, 
            original_image
        )
        
        return jsonify({
            "message": f"Started generating {image_type}",
            "status": "processing"
        }), 202
        
    except Exception as e:
        print(f"\n❌ BACKEND ERROR: {str(e)}\n") 
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)