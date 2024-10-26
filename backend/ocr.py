import pytesseract
from PIL import Image
import cv2
import numpy as np
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    APP_NAME: str = "Maritime Surveillance System"
    DEBUG: bool = False
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite:///./maritime.db"
    
    # File storage
    DATA_DIR: Path = Path("./data")
    REPORT_DIR: Path = DATA_DIR / "reports"
    VECTOR_DIR: Path = DATA_DIR / "vectors"
    TEMP_DIR: Path = DATA_DIR / "temp"
    
    # Model settings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    OCR_LANG: str = "eng"
    
    # Security
    SECRET_KEY: str = "hello hello can you hear me?"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    class Config:
        env_file = ".env"

settings = Settings()

class OCRProcessor:
    def __init__(self):
        pytesseract.pytesseract.tesseract_cmd = 'tesseract'  
        self.lang = settings.OCR_LANG

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR results"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply thresholding
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        
        # Noise removal
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
        
        return opening

    def process_image(self, image_path: Path) -> str:
        """Process image and extract text"""
        # Read image
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError(f"Could not read image at {image_path}")
        
        # Preprocess
        processed = self.preprocess_image(image)
        
        # Extract text
        text = pytesseract.image_to_string(processed, lang=self.lang)
        
        return text