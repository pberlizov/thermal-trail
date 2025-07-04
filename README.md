# Thermal Trail: Urban Heat Island Mapper & Coolest-Route Planner

A Next.js application that maps urban heat islands and finds the coolest routes between locations using real-time thermal data and AI-powered land cover segmentation.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Satellite      │     │  Cloud Storage  │     │  Cloud Function │
│  Thermal Data   │────▶│  (GCS Bucket)   │────▶│  (Ingestion)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Next.js        │     │  MongoDB Atlas  │     │  Cloud Run      │
│  Frontend       │◀───▶│  Time-Series    │◀────│  (Segmentation) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        │
        ▼
┌─────────────────┐
│  Cloud Run      │
│  (Route Opt)    │
└─────────────────┘
```

## Features

- Real-time thermal data visualization from satellite imagery
- AI-powered land cover segmentation using Vertex AI
- Coolest route planning using A* algorithm with temperature-based cost function
- Time-series analysis of urban heat patterns
- Color-blind safe visualization

## Prerequisites

- Node.js 20+
- MongoDB Atlas account
- Google Cloud Platform account
- Mapbox API key
- Vertex AI AutoML Vision endpoint

## Environment Variables

Create a `.env.local` file in the root directory:

```env
MONGODB_URI=your_mongodb_uri
MAPBOX_TOKEN=your_mapbox_token
VERTEX_ENDPOINT=your_vertex_ai_endpoint
GCS_BUCKET=your_gcs_bucket
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Deploy Cloud Functions:
   ```bash
   cd functions/thermal-ingest
   npm install
   gcloud functions deploy processThermalData \
     --gen2 \
     --runtime=nodejs20 \
     --trigger-event-filters='type=google.cloud.storage.object.v1.finalized' \
     --trigger-event-filters='bucket=YOUR_BUCKET_NAME' \
     --entry-point=processThermalData \
     --env-vars-file=.env.yaml
   ```

3. Deploy Cloud Run services:
   ```bash
   # Segmentation service
   cd services/segmentation
   npm install
   gcloud run deploy segmentation-service \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated

   # Route optimization service
   cd services/route-optimization
   npm install
   gcloud run deploy route-optimization-service \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

## Data Flow

1. Satellite thermal data (256×256 Landsat/Sentinel tiles) is uploaded to GCS
2. Cloud Function processes the TIFF and extracts temperature points
3. Data is stored in MongoDB Atlas time-series collection
4. Vertex AI processes the same TIFF for land cover segmentation
5. Frontend queries both thermal and land cover data
6. Route optimization service uses A* to find coolest paths

## API Endpoints

- `GET /api/thermal-data`: Get thermal data points for a region
- `GET /api/segmentation-mask`: Get land cover segmentation for a region
- `POST /api/route`: Find coolest route between two points

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT 