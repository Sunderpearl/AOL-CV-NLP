import os
import sys
import io
import time
import zipfile
import requests
import psutil
# pyrefly: ignore [missing-import]
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

app = Flask(__name__)
# Enable CORS for all routes so the frontend can query it from any local server origin
CORS(app)

# ── Global Model Declarations ───────────────────────────────────────────────
cv_model = None
nlp_model = None
nlp_tokenizer = None

# Class names for the ResNet-50 CV classifier (Freshness44 dataset)
CLASS_NAMES = [
    'Apple_Fresh', 'Apple_Rotten', 'Banana_Fresh', 'Banana_Rotten',
    'Bellpepper_Fresh', 'Bellpepper_Rotten', 'Bitter_Gourd_Fresh', 'Bitter_Gourd_Rotten',
    'Carrot_Fresh', 'Carrot_Rotten', 'Cucumber_Fresh', 'Cucumber_Rotten',
    'Grape_Fresh', 'Grape_Rotten', 'Grapes_Fresh', 'Grapes_Rotten',
    'Guava_Fresh', 'Guava_Rotten', 'Jujube_Fresh', 'Jujube_Rotten',
    'Kaki_Fresh', 'Kaki_Rotten', 'Lime_Fresh', 'Lime_Rotten',
    'Mango_Fresh', 'Mango_Rotten', 'Orange_Fresh', 'Orange_Rotten',
    'Papaya_Fresh', 'Papaya_Rotten', 'Peach_Fresh', 'Peach_Rotten',
    'Pear_Fresh', 'Pear_Rotten', 'Pomegranate_Fresh', 'Pomegranate_Rotten',
    'Potato_Fresh', 'Potato_Rotten', 'Strawberry_Fresh', 'Strawberry_Rotten',
    'Tomato_Fresh', 'Tomato_Rotten', 'Watermelon_Fresh', 'Watermelon_Rotten'
]

# Produce storage details and metadata mapping
PRODUCE_CONFIG = {
    "Apple": {"emoji": "🍎", "store": "in the refrigerator crisper drawer."},
    "Banana": {"emoji": "🍌", "store": "at room temperature (keep away from other fruits to slow ripening)."},
    "Bellpepper": {"emoji": "🫑", "store": "in the refrigerator in a plastic bag."},
    "Bitter_Gourd": {"emoji": "🥒", "store": "in the refrigerator in a paper bag."},
    "Carrot": {"emoji": "🥕", "store": "in a sealed container/bag in the refrigerator."},
    "Cucumber": {"emoji": "🥒", "store": "in the refrigerator crisper drawer (keep dry)."},
    "Grape": {"emoji": "🍇", "store": "in the refrigerator in a ventilated container."},
    "Grapes": {"emoji": "🍇", "store": "in the refrigerator in a ventilated container."},
    "Guava": {"emoji": "🍈", "store": "at room temperature to ripen, then move to the refrigerator."},
    "Jujube": {"emoji": "🍒", "store": "in the refrigerator crisper drawer."},
    "Kaki": {"emoji": "Persimmon Persimmon", "store": "at room temperature to ripen, then move to the refrigerator."},
    "Lime": {"emoji": "🍋", "store": "in the refrigerator to prevent drying out."},
    "Mango": {"emoji": "🥭", "store": "at room temperature until soft, then store in the refrigerator."},
    "Orange": {"emoji": "🍊", "store": "in a cool, dark place or in the refrigerator."},
    "Papaya": {"emoji": "🥭", "store": "at room temperature until yellow, then store in the refrigerator."},
    "Peach": {"emoji": "🍑", "store": "at room temperature until ripe, then store in the refrigerator."},
    "Pear": {"emoji": "🍐", "store": "at room temperature until ripe, then store in the refrigerator."},
    "Pomegranate": {"emoji": "🍎", "store": "in a cool place or in the refrigerator."},
    "Potato": {"emoji": "🥔", "store": "in a cool, dark, well-ventilated dry space (never inside the fridge)."},
    "Strawberry": {"emoji": "🍓", "store": "in the refrigerator. Do not wash until ready to consume."},
    "Tomato": {"emoji": "🍅", "store": "at room temperature away from direct sunlight (prevents mushiness)."},
    "Watermelon": {"emoji": "🍉", "store": "at room temperature (or in the refrigerator once cut)."}
}

