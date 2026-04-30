"""
Kafka producer for CryoTrace sensor telemetry.

Publishes sensor events to Kafka topics so Spark Structured Streaming
can process them in real time.

Falls back gracefully when Kafka is unavailable (dev mode / no broker).
"""
import json
import asyncio
from datetime import datetime
from typing import Optional

try:
    from confluent_kafka import Producer as _KafkaProducer
    _KAFKA_AVAILABLE = True
except ImportError:
    _KAFKA_AVAILABLE = False

from app.config import settings

# ── Topic names ───────────────────────────────────────────────────────────────
TOPIC_SENSOR_TELEMETRY = "cryotrace.sensor.telemetry"
TOPIC_ANOMALY_ALERTS   = "cryotrace.anomaly.alerts"
TOPIC_DEVICE_STATUS    = "cryotrace.device.status"

# ── Producer singleton ────────────────────────────────────────────────────────
_producer: Optional[object] = None


def _get_producer():
    global _producer
    if _producer is not None:
        return _producer

    if not _KAFKA_AVAILABLE:
        print("[Kafka] confluent-kafka not installed — running in no-broker mode")
        return None

    bootstrap = getattr(settings, "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    try:
        _producer = _KafkaProducer({
            "bootstrap.servers":        bootstrap,
            "client.id":                "cryotrace-backend",
            "acks":                     "all",
            "retries":                  3,
            "retry.backoff.ms":         100,
            "socket.timeout.ms":        3000,
            "message.timeout.ms":       5000,
        })
        print(f"[Kafka] Connected to {bootstrap}")
    except Exception as e:
        print(f"[Kafka] Could not connect to {bootstrap}: {e} — running in no-broker mode")
        _producer = None

    return _producer


def _delivery_report(err, msg):
    if err:
        print(f"[Kafka] Delivery failed for {msg.topic()}: {err}")
    else:
        print(f"[Kafka] Delivered to {msg.topic()} partition [{msg.partition()}] offset {msg.offset()}")


def publish(topic: str, key: str, payload: dict) -> bool:
    """
    Publish a JSON message to a Kafka topic.
    Returns True if published, False if Kafka is unavailable (silent fallback).
    """
    producer = _get_producer()
    if producer is None:
        return False  # no-broker mode — caller continues without Kafka

    try:
        producer.produce(
            topic    = topic,
            key      = key.encode("utf-8"),
            value    = json.dumps(payload).encode("utf-8"),
            callback = _delivery_report,
        )
        producer.poll(0)   # trigger delivery callbacks without blocking
        return True
    except Exception as e:
        print(f"[Kafka] Publish error: {e}")
        return False


def flush():
    """Wait for all in-flight messages to be delivered."""
    producer = _get_producer()
    if producer:
        producer.flush(timeout=5)


# ── High-level publish helpers ────────────────────────────────────────────────

def publish_sensor_event(shipment_id: str, device_id: str, payload: dict) -> bool:
    """Publish a sensor telemetry event to Kafka."""
    event = {
        "shipment_id": shipment_id,
        "device_id":   device_id,
        "received_at": datetime.utcnow().isoformat(),
        **payload,
    }
    return publish(TOPIC_SENSOR_TELEMETRY, shipment_id, event)


def publish_anomaly_alert(shipment_id: str, anomaly_type: str, severity: str, description: str) -> bool:
    """Publish a detected anomaly alert to Kafka."""
    event = {
        "shipment_id":  shipment_id,
        "anomaly_type": anomaly_type,
        "severity":     severity,
        "description":  description,
        "detected_at":  datetime.utcnow().isoformat(),
    }
    return publish(TOPIC_ANOMALY_ALERTS, shipment_id, event)


def publish_device_status(device_id: str, shipment_id: str, status: str, details: dict = None) -> bool:
    """Publish a device heartbeat / status event."""
    event = {
        "device_id":   device_id,
        "shipment_id": shipment_id,
        "status":      status,
        "timestamp":   datetime.utcnow().isoformat(),
        **(details or {}),
    }
    return publish(TOPIC_DEVICE_STATUS, device_id, event)
