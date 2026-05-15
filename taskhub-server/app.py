# taskhub-server/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from auth import require_auth, supabase

app = Flask(__name__)

# Allow Next.js frontend (running on localhost:3000) to communicate with this API
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Initialize Rate Limiter
# Note: Using "memory://" for local testing. For production, you would swap this to a Redis URL.
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per minute"], # Assignment requirement: 100 standard requests/minute
    storage_uri="memory://" 
)

# ==========================================
# ROUTES
# ==========================================

# 1. Public Health Check Route
@app.route('/api/health', methods=['GET'])
# Exempt from default rate limits just for testing ease
@limiter.exempt 
def health_check():
    return jsonify({"status": "healthy", "message": "TaskHub API is running."}), 200


# 2. Protected User Route (Standard Rate Limit: 100/min)
@app.route('/api/me', methods=['GET'])
@require_auth
def get_my_profile():
    # request.user is populated by the @require_auth decorator!
    return jsonify({
        "message": "Authentication successful",
        "user_id": request.user.id,
        "email": request.user.email
    }), 200


# 3. AI Generation Route (Strict Rate Limit: 5/hour)
@app.route('/api/generate', methods=['POST'])
@require_auth
@limiter.limit("5 per hour") # Assignment requirement: Override default for AI routes
def trigger_ai_generation():
    # We will build the actual AI logic in Day 3!
    return jsonify({
        "message": "AI generation job queued",
        "job_id": "placeholder_id",
        "user": request.user.id
    }), 202

if __name__ == '__main__':
    # Run the server on port 5000
    app.run(debug=True, port=5000)