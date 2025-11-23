# Flask Backend

## Setup

1. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Run the application:
```bash
python app.py
```

The API will be available at `http://localhost:5000`

## Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check endpoint
