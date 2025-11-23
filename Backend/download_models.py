import os
from transformers import SamModel, SamProcessor
from huggingface_hub import login

def download_sam_model():
    print("Starting download of SAM-ViT-Huge model...")
    
    # Login if token is available
    hf_token = os.environ.get('HF_TOKEN')
    if hf_token:
        login(token=hf_token)
        print("Logged in to Hugging Face.")
    
    model_id = "facebook/sam-vit-huge"
    
    print(f"Downloading processor for {model_id}...")
    SamProcessor.from_pretrained(model_id)
    
    print(f"Downloading model for {model_id} (this may take a while)...")
    SamModel.from_pretrained(model_id)
    
    print("Download complete! Model is cached locally.")

if __name__ == "__main__":
    download_sam_model()