# Image pre-processing transform for ResNet-50
img_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ── Load Models ──────────────────────────────────────────────────────────────
def initialize_cv_model():
    global cv_model
    print("Initializing ResNet-50 CV Model...")
    t0 = time.time()
    
    cv_dir = "/Users/sunderpearl/Downloads/AOL-CV-NLP-main/CVmodel"
    
    # Pack the unzipped folder into an in-memory zip file to load via torch.load
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for base, dirs, files in os.walk(cv_dir):
            for file in files:
                full_path = os.path.join(base, file)
                rel_path = os.path.relpath(full_path, cv_dir)
                if ".DS_Store" in file:
                    continue
                zinfo = zipfile.ZipInfo(os.path.join("archive", rel_path))
                zinfo.date_time = (2026, 1, 1, 0, 0, 0)
                with open(full_path, "rb") as f:
                    z.writestr(zinfo, f.read())
    buf.seek(0)
    
    state_dict = torch.load(buf, map_location=torch.device('cpu'))
    
    # Define custom architecture matching the saved weights
    model = models.resnet50(pretrained=False)
    model.fc = nn.Sequential(
        nn.Identity(),                  # fc[0]
        nn.Linear(2048, 512),           # fc[1]
        nn.ReLU(),                      # fc[2]
        nn.Dropout(0.5),                # fc[3]
        nn.Linear(512, 44)              # fc[4]
    )
    
    model.load_state_dict(state_dict)
    model.eval()
    cv_model = model
    print(f"CV Model loaded successfully in {time.time() - t0:.2f}s!")

use_ollama = False
ollama_model = "phi"

def initialize_nlp_model():
    global nlp_model, nlp_tokenizer, use_ollama, ollama_model
    print("Initializing NLP Model...")
    
    total_ram_gb = psutil.virtual_memory().total / (1024**3)
    print(f"Detected total system RAM: {total_ram_gb:.2f} GB")
    
    force_hf = os.getenv("FORCE_HF_MODEL", "0") == "1"
    
    if total_ram_gb < 12.0 and not force_hf:
        print("⚠️ Low memory environment detected (< 12GB RAM).")
        print("⚠️ Loading HuggingFace model on CPU will trigger Out-Of-Memory (SIGKILL) on this machine.")
        print("➡️ Attempting to fall back to local Ollama service (which runs quantized model efficiently)...")
        try:
            r = requests.get("http://localhost:11434/api/tags", timeout=3)
            if r.status_code == 200:
                print("✅ Ollama is running. Using Ollama for Chat!")
                use_ollama = True
                return
            else:
                print(f"❌ Ollama responded with status code: {r.status_code}")
        except Exception as e:
            print("❌ Could not connect to local Ollama service at http://localhost:11434.")
            print("Please make sure Ollama is running (e.g., run 'ollama run phi' or open the Ollama app).")
        print("Proceeding to try loading HuggingFace model anyway (this may cause crash)...")
        
    t0 = time.time()
    base_model_name = "microsoft/phi-2"
    adapter_model_dir = "/Users/sunderpearl/Downloads/AOL-CV-NLP-main/NLPmodel/phi2-fruit-freshness-lora"
    
    nlp_tokenizer = AutoTokenizer.from_pretrained(adapter_model_dir)
    if nlp_tokenizer.pad_token is None:
        nlp_tokenizer.pad_token = nlp_tokenizer.eos_token
        
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
        low_cpu_mem_usage=True
    )
    nlp_model = PeftModel.from_pretrained(base_model, adapter_model_dir)
    nlp_model.eval()
    print(f"NLP Model loaded successfully in {time.time() - t0:.2f}s!")

# ── API Endpoints ────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy", 
        "cv_loaded": cv_model is not None, 
        "nlp_loaded": (nlp_model is not None or use_ollama),
        "nlp_mode": "ollama" if use_ollama else "local_hf"
    })

