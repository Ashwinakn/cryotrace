"""
CryoTrace — Apache Spark Structured Streaming: Anomaly Detector

Reads from Kafka topic 'cryotrace.sensor.telemetry' continuously,
applies time-windowed anomaly detection rules, and:

  → Writes detected anomalies back to Kafka 'cryotrace.anomaly.alerts'
  → Writes all sensor data to local Parquet files (HDFS-ready)
  → Prints a live console dashboard of current readings

Run:
  python -m streaming.spark.anomaly_detector

Or with spark-submit (for production):
  spark-submit --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \
               streaming/spark/anomaly_detector.py

Requirements:
  pip install pyspark confluent-kafka
"""
import json
import os
import sys
from datetime import datetime

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ["HADOOP_HOME"] = "C:\\hadoop"
    os.environ["PATH"] = "C:\\hadoop\\bin;" + os.environ.get("PATH", "")

# Fix Java 23 compatibility with PySpark 3.5 and add Kafka SQL dependencies
os.environ["PYSPARK_SUBMIT_ARGS"] = "--packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 --conf spark.driver.extraJavaOptions=-Djava.security.manager=allow --conf spark.executor.extraJavaOptions=-Djava.security.manager=allow pyspark-shell"

# ── PySpark availability check ────────────────────────────────────────────────
try:
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import (
        from_json, col, window, avg, max as spark_max, min as spark_min,
        count, expr, to_timestamp, lit, when
    )
    from pyspark.sql.types import (
        StructType, StructField, StringType, FloatType,
        BooleanType, TimestampType, IntegerType
    )
    PYSPARK_AVAILABLE = True
except ImportError:
    PYSPARK_AVAILABLE = False
    print("[Spark] PySpark not installed. Run: pip install pyspark")

# ── Config ────────────────────────────────────────────────────────────────────
KAFKA_BOOTSTRAP  = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPIC_INPUT      = "cryotrace.sensor.telemetry"
TOPIC_ANOMALIES  = "cryotrace.anomaly.alerts"
PARQUET_OUTPUT   = os.getenv("SENSOR_DATA_PATH", "./data/sensor_logs")
CHECKPOINT_DIR   = os.getenv("SPARK_CHECKPOINT_DIR", "./data/checkpoints")

# Anomaly thresholds (per-shipment thresholds come from Kafka payload)
DEFAULT_TEMP_MAX = 8.0    # °C — cold chain upper limit
DEFAULT_TEMP_MIN = 2.0    # °C — cold chain lower limit
BATTERY_CRITICAL = 15.0   # %

# ── Kafka sensor message schema ───────────────────────────────────────────────
def get_sensor_schema():
    # Deferred import to avoid NameError if PySpark is missing at module level
    from pyspark.sql.types import (
        StructType, StructField, StringType, FloatType,
        BooleanType, TimestampType, IntegerType
    )
    return StructType([
        StructField("shipment_id",  StringType(),  True),
        StructField("device_id",    StringType(),  True),
        StructField("temperature",  FloatType(),   True),
        StructField("humidity",     FloatType(),   True),
        StructField("lat",          FloatType(),   True),
        StructField("lng",          FloatType(),   True),
        StructField("battery",      FloatType(),   True),
        StructField("door_open",    BooleanType(), True),
        StructField("shock",        BooleanType(), True),
        StructField("light",        FloatType(),   True),
        StructField("pressure",     FloatType(),   True),
        StructField("signal_dbm",   IntegerType(), True),
        StructField("lte_provider", StringType(),  True),
        StructField("timestamp",    StringType(),  True),
        StructField("received_at",  StringType(),  True),
    ])


