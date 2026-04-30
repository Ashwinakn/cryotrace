# CryoTrace

Cold chain integrity and pharmaceutical logistics platform. CryoTrace provides end-to-end shipment tracking with real-time IoT sensor telemetry, blockchain-anchored provenance, AI-powered risk analysis, and regulatory-grade compliance monitoring for temperature-sensitive goods.

---

## Overview

CryoTrace is built for organizations that need verifiable, tamper-evident records of cold chain custody — from vaccine manufacturers to regulatory bodies. The platform covers the full lifecycle of a pharmaceutical shipment: creation, multi-party handoffs, live sensor monitoring, anomaly detection, document verification, and delivery confirmation.

Key capabilities:

- Real-time GPS and environmental telemetry from LTE IoT devices
- Hyperledger Fabric blockchain for immutable chain-of-custody records
- Mean Kinetic Temperature (MKT) and Vaccine Vial Monitor (VVM) compliance tracking
- Apache Spark Structured Streaming for continuous anomaly detection
- Role-based access for vendors, logistics hubs, regulators, and end customers
- SHA-256 document integrity verification
- AI risk scoring with explainable predictions

---

## Architecture

```
LTE IoT Device
    |
    v
FastAPI Backend (Python 3.12)
    |-- SQLite / PostgreSQL (persistent storage)
    |-- Kafka topic (optional, degrades gracefully)
    |-- WebSocket broadcast (live sensor feed to UI)
    |-- Hyperledger Fabric (blockchain provenance)
    |
    v
Apache Spark Structured Streaming
    |-- Anomaly detector (freeze, breach, vibration, light)
    |-- Analytics aggregator
    |
    v
React + Vite Frontend
    |-- Role dashboards (Vendor, Hub, Regulator, Customer)
    |-- Shipment detail with live map (Leaflet)
    |-- Pharma Compliance tab (MKT, VVM, excursions)
    |-- Document vault with hash verification
    |-- Consumer QR verify page
```

---

## Project Structure

```
cryotrace/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── routes/             # API route handlers
│   │   ├── services/           # Business logic (anomaly engine, vaccine utils, seed)
│   │   ├── ai/                 # ML risk scoring models
│   │   ├── blockchain/         # Hyperledger Fabric integration
│   │   ├── kafka_producer.py   # Kafka event publishing (optional)
│   │   └── main.py             # Application entrypoint
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                   # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/              # Route-level page components
│   │   ├── styles/             # Global CSS design system
│   │   └── api.ts              # API client
│   └── package.json
│
├── streaming/                  # Apache Spark jobs
│   ├── spark/
│   │   ├── anomaly_detector.py # Structured Streaming anomaly pipeline
│   │   └── analytics_aggregator.py
│   └── simulator/
│       └── lte_simulator.py    # LTE IoT device simulator
│
├── fabric-network/             # Hyperledger Fabric configuration
│   └── chaincode/cryotrace/    # Go chaincode (smart contracts)
│
├── firmware/                   # Arduino firmware for physical LTE tracker
│   └── lte_tracker/
│
├── docker-compose.yml          # Production deployment (Postgres + Redis + Nginx)
├── nginx.conf                  # Reverse proxy configuration
└── .gitignore
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI, SQLAlchemy, Pydantic v2, Python 3.12 |
| Database | SQLite (development), PostgreSQL (production) |
| Frontend | React 18, TypeScript, Vite, Leaflet, Recharts |
| Streaming | Apache Spark Structured Streaming, Kafka |
| Blockchain | Hyperledger Fabric, Go chaincode |
| AI / ML | scikit-learn, XGBoost |
| Firmware | Arduino C++ (SIM7600 LTE + GPS + DS18B20) |
| Deployment | Docker Compose, Nginx |

---

## Prerequisites

- Python 3.12
- Node.js 18 or later
- Git
- Java 11 or later (for Spark, optional)
- Docker (for production deployment only)
- WSL2 with Docker Desktop (for Hyperledger Fabric, optional)

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/Ashwinakn/cryotrace.git
cd cryotrace
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend starts on `http://localhost:8000`. The database is seeded automatically on first run with three demo shipments.

