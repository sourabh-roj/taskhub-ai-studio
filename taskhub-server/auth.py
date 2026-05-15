# taskhub-server/auth.py
from functools import wraps
from flask import request, jsonify
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize the Supabase Admin Client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # 1. Look for the token in the headers
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid authorization header"}), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            # 2. Verify the token with Supabase
            user_response = supabase.auth.get_user(token)
            if not user_response.user:
                return jsonify({"error": "Invalid token"}), 401
            
            # 3. Attach the user object to the request context so our routes can use it
            request.user = user_response.user
        except Exception as e:
            return jsonify({"error": str(e)}), 401
            
        return f(*args, **kwargs)
    return decorated