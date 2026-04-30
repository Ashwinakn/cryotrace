"""
CryoTrace — LTE Device Simulator

Simulates one or more physical LTE IoT devices tracking a shipment.
Useful for:
  - Testing without physical hardware
  - Demo / presentation
  - Load testing the streaming pipeline

Features:
  - Realistic GPS movement along a predefined route
  - Temperature fluctuations within the cold chain range (with breach injection)
  - Battery drain over time
  - Anomaly injection: temperature breach, door open, shock event

Usage:
  python streaming/simulator/lte_simulator.py
  python streaming/simulator/lte_simulator.py --shipment-id <uuid> --anomaly temp_breach
  python streaming/simulator/lte_simulator.py --help
"""
import argparse
import hashlib
import json
import math
import os
import random
import sys
import time
from datetime import datetime
from typing import List, Tuple

import httpx

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

# ── Config ────────────────────────────────────────────────────────────────────
DEFAULT_API_URL    = os.getenv("CRYOTRACE_API_URL", "http://localhost:8000")
DEFAULT_DEVICE_KEY = "dev-bypass"   # matches the dev bypass in lte_device.py
PUSH_INTERVAL_SEC  = 10             # push every 10 seconds (30s in production)


# ── Predefined routes (lat, lng waypoints) ───────────────────────────────────
ROUTES = {
    "mumbai_to_delhi": [
        (19.0760,  72.8777),   # Mumbai
        (21.1458,  79.0882),   # Nagpur
        (23.2599,  77.4126),   # Bhopal
        (26.8467,  80.9462),   # Lucknow
        (28.6139,  77.2090),   # Delhi
    ],
    "chennai_to_bangalore": [
        (13.0827,  80.2707),   # Chennai
        (12.9716,  77.5946),   # Bangalore
    ],
    "kolkata_to_bhubaneswar": [
        (22.5726,  88.3639),   # Kolkata
        (20.2961,  85.8245),   # Bhubaneswar
    ],
}


def _interpolate_route(waypoints: List[Tuple[float, float]], steps: int) -> List[Tuple[float, float]]:
    """Generate a list of GPS positions along the route by linear interpolation."""
    if len(waypoints) < 2:
        return waypoints * steps

    result = []
    segment_steps = steps // (len(waypoints) - 1)

    for i in range(len(waypoints) - 1):
        lat1, lng1 = waypoints[i]
        lat2, lng2 = waypoints[i + 1]
        for j in range(segment_steps):
            t = j / segment_steps
            result.append((
                lat1 + (lat2 - lat1) * t + random.uniform(-0.001, 0.001),
                lng1 + (lng2 - lng1) * t + random.uniform(-0.001, 0.001),
            ))

    result.append(waypoints[-1])
    return result


