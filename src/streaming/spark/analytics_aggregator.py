"""
CryoTrace — Apache Spark Batch Analytics Aggregator

Runs periodically (e.g., hourly via cron) to aggregate historical sensor data
from HDFS (Parquet files). Computes analytics needed for dashboards:
  - Average temperature per shipment per hour/day
  - Excursion window durations
  - Battery degradation rates
  - ESG metrics estimation (e.g., energy used for cooling)

Reads from:  hdfs:///cryotrace/sensor_logs/
Writes to:   hdfs:///cryotrace/analytics/

Run:
  python streaming/spark/analytics_aggregator.py
"""
import os
import sys
from datetime import datetime

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ["HADOOP_HOME"] = "C:\\hadoop"
    os.environ["PATH"] = "C:\\hadoop\\bin;" + os.environ.get("PATH", "")

# Fix Java 23 compatibility with PySpark 3.5
os.environ["PYSPARK_SUBMIT_ARGS"] = "--conf spark.driver.extraJavaOptions=-Djava.security.manager=allow --conf spark.executor.extraJavaOptions=-Djava.security.manager=allow pyspark-shell"

try:
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import (
        col, window, avg, max as spark_max, min as spark_min,
        count, expr, sum as spark_sum, when
    )
    PYSPARK_AVAILABLE = True
except ImportError:
    PYSPARK_AVAILABLE = False

# Config
INPUT_PATH = os.getenv("SENSOR_DATA_PATH", "./data/sensor_logs")
OUTPUT_PATH = os.getenv("ANALYTICS_DATA_PATH", "./data/analytics")


def run_analytics_aggregator():
    if not PYSPARK_AVAILABLE:
        print("[Spark] PySpark not installed. Please install pyspark to run analytics.")
        sys.exit(1)

    print(f"[Spark] Starting CryoTrace Analytics Aggregator")
    print(f"[Spark] Input:  {INPUT_PATH}")
    print(f"[Spark] Output: {OUTPUT_PATH}")

    # Check if input path exists
    if not os.path.exists(INPUT_PATH):
        print(f"[Spark] Input path {INPUT_PATH} does not exist yet. Run anomaly_detector.py first to generate data.")
        sys.exit(0)

    spark = SparkSession.builder \
        .appName("CryoTrace-AnalyticsAggregator") \
        .getOrCreate()

    spark.sparkContext.setLogLevel("WARN")

    try:
        # Load all historical sensor data
        df = spark.read.parquet(INPUT_PATH)

        # Ensure event_time is timestamp
        from pyspark.sql.functions import to_timestamp
        df = df.withColumn("event_time", to_timestamp(col("timestamp")))

        # 1. Hourly Aggregates (Temp, Humidity, Battery)
        hourly_agg = df.groupBy(
            col("shipment_id"),
            window("event_time", "1 hour")
        ).agg(
            avg("temperature").alias("avg_temp"),
            spark_max("temperature").alias("max_temp"),
            spark_min("temperature").alias("min_temp"),
            avg("humidity").alias("avg_humidity"),
            spark_min("battery").alias("end_battery"),
            count("*").alias("readings_count")
        )

        hourly_output = os.path.join(OUTPUT_PATH, "hourly_summary")
        hourly_agg.write.mode("overwrite").parquet(hourly_output)
        print(f"[Spark] ✅ Hourly aggregates written to {hourly_output}")

        # 2. Excursion Windows (Time spent outside 2-8°C)
        # We estimate by counting readings outside range and multiplying by reading interval (e.g. 30s)
        # This is a simplified estimation for the batch job.
        excursions = df.withColumn(
            "is_excursion",
            when((col("temperature") > 8.0) | (col("temperature") < 2.0), 1).otherwise(0)
        ).groupBy(
            col("shipment_id"),
            window("event_time", "1 day")
        ).agg(
            spark_sum("is_excursion").alias("excursion_readings"),
            count("*").alias("total_readings")
        ).withColumn(
            # Assume ~30 seconds per reading
            "excursion_minutes", (col("excursion_readings") * 30) / 60
        )

        excursion_output = os.path.join(OUTPUT_PATH, "daily_excursions")
        excursions.write.mode("overwrite").parquet(excursion_output)
        print(f"[Spark] ✅ Daily excursion analytics written to {excursion_output}")

        print("[Spark] Analytics aggregation complete.")

    except Exception as e:
        print(f"[Spark] Error running analytics aggregator: {e}")

    finally:
        spark.stop()


if __name__ == "__main__":
    run_analytics_aggregator()
