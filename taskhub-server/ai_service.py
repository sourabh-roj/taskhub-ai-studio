# taskhub-server/ai_service.py
import requests
import urllib.parse
from auth import supabase

def generate_image_background_task(task_id: str, prompt: str, user_id: str):
    try:
        print(f"\n[DEBUG] ---------------------------------")
        print(f"[DEBUG] Using Pollinations AI (No Token Required!)")
        print(f"[DEBUG] ---------------------------------\n")
        
        print(f"[BACKGROUND] Starting REAL AI job for task: {task_id}")
        supabase.table('tasks').update({"status": "processing"}).eq('id', task_id).execute()
        
        print(f"[BACKGROUND] Asking AI to draw: '{prompt}'...")
        
        # Pollinations AI is incredibly simple: we just safely encode the prompt into the URL!
        encoded_prompt = urllib.parse.quote(prompt)
        ai_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
        
        # We use a GET request instead of a POST request for this API
        response = requests.get(ai_url)
        
        if response.status_code != 200:
            raise Exception(f"AI API Failed with status: {response.status_code}")
            
        image_bytes = response.content 
        
        print(f"[BACKGROUND] Image generated! Uploading to Supabase...")
        file_name = f"task_{task_id}.png"
        
        supabase.storage.from_("generated-images").upload(
            path=file_name,
            file=image_bytes,
            file_options={"content-type": "image/png"}
        )
        
        final_image_url = supabase.storage.from_("generated-images").get_public_url(file_name)
        
        supabase.table('generated_images').insert({
            "task_id": task_id,
            "image_url": final_image_url,
            "image_type": "creative_artistic", 
            "prompt_used": prompt,
            "status": "completed"
        }).execute()
        
        supabase.table('tasks').update({"status": "completed"}).eq('id', task_id).execute()
        
        print(f"[BACKGROUND] Job {task_id} 100% COMPLETED successfully!")

    except Exception as e:
        print(f"[BACKGROUND] ERROR in job {task_id}: {str(e)}")
        supabase.table('tasks').update({"status": "pending"}).eq('id', task_id).execute()