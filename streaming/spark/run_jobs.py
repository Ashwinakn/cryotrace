"""
Local job runner for PySpark Streaming Pipeline.

This script starts the PySpark streaming anomaly detector in the background
and optionally runs the batch analytics aggregator.

Useful for local development and testing without setting up Airflow/Spark-submit.

Usage:
  python streaming/spark/run_jobs.py
"""
import subprocess
import sys
import time
import os
import signal

# Fix Windows console emoji printing
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def run_pipeline():
    print("🚀 Starting CryoTrace Big Data Pipeline (Local Mode)")
    print("-" * 60)

    # Make sure we're in the right directory
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    os.chdir(root_dir)

    print(f"Working directory: {root_dir}")

    # Set pythonpath so module imports work
    env = os.environ.copy()
    env["PYTHONPATH"] = root_dir + os.pathsep + env.get("PYTHONPATH", "")

    # Start Anomaly Detector (Streaming)
    print("⏳ Starting Anomaly Detector (Structured Streaming)...")
    detector_process = subprocess.Popen(
        [sys.executable, "-m", "streaming.spark.anomaly_detector"],
        env=env
    )

    print("✅ Streaming job started in background.")
    print("-" * 60)
    print("💡 To run batch analytics, open another terminal and run:")
    print("   python -m streaming.spark.analytics_aggregator")
    print("-" * 60)
    print("Press Ctrl+C to stop all jobs.")

    try:
        while True:
            time.sleep(1)
            # Check if process died
            if detector_process.poll() is not None:
                print("❌ Anomaly Detector exited unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\n🛑 Stopping pipeline...")
        if sys.platform == "win32":
            detector_process.terminate()
        else:
            detector_process.send_signal(signal.SIGINT)
        detector_process.wait()
        print("✅ Pipeline stopped gracefully.")

if __name__ == "__main__":
    run_pipeline()