def run_streaming_job():
    if not PYSPARK_AVAILABLE:
        print("❌ Error: PySpark not found. Please run: pip install pyspark")
        return

    print(f"[Spark] Starting CryoTrace Anomaly Detector")
    print(f"[Spark] Kafka: {KAFKA_BOOTSTRAP}")
    print(f"[Spark] Output: {PARQUET_OUTPUT}")

    spark = SparkSession.builder \
        .appName("CryoTrace-AnomalyDetector") \
        .config("spark.sql.streaming.checkpointLocation", CHECKPOINT_DIR) \
        .config("spark.streaming.stopGracefullyOnShutdown", "true") \
        .getOrCreate()

    spark.sparkContext.setLogLevel("WARN")

    # ── Read from Kafka ────────────────────────────────────────────────────────
    import socket
    kafka_available = False
    try:
        host, port = KAFKA_BOOTSTRAP.split(":")
        with socket.create_connection((host, int(port)), timeout=2):
            kafka_available = True
    except Exception:
        pass

    if kafka_available:
        print("[Spark] Connected to Kafka. Using Kafka stream.")
        raw_stream = spark.readStream \
            .format("kafka") \
            .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP) \
            .option("subscribe", TOPIC_INPUT) \
            .option("startingOffsets", "latest") \
            .option("failOnDataLoss", "false") \
            .load()
    else:
        print("[Spark] Kafka unavailable. Using rate source for local testing.")
        raw_stream = spark.readStream \
            .format("rate") \
            .option("rowsPerSecond", 1) \
            .load() \
            .withColumn("value", lit('{"shipment_id":"10000000-0000-0000-0000-000000000001","device_id":"sim","temperature":9.5,"humidity":70,"lat":12.9716,"lng":77.5946,"battery":85,"door_open":false,"shock":false,"timestamp":"' + datetime.utcnow().isoformat() + '"}').cast("binary")) \
            .withColumn("key", lit("10000000-0000-0000-0000-000000000001").cast("binary"))

    # ── Parse JSON ─────────────────────────────────────────────────────────────
    parsed = raw_stream \
        .select(from_json(col("value").cast("string"), get_sensor_schema()).alias("d")) \
        .select("d.*") \
        .withColumn("event_time", to_timestamp(col("timestamp")))

    # ── Write 1: Persist ALL sensor data to Parquet (HDFS-compatible) ─────────
    os.makedirs(PARQUET_OUTPUT, exist_ok=True)
    os.makedirs(CHECKPOINT_DIR + "/sensor", exist_ok=True)

    parquet_query = parsed.writeStream \
        .format("parquet") \
        .outputMode("append") \
        .option("path", PARQUET_OUTPUT) \
        .option("checkpointLocation", CHECKPOINT_DIR + "/sensor") \
        .partitionBy("shipment_id") \
        .trigger(processingTime="10 seconds") \
        .start()

    # ── Write 2: 5-minute rolling window anomaly detection ────────────────────
    os.makedirs(CHECKPOINT_DIR + "/anomaly", exist_ok=True)

    windowed = parsed \
        .withWatermark("event_time", "2 minutes") \
        .groupBy(
            window("event_time", "5 minutes", "1 minute"),
            col("shipment_id"),
            col("device_id"),
        ) \
        .agg(
            avg("temperature").alias("avg_temp"),
            spark_max("temperature").alias("max_temp"),
            spark_min("temperature").alias("min_temp"),
            avg("humidity").alias("avg_humidity"),
            spark_max("battery").alias("max_battery"),
            count("*").alias("reading_count"),
        )

    # Tag breaches
    anomalies = windowed.withColumn(
        "breach_type",
        when(col("max_temp") > DEFAULT_TEMP_MAX, "TEMP_HIGH")
        .when(col("min_temp") < 0.0, "FREEZE_EXCURSION")
        .when(col("min_temp") < DEFAULT_TEMP_MIN, "TEMP_LOW")
        .when(col("max_battery") < BATTERY_CRITICAL, "BATTERY_CRITICAL")
        .otherwise(None)
    ).filter(col("breach_type").isNotNull())

    def write_anomaly_to_kafka(batch_df, batch_id):
        """Write anomaly batch to Kafka as JSON."""
        rows = batch_df.collect()
        if not rows:
            return

        try:
            from confluent_kafka import Producer
            p = Producer({"bootstrap.servers": KAFKA_BOOTSTRAP})
            for row in rows:
                msg = json.dumps({
                    "shipment_id":   row["shipment_id"],
                    "device_id":     row["device_id"],
                    "breach_type":   row["breach_type"],
                    "avg_temp":      row["avg_temp"],
                    "max_temp":      row["max_temp"],
                    "reading_count": row["reading_count"],
                    "window_start":  str(row["window"]["start"]),
                    "window_end":    str(row["window"]["end"]),
                    "detected_at":   datetime.utcnow().isoformat(),
                    "severity":      "critical" if row["breach_type"] == "TEMP_HIGH" else "high",
                }).encode()
                p.produce(TOPIC_ANOMALIES, value=msg, key=row["shipment_id"].encode())
            p.flush()
            print(f"[Spark] Batch {batch_id}: wrote {len(rows)} anomalies to Kafka")
        except Exception as e:
            print(f"[Spark] Batch {batch_id}: Kafka write failed ({e}) — printing anomalies")
            for row in rows:
                print(f"  🚨 ANOMALY: shipment={row['shipment_id']} type={row['breach_type']} max_temp={row['max_temp']:.1f}°C")

    anomaly_query = anomalies.writeStream \
        .outputMode("update") \
        .foreachBatch(write_anomaly_to_kafka) \
        .option("checkpointLocation", CHECKPOINT_DIR + "/anomaly") \
        .trigger(processingTime="30 seconds") \
        .start()

    # ── Write 3: Console output for monitoring ─────────────────────────────────
    console_query = parsed.writeStream \
        .outputMode("append") \
        .format("console") \
        .option("truncate", False) \
        .option("numRows", 5) \
        .trigger(processingTime="10 seconds") \
        .start()

    print(f"\n[Spark] ✅ 3 streaming queries started")
    print(f"  → Parquet writer:   {PARQUET_OUTPUT}")
    print(f"  → Anomaly detector: Kafka:{TOPIC_ANOMALIES}")
    print(f"  → Console monitor:  stdout")
    print(f"\nPress Ctrl+C to stop.\n")

    spark.streams.awaitAnyTermination()


if __name__ == "__main__":
    run_streaming_job()