class DeviceSimulator:
    def __init__(
        self,
        shipment_id:    str,
        device_id:      str     = "SIM-LTE-001",
        route_name:     str     = "mumbai_to_delhi",
        temp_normal:    float   = 4.0,
        temp_range:     float   = 1.5,
        anomaly:        str     = "none",
        steps:          int     = 500,
        api_url:        str     = DEFAULT_API_URL,
        device_key:     str     = DEFAULT_DEVICE_KEY,
    ):
        self.shipment_id = shipment_id
        self.device_id   = device_id
        self.temp_normal = temp_normal
        self.temp_range  = temp_range
        self.anomaly     = anomaly
        self.api_url     = api_url
        self.device_key  = device_key
        self.battery     = 100.0
        self.step        = 0

        waypoints = ROUTES.get(route_name, ROUTES["mumbai_to_delhi"])
        self.route = _interpolate_route(waypoints, steps)
        self.total_steps = len(self.route)

        print(f"[Simulator] Device: {device_id}")
        print(f"[Simulator] Shipment: {shipment_id}")
        print(f"[Simulator] Route: {route_name} ({self.total_steps} positions)")
        print(f"[Simulator] Anomaly injection: {anomaly}")
        print(f"[Simulator] Pushing to: {api_url}/device/push every {PUSH_INTERVAL_SEC}s\n")

    def _get_temperature(self) -> float:
        """Return a temperature reading, optionally with anomaly injection."""
        base = self.temp_normal + random.uniform(-self.temp_range, self.temp_range)

        if self.anomaly == "temp_breach":
            # Gradually increase temp after step 20
            if self.step > 20:
                base = self.temp_normal + 5 + random.uniform(0, 3)
        elif self.anomaly == "temp_freeze":
            if self.step > 15:
                base = -15.0 + random.uniform(-2, 2)
        elif self.anomaly == "temp_spike":
            if self.step % 10 == 5:  # spike every 10 readings
                base = self.temp_normal + 15
        elif self.anomaly == "vaccine_cold_chain":
            # Simulate a "freeze excursion" — the silent killer of vaccines
            if self.step > 20:
                base = -5.0 + random.uniform(-1, 1)

        return round(base, 2)

    def _get_door_open(self) -> bool:
        if self.anomaly == "door_open" and self.step == 25:
            return True
        if self.anomaly == "vaccine_cold_chain" and self.step == 40:
            return True # Exposure during loading/unloading
        return False

    def _get_shock(self) -> bool:
        if self.anomaly == "shock" and self.step == 30:
            return True
        if self.anomaly == "vaccine_cold_chain" and self.step % 20 == 10:
            return True # Road vibration
        return False

    def _get_light(self) -> float:
        # Normal light in a container is 0. If door open or loading, it increases.
        if self._get_door_open():
            return round(500 + random.uniform(0, 500), 1)
        return round(random.uniform(0, 5), 1)

    def _get_pressure(self) -> float:
        # Normal sea level is 1013.25 hPa. Fluctuates slightly.
        return round(1013.25 + random.uniform(-10, 10), 2)

    def _build_payload(self) -> dict:
        pos_idx = min(self.step, self.total_steps - 1)
        lat, lng = self.route[pos_idx]

        # Battery drains ~0.1% per reading
        self.battery = max(0, self.battery - 0.1)

        return {
            "device_id":        self.device_id,
            "shipment_id":      self.shipment_id,
            "temperature":      self._get_temperature(),
            "humidity":         round(60 + random.uniform(-10, 15), 1),
            "lat":              round(lat, 6),
            "lng":              round(lng, 6),
            "battery":          round(self.battery, 1),
            "door_open":        self._get_door_open(),
            "shock":            self._get_shock(),
            "light":            self._get_light(),
            "pressure":         self._get_pressure(),
            "signal_dbm":       random.randint(-100, -60),
            "lte_provider":     random.choice(["Airtel", "Jio", "BSNL"]),
            "firmware_version": "v1.2.0",
            "timestamp":        datetime.utcnow().isoformat(),
        }

    def run(self):
        """Main loop — push sensor readings until route complete or Ctrl+C."""
        with httpx.Client(timeout=10) as client:
            while self.step < self.total_steps:
                payload = self._build_payload()

                try:
                    response = client.post(
                        f"{self.api_url}/device/push",
                        json    = payload,
                        headers = {"X-Device-Key": self.device_key},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        anomaly_flag = "🚨 " + str(data.get("anomalies", 0)) + " anomaly" if data.get("anomalies") else ""
                        print(
                            f"  Step {self.step+1:04d}/{self.total_steps} | "
                            f"T={payload['temperature']:+.1f}°C | "
                            f"GPS=({payload['lat']:.4f},{payload['lng']:.4f}) | "
                            f"Bat={payload['battery']:.0f}% | "
                            f"Kafka={data.get('kafka','?')} {anomaly_flag}"
                        )
                    else:
                        print(f"  Step {self.step+1} | HTTP {response.status_code}: {response.text[:80]}")

                except httpx.ConnectError:
                    print(f"  Step {self.step+1} | ⚠ Cannot reach {self.api_url} — is the backend running?")
                except Exception as e:
                    print(f"  Step {self.step+1} | Error: {e}")

                self.step += 1
                time.sleep(PUSH_INTERVAL_SEC)

        print(f"\n[Simulator] ✅ Route complete — {self.total_steps} readings sent.")


# ── CLI entry point ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CryoTrace LTE Device Simulator")
    parser.add_argument("--shipment-id",   required=True,              help="Target shipment UUID")
    parser.add_argument("--device-id",     default="SIM-LTE-001",      help="Simulated device ID")
    parser.add_argument("--route",         default="mumbai_to_delhi",
                        choices=list(ROUTES.keys()),                    help="Route to simulate")
    parser.add_argument("--anomaly",       default="none",
                        choices=["none", "temp_breach", "temp_freeze", "temp_spike", "door_open", "shock", "vaccine_cold_chain"],
                        help="Inject an anomaly scenario")
    parser.add_argument("--interval",      type=int, default=10,        help="Seconds between pushes")
    parser.add_argument("--api-url",       default=DEFAULT_API_URL,     help="CryoTrace API base URL")
    parser.add_argument("--device-key",    default=DEFAULT_DEVICE_KEY,  help="Device API key")

    args = parser.parse_args()

    global PUSH_INTERVAL_SEC
    PUSH_INTERVAL_SEC = args.interval

    sim = DeviceSimulator(
        shipment_id = args.shipment_id,
        device_id   = args.device_id,
        route_name  = args.route,
        anomaly     = args.anomaly,
        api_url     = args.api_url,
        device_key  = args.device_key,
    )
    sim.run()


if __name__ == "__main__":
    main()
