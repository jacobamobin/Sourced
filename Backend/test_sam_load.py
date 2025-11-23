import torch
from transformers import SamModel, SamProcessor
import os
import gc

def test_load():
    print("Testing SAM Model Loading...")
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Device: {device}")
    
    model_id = "facebook/sam-vit-base"
    
    try:
        print("Loading processor...")
        processor = SamProcessor.from_pretrained(model_id)
        
        print("Loading model (float16)...")
        if device == "mps" or device == "cuda":
            model = SamModel.from_pretrained(model_id, torch_dtype=torch.float16).to(device)
        else:
            model = SamModel.from_pretrained(model_id).to(device)
            
        print("Success! Model loaded.")
        print(f"Model dtype: {model.dtype}")
        
        # Cleanup
        del model
        del processor
        if device == "mps":
            torch.mps.empty_cache()
        gc.collect()
        print("Cleanup successful.")
        
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_load()