**API documentation:** `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:5173`.

### 4. Streaming pipeline (optional)

Requires Java 11 and PySpark.

```bash
cd streaming
python spark/run_jobs.py
```

### 5. IoT simulator

Simulate a live device pushing sensor data to a shipment:

```bash
python streaming/simulator/lte_simulator.py \
  --shipment-id <uuid> \
  --route mumbai_to_delhi \
  --anomaly vaccine_cold_chain \
  --interval 5
```

Anomaly options: `none`, `temp_breach`, `temp_freeze`, `temp_spike`, `door_open`, `shock`, `vaccine_cold_chain`

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Vendor | vendor@cryotrace.io | cryotrace123 |
| Hub | hub@cryotrace.io | cryotrace123 |
| Customer | customer@cryotrace.io | cryotrace123 |

---

## Demo Shipments

The seed database contains three pre-configured shipments to demonstrate different states:

| ID prefix | Name | Status | Use case |
|---|---|---|---|
| `10000000...` | Pfizer BNT162b2 mRNA Vaccine Batch A7 | Flagged | Critical breach at Frankfurt, ultra-cold chain failure |
| `20000000...` | Alphonso Mango Export | Delivered | Clean 28-day transit, full documentation |
| `30000000...` | Serum Institute Hepatitis B Vaccine | Quarantined | Missing import permits, customs hold at Nairobi |

---

## Production Deployment

### Docker Compose

```bash
# Set production environment variables first
export SECRET_KEY=your-production-secret-key

docker compose up -d
```

This starts: PostgreSQL, Redis, FastAPI backend, React frontend, and Nginx reverse proxy.

Services:
- API: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- Nginx proxy: `http://localhost:80`

---

## Vaccine Compliance Features

CryoTrace implements pharmaceutical regulatory requirements for vaccine cold chain logistics:

**Mean Kinetic Temperature (MKT):** Calculated using the Arrhenius equation across all historical temperature readings. Provides a thermodynamic representation of cumulative thermal stress that is more accurate than a simple average for predicting vaccine stability.

**Vaccine Vial Monitor (VVM) Status:** Simulates the four-stage chemical monitor degradation (Fresh / Warning / Danger / Discard) based on cumulative time outside the required temperature range.

**Freeze Excursion Detection:** Dedicated critical anomaly type for temperatures below 0°C. Freeze damage is permanent in aluminum-adjuvanted vaccines even if temperatures recover, making this distinct from a standard low-temperature excursion.

**Light Exposure Monitoring:** Detects unauthorized container opening or light exposure that can degrade photosensitive biologics.

**Cumulative Excursion Time:** Aggregates total minutes spent outside the required range, triggering VVM stage progression and compliance alerts.

---

## API Reference

The full interactive API documentation is available at `http://localhost:8000/docs` when the backend is running.

Key endpoint groups:

| Prefix | Description |
|---|---|
| `/auth` | Login, registration, token refresh |
| `/shipments` | CRUD for shipments and batch operations |
| `/handoffs` | Chain-of-custody handoff records |
| `/sensor` | Sensor log retrieval and WebSocket live feed |
| `/device/push` | LTE device telemetry ingestion (device auth) |
| `/ai` | Risk prediction, anomaly listing |
| `/documents` | Document upload, hash verification |
| `/verify/{id}` | Public consumer verification endpoint |
| `/analytics` | Aggregated statistics and reporting |

---

## Blockchain Integration

CryoTrace integrates with Hyperledger Fabric for immutable provenance anchoring. When a Fabric test network is not available, the application falls back to a hash-chained SQL record that preserves all integrity properties.

To set up Fabric:

```bash
# Requires WSL2 and Docker Desktop
.\fabric-network\setup.ps1
```

Each handoff record is hash-chained using SHA-256: `H(n) = SHA256(H(n-1) || party || timestamp || temp_min || temp_max || location)`. The genesis hash anchors the shipment creation event.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
