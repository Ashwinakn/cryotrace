# CryoTrace Big Data Pipeline

This folder contains the Big Data pipeline for processing real-time sensor telemetry, detecting anomalies via Spark Structured Streaming, and simulating LTE hardware devices.

## Architecture

1. **Hardware / Simulator**: Devices (`simulator/lte_simulator.py` or actual Arduino `firmware/lte_tracker/`) push JSON to `POST /device/push`.
2. **Kafka Producer**: Backend validates and pushes to Kafka topic `cryotrace.sensor.telemetry`.
3. **Spark Streaming**: `spark/anomaly_detector.py` reads from Kafka, performs 5-minute rolling window aggregation, detects anomalies (e.g. temp > 8°C), and pushes alerts back to `cryotrace.anomaly.alerts` and writes to HDFS (Parquet).
4. **Spark Batch**: `spark/analytics_aggregator.py` runs periodically to generate hourly aggregates and excursion metrics.

## Setup

Run the setup script to install dependencies (`pyspark` and `confluent-kafka`) and create necessary data directories:

```powershell
.\setup.ps1
```

*Note: PySpark requires Java to be installed (Java 8 or 11).*

## Running Locally

We designed the pipeline to be resilient. If Kafka is not running, the producer falls back gracefully, and Spark will use a synthetic "rate source" for testing.

To run the full streaming job locally:

```powershell
python .\spark\run_jobs.py
```

This starts the streaming anomaly detector.

To run the batch analytics aggregator (in another terminal):
```powershell
python .\spark\analytics_aggregator.py
```

## Running the Device Simulator

To simulate a shipment traveling across a route with sensor telemetry:

```powershell
python .\simulator\lte_simulator.py --shipment-id <UUID>
```

You can inject anomalies:
```powershell
python .\simulator\lte_simulator.py --shipment-id <UUID> --anomaly temp_breach
```

Available anomalies: `temp_breach`, `temp_freeze`, `temp_spike`, `door_open`, `shock`
