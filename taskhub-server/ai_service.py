import requests
import time
import random
from auth import supabase

def generate_image_background_task(task_id: str, generation_id: str, prompt: str, image_type: str, original_image: str):
    """
    Background worker using the FREE Pollinations AI (Text-to-Image)
    """
    try:
        print(f"\n[BACKGROUND] Starting {image_type} for Task {task_id}")
        
        # 1. GENERATE USING FREE TEXT-TO-IMAGE
        # We combine your custom prompt with high-quality keywords
        full_prompt = f"{prompt}, professional product photography, 8k resolution, photorealistic studio lighting"
        print(f"[BACKGROUND] Asking Pollinations to generate: '{full_prompt}'...")
        
        encoded_prompt = requests.utils.quote(full_prompt)
        random_seed = random.randint(1, 1000000)
        
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={random_seed}&width=1024&height=1024&nologo=true"
        
        response = requests.get(image_url)
        if response.status_code != 200:
            raise Exception("Failed to download image from AI provider.")
            
        image_bytes = response.content 
        
        # 2. UPLOAD TO SUPABASE STORAGE
        print(f"[BACKGROUND] Uploading {image_type} to Supabase...")
        file_name = f"task_{task_id}_{image_type}_{int(time.time())}.png"
        
        supabase.storage.from_("generated-images").upload(
            path=file_name,
            file=image_bytes,
            file_options={"content-type": "image/png"}
        )
        
        final_image_url = supabase.storage.from_("generated-images").get_public_url(file_name)
        
        # 3. UPDATE THE CHECKLIST ROW
        supabase.table('generated_images').update({
            "image_url": final_image_url,
            "status": "completed"
        }).eq('id', generation_id).execute()
        
        # Mark parent task as in-progress
        supabase.table('tasks').update({"status": "in_progress"}).eq('id', task_id).execute()
        
        print(f"[BACKGROUND] ✅ {image_type} COMPLETED successfully!")

    except Exception as e:
        print(f"[BACKGROUND] ❌ ERROR in {image_type}: {str(e)}")
        supabase.table('generated_images').update({"status": "failed"}).eq('id', generation_id).execute()