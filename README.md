# Supply Chain Transparency 3D Visualizer

> **Sheridan Datathon 2025** | Data Science for Social Good
> Supporting UN SDG 12: Responsible Consumption and Production

Upload a photo of any electronic device to explore its components and trace the global supply chain in interactive 3D.

## Features

- **AI-Powered Product Identification** - Gemini 2.5 Pro Vision identifies products from photos
- **3D Component Visualization** - Interactive exploded view of internal components
- **Global Supply Chain Mapping** - Interactive globe showing manufacturing locations and material sources
- **Real-Time Research** - Gemini with Google Search grounding for up-to-date supply chain data

## Tech Stack

### Frontend
- React 18 + Vite
- Tailwind CSS
- Framer Motion (animations)
- React Three Fiber (3D visualization)
- react-globe.gl (supply chain mapping)

### Backend
- Python Flask
- Google Gemini 2.5 Pro API (Vision + Search Grounding)
- SAM 3D Objects (Meta - 3D reconstruction)

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Google Gemini API Key
- GPU with 8GB+ VRAM (for SAM 3D - optional for demo mode)

### 1. Clone and Setup

```bash
cd Sourced
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run the server
python app.py
```

The backend will start at `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start at `http://localhost:5173`

### 4. Get Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Add it to `backend/.env`:
   ```
   GEMINI_API_KEY=your_key_here
   ```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/upload` | Upload product image | Returns image_id |
| `POST /api/identify` | Identify product | Uses Gemini Vision |
| `POST /api/generate-3d` | Generate 3D model | Uses SAM 3D or placeholder |
| `POST /api/components` | Get component positions | AI-estimated positions |
| `POST /api/supply-chain` | Research supply chain | Gemini + Search grounding |
| `GET /api/identify/demo` | Demo product data | iPhone 15 Pro example |
| `GET /api/supply-chain/demo` | Demo supply chain | Full supply chain example |

## Project Structure

```
Sourced/
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── routes/
│   │   ├── upload.py          # Image upload handling
│   │   ├── identify.py        # Product identification
│   │   ├── generate_3d.py     # 3D model generation
│   │   └── supply_chain.py    # Supply chain research
│   ├── services/
│   │   └── gemini_service.py  # Gemini API wrapper
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main application
│   │   └── components/
│   │       ├── ImageUploader.jsx
│   │       ├── ProductViewer3D.jsx
│   │       ├── SupplyChainGlobe.jsx
│   │       ├── ComponentDetails.jsx
│   │       └── LoadingState.jsx
│   └── package.json
│
└── README.md
```

## Demo Mode

The app works in demo mode without a Gemini API key:
- Uses pre-configured iPhone 15 Pro data
- Shows all visualization features
- Perfect for testing and presentations

## UN SDG 12 Alignment

This project supports **Sustainable Development Goal 12: Responsible Consumption and Production**:

- **Target 12.6**: Encourages companies to adopt sustainable practices and integrate sustainability information
- **Target 12.2**: Promotes sustainable management and efficient use of natural resources
- **Target 12.5**: Supports circular economy by visualizing product components for repairability

## Deployment

### Google Cloud Run (Backend)

```bash
cd backend

# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/supply-chain-api

# Deploy
gcloud run deploy supply-chain-api \
  --image gcr.io/PROJECT_ID/supply-chain-api \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=your_key"
```

### Vercel/Netlify (Frontend)

```bash
cd frontend
npm run build
# Deploy dist/ folder
```

Update `VITE_API_URL` in frontend to point to deployed backend.

## Hackathon Scoring

| Criteria | Implementation |
|----------|---------------|
| **Theme** | Data Science (AI/ML) + Social Good (SDG 12) |
| **Execution** | Full-stack app with 3D visualization and AI integration |
| **Creativity** | Novel combination of 3D + supply chain mapping |
| **Impact** | Enables supply chain transparency for consumers |

## Credits

- **Gemini 2.5 Pro** - Product identification and supply chain research
- **SAM 3D Objects** - 3D reconstruction (Meta AI)
- **React Three Fiber** - 3D rendering
- **react-globe.gl** - Globe visualization

---

Built with ❤️ for Sheridan Datathon 2025
