import math
from typing import List

# Constants for MKT calculation (Arrhenius equation)
# Activation energy for most vaccines is approx 83.144 kJ/mol
DELTA_H = 83.144 * 1000  # J/mol
GAS_CONSTANT = 8.314472   # J/mol*K

def calculate_mkt(temperatures_c: List[float]) -> float:
    """
    Calculates Mean Kinetic Temperature (MKT) in Celsius.
    Formula: MKT = -ΔH/R / ln((Σ e^(-ΔH/RT_n)) / n)
    T must be in Kelvin.
    """
    if not temperatures_c:
        return 0.0
    
    # Convert C to K
    temps_k = [t + 273.15 for t in temperatures_c]
    
    # Calculate sum of e^(-ΔH/RT)
    exponent_sum = sum(math.exp(-DELTA_H / (GAS_CONSTANT * t)) for t in temps_k)
    
    # Average exponent
    avg_exponent = exponent_sum / len(temps_k)
    
    # Solve for MKT in K
    mkt_k = (-DELTA_H / GAS_CONSTANT) / math.log(avg_exponent)
    
    # Convert back to C
    return round(mkt_k - 273.15, 2)

def calculate_vvm_decay(temp_c: float, hours: float, current_vvm: int) -> int:
    """
    Simulates VVM (Vaccine Vial Monitor) decay.
    VVM stages: 1 (Fresh) -> 2 (Warn) -> 3 (Danger) -> 4 (Spoiled)
    Based on rough stability profiles (e.g. VVM7 = 7 days at 37C).
    """
    # Simple model: higher temp = faster decay
    # threshold_temp = 37.0 C
    # At 37C, VVM7 decays 1/7 per day = 1/(7*24) per hour
    
    if temp_c <= 8.0:
        decay_rate = 0.0001 # Slow at cold chain
    elif temp_c <= 25.0:
        decay_rate = 0.001
    elif temp_c <= 37.0:
        decay_rate = 0.006 # Stage change every ~40 hours
    else:
        decay_rate = 0.02 # Stage change every ~12 hours
        
    decay_amount = decay_rate * hours
    
    # This is a cumulative check, but for a single reading we just return possible progression
    # In a real system we'd track the state in DB.
    # For now, we'll return a probability or step
    return current_vvm # Logic handled in aggregator