@app.route('/api/freshness', methods=['POST'])
def predict_freshness():
    if cv_model is None:
        return jsonify({"error": "CV model is not loaded"}), 500
        
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400
        
    file = request.files['image']
    try:
        # Read and preprocess the image
        img = Image.open(file.stream).convert('RGB')
        input_tensor = img_transform(img).unsqueeze(0)
        
        # Perform inference
        with torch.no_grad():
            logits = cv_model(input_tensor)
            preds = torch.argmax(logits, dim=1).item()
            probabilities = torch.softmax(logits, dim=1)[0]
            confidence = probabilities[preds].item()
            
        class_name = CLASS_NAMES[preds]
        print(f"Prediction: {class_name} | Confidence: {confidence:.4f}")
        
        # Parse item and state
        if "_" in class_name:
            # Handle names like Bitter_Gourd_Fresh / Strawberry_Fresh
            parts = class_name.split("_")
            freshness_state = parts[-1].lower() # 'fresh' or 'rotten'
            item_key = "_".join(parts[:-1])     # 'Bitter_Gourd' / 'Strawberry'
            item_display_name = " ".join(parts[:-1]) # 'Bitter Gourd' / 'Strawberry'
        else:
            item_key = class_name
            item_display_name = class_name
            freshness_state = "fresh"
            
        config = PRODUCE_CONFIG.get(item_key, {"emoji": "🥬", "store": "in a cool place."})
        emoji = config["emoji"]
        store_recommendation = config["store"]
        
        # Format output payload structure matching chat.js expectations
        if freshness_state == "fresh":
            status = "fresh"
            # Scale score based on model confidence
            score = int(80 + confidence * 20)
            if score > 100: score = 100
            summary = f"Great news! This **{item_display_name}** looks very fresh! {emoji}"
            details = [
                {"label": "Color Quality", "value": "Vibrant and natural appearance"},
                {"label": "Surface", "value": "Firm texture, no deep bruising"},
                {"label": "Structure", "value": "Solid and structurally intact"},
                {"label": "Freshness Score", "value": f"{score}%"}
            ]
            recommendation = f"Excellent condition. Store {store_recommendation}"
        else:
            status = "spoiled"
            # Low score for spoiled state
            score = int((1 - confidence) * 35)
            if score < 5: score = 5
            summary = f"⚠️ This **{item_display_name}** shows signs of spoilage/rot."
            details = [
                {"label": "Color Quality", "value": "Discolored or showing spotting"},
                {"label": "Surface", "value": "Soft spots or minor wrinkling"},
                {"label": "Structure", "value": "Wilted or slightly compromised shape"},
                {"label": "Freshness Score", "value": f"{score}%"}
            ]
            recommendation = "Not recommended for consumption. Disposal or composting recommended."
            
        return jsonify({
            "itemName": item_display_name,
            "status": status,
            "score": score,
            "summary": summary,
            "details": details,
            "recommendation": recommendation
        })
        
    except Exception as e:
        print("Error processing image:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    if not use_ollama and (nlp_model is None or nlp_tokenizer is None):
        return jsonify({"error": "NLP model is not loaded"}), 500
        
    data = request.json
    if not data or 'message' not in data:
        return jsonify({"error": "No message field provided"}), 400
        
    message = data['message']
    try:
        # Prompt template as fine-tuned in notebook (Step 9 has 'Instruction:' template)
        prompt = f"Instruction: {message}\nOutput:"
        
        if use_ollama:
            # Direct connection to local Ollama instance running phi
            payload = {
                "model": ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": 120
                }
            }
            res = requests.post("http://localhost:11434/api/generate", json=payload, timeout=30)
            if res.status_code == 200:
                response_text = res.json().get("response", "").strip()
            else:
                raise Exception(f"Ollama server returned error code {res.status_code}")
        else:
            inputs = nlp_tokenizer(prompt, return_tensors="pt")
            
            # CPU generation limit to keep response time reasonable
            with torch.no_grad():
                outputs = nlp_model.generate(
                    **inputs,
                    max_new_tokens=120,
                    pad_token_id=nlp_tokenizer.pad_token_id,
                    eos_token_id=nlp_tokenizer.eos_token_id,
                    do_sample=True,
                    temperature=0.7,
                    top_p=0.9
                )
                
            full_response = nlp_tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Clean response by removing instructions prefix
            response_text = full_response
            if "Output:" in full_response:
                response_text = full_response.split("Output:")[-1].strip()
            elif "Instruction:" in full_response:
                # fallback if no output token
                response_text = full_response.replace(prompt, "").strip()
            
        return jsonify({"response": response_text})
        
    except Exception as e:
        print("Error in chat text generation:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Initialize both models synchronously on startup
    try:
        initialize_cv_model()
    except Exception as e:
        print("Failed to load CV model:", e)
        
    try:
        initialize_nlp_model()
    except Exception as e:
        print("Failed to load NLP model:", e)
        
    print("Starting Flask server on port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)

