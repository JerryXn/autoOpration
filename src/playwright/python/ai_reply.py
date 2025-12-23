import os
import requests
import json
import time
from db import get_bot_config, save_ai_log

def get_coze_reply(query, user_id="auto_op_user", industry="", note_id=""):
    # Try fetching from DB first
    # If industry is not provided, try env
    if not industry:
        industry = os.environ.get('CURRENT_INDUSTRY', 'insurance')
        
    config = get_bot_config(industry=industry, platform='coze')
    
    if config:
        token = config['token']
        bot_id = config['bot_id']
    else:
        # Fallback to env vars (legacy support)
        token = os.getenv("COZE_API_TOKEN")
        bot_id = os.getenv("COZE_BOT_ID")
    
    if not token or not bot_id:
        print(f"[ai] Missing config for industry={industry} and no env fallback")
        return None

    url = "https://api.coze.cn/open_api/v2/chat"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Host": "api.coze.cn",
        "Connection": "keep-alive"
    }
    
    payload = {
        "conversation_id": "123", # Can be dynamic
        "bot_id": bot_id,
        "user": user_id,
        "query": query,
        "stream": False
    }

    ai_response_text = None
    status = 'failed'
    error_msg = ''

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('code') == 0:
                messages = data.get('messages', [])
                for msg in messages:
                    if msg.get('type') == 'answer':
                        ai_response_text = msg.get('content')
                        status = 'success'
                        break
                if not ai_response_text:
                     error_msg = f"No answer in response: {data}"
            else:
                error_msg = f"API Error: {data}"
                print(f"[ai] {error_msg}")
        else:
            error_msg = f"HTTP Error: {resp.status_code} {resp.text}"
            print(f"[ai] {error_msg}")
    except Exception as e:
        error_msg = f"Request Exception: {str(e)}"
        print(f"[ai] {error_msg}")
    
    # Save log to DB
    if note_id:
        try:
            save_ai_log({
                'note_id': note_id,
                'bot_id': bot_id,
                'input_context': query, # The full query sent to AI
                'prompt_used': '', # We don't know the system prompt here as it's in Coze
                'ai_response': ai_response_text or '',
                'status': status,
                'error_msg': error_msg
            })
        except Exception as e:
            print(f"[ai] Failed to save log: {e}")

    return ai_response_text

