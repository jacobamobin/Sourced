import os
import numpy as np
from PIL import Image
import io
import base64
import json
import time
import gc

class SAM3DService:
    def __init__(self):
        self.device = None # Lazy load
        # Use the base model which is faster and lighter
        self.model_id = "facebook/sam-vit-base"
        self.model = None
        self.processor = None
        print("SAM3DService initialized. Model will be loaded on demand.")

    def load_local_model(self):
        """Lazy load local SAM model only when needed"""
        try:
            import torch
            from transformers import SamModel, SamProcessor
            
            if not self.device:
                self.device = "mps" if torch.backends.mps.is_available() else "cpu"
            
            print(f"Loading local SAM model ({self.model_id}) on {self.device}...")
            
            # Load in half precision if on MPS/CUDA to save memory
            # vit-base is ~375MB in fp32, ~190MB in fp16. 
            # The 15GB usage reported by user likely came from something else or a leak, 
            # but fp16 is safer.
            if self.device == "mps" or self.device == "cuda":
                self.model = SamModel.from_pretrained(self.model_id, torch_dtype=torch.float16).to(self.device)
            else:
                self.model = SamModel.from_pretrained(self.model_id).to(self.device)
                
            self.processor = SamProcessor.from_pretrained(self.model_id)
            print(f"Local SAM model loaded successfully.")
            
        except Exception as e:
            print(f"Failed to load local SAM model: {e}")
            print("Ensure you have transformers and torch installed.")
    
    def unload_local_model(self):
        """Unload model to free memory"""
        if self.model is not None:
            del self.model
            del self.processor
            self.model = None
            self.processor = None
            
            try:
                import torch
                if self.device == "mps":
                    torch.mps.empty_cache()
                elif torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
                
            gc.collect()
            print("Local SAM model unloaded and memory freed.")

    def generate_3d_masks(self, image_path):
        """
        Generate 3D masks using local SAM model
        """
        return self.generate_3d_masks_local(image_path)

    def generate_3d_masks_local(self, image_path):
        """
        Generate 3D masks using local SAM model
        """
        # Load model
        if not self.model:
            self.load_local_model()
            if not self.model:
                return []

        try:
            import torch
            
            print(f"Processing image: {image_path}")
            image = Image.open(image_path).convert("RGB")
            width, height = image.size
            
            # Create a sparse grid of points for "Segment Everything"
            # 6x6 = 36 points is usually enough for a good overview without being too slow
            n_points = 6
            points = []
            for i in range(n_points):
                for j in range(n_points):
                    x = int((i + 0.5) * width / n_points)
                    y = int((j + 0.5) * height / n_points)
                    points.append([x, y])
            
            components = []
            
            # Batch size
            batch_size = 12 if self.device == "mps" else 4
            
            for i in range(0, len(points), batch_size):
                batch_points = points[i:i+batch_size]
                formatted_points = [[[p[0], p[1]]] for p in batch_points]
                batch_images = [image] * len(batch_points)
                
                try:
                    inputs = self.processor(batch_images, input_points=formatted_points, return_tensors="pt")
                    
                    # Move inputs to device and correct dtype
                    inputs = inputs.to(self.device)
                    if self.device == "mps" or self.device == "cuda":
                        # Ensure pixel_values match model dtype (float16)
                        if inputs["pixel_values"].dtype != torch.float16:
                             inputs["pixel_values"] = inputs["pixel_values"].to(torch.float16)

                    with torch.no_grad():
                        outputs = self.model(**inputs)
                    
                    # Post process
                    masks = self.processor.image_processor.post_process_masks(
                        outputs.pred_masks.cpu(), 
                        inputs["original_sizes"].cpu(), 
                        inputs["reshaped_input_sizes"].cpu()
                    )
                    
                    scores = outputs.iou_scores.cpu()
                    
                    for j in range(len(batch_points)):
                        # Get best mask for this point
                        if len(scores.shape) == 3:
                            point_scores = scores[j, 0, :]
                        else:
                            point_scores = scores[j, :]
                            
                        best_mask_idx = torch.argmax(point_scores).item()
                        score = point_scores[best_mask_idx].item()
                        
                        if score < 0.70: continue # Higher threshold for quality
                        
                        mask = masks[j][0, best_mask_idx, :, :].numpy()
                        
                        rows = np.any(mask, axis=1)
                        cols = np.any(mask, axis=0)
                        if not np.any(rows) or not np.any(cols): continue
                        
                        ymin, ymax = np.where(rows)[0][[0, -1]]
                        xmin, xmax = np.where(cols)[0][[0, -1]]
                        
                        x_center = (xmin + xmax) / 2 / width
                        y_center = (ymin + ymax) / 2 / height
                        w = (xmax - xmin) / width
                        h = (ymax - ymin) / height
                        
                        # Filter full image or tiny noise
                        if w > 0.9 and h > 0.9: continue
                        if w < 0.05 or h < 0.05: continue
                        
                        # Deduplication
                        is_duplicate = False
                        for existing in components:
                            ex_pos = existing['position']
                            ex_x = (ex_pos[0] / 2) + 0.5
                            ex_y = 0.5 - (ex_pos[1] / 2)
                            dist = ((x_center - ex_x)**2 + (y_center - ex_y)**2)**0.5
                            
                            if dist < 0.1: # Increased duplicate radius
                                if score > existing['confidence']:
                                    existing['position'] = [(x_center - 0.5) * 2, (0.5 - y_center) * 2, existing['position'][2]]
                                    existing['scale'] = [w, h, 0.02]
                                    existing['confidence'] = score
                                is_duplicate = True
                                break
                        
                        if is_duplicate: continue

                        z_depth = (w * h * 0.5) 
                        
                        components.append({
                            "id": f"sam_{len(components)}",
                            "name": f"Component {len(components)+1}",
                            "position": [
                                (x_center - 0.5) * 2,
                                (0.5 - y_center) * 2,
                                z_depth
                            ],
                            "scale": [w, h, 0.02],
                            "confidence": score,
                            "source": "local_sam"
                        })
                    
                    # Cleanup batch
                    del inputs
                    del outputs
                    if self.device == "mps":
                        torch.mps.empty_cache()
                
                except Exception as e:
                    print(f"Error processing batch {i}: {e}")
                    continue

            print(f"Local SAM Inference: {len(components)} components found.")
            
            # Unload model immediately
            self.unload_local_model()
            
            return components

        except Exception as e:
            print(f"Error in Local SAM inference: {e}")
            self.unload_local_model()
            return []

# Global instance
sam_service = SAM3DService()
