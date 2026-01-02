
# Common Lab Reference Ranges
# These are general reference ranges and may vary by laboratory.

REFERENCE_RANGES = {
    "Hemoglobin": {
        "male": {"min": 13.5, "max": 17.5, "unit": "g/dL"},
        "female": {"min": 12.0, "max": 15.5, "unit": "g/dL"},
        "children": {"min": 11.0, "max": 13.0, "unit": "g/dL"} # Simplified
    },
    "Hematocrit": {
        "male": {"min": 38.8, "max": 50.0, "unit": "%"},
        "female": {"min": 34.9, "max": 44.5, "unit": "%"}
    },
    "WBC (White Blood Cells)": {
        "all": {"min": 4.5, "max": 11.0, "unit": "x10^3/µL"}
    },
    "RBC (Red Blood Cells)": {
        "male": {"min": 4.32, "max": 5.72, "unit": "x10^6/µL"},
        "female": {"min": 3.90, "max": 5.03, "unit": "x10^6/µL"}
    },
    "Platelets": {
        "all": {"min": 150, "max": 450, "unit": "x10^3/µL"}
    },
    "Glucose (Fasting)": {
        "all": {"min": 70, "max": 99, "unit": "mg/dL"}
    },
    "Hemoglobin A1c": {
        "all": {"min": 0, "max": 5.7, "unit": "%"} # < 5.7 Normal
    },
    "Total Cholesterol": {
        "all": {"min": 0, "max": 200, "unit": "mg/dL"}
    },
    "LDL Cholesterol": {
        "all": {"min": 0, "max": 100, "unit": "mg/dL"}
    },
    "HDL Cholesterol": {
        "male": {"min": 40, "max": 100, "unit": "mg/dL"}, # > 40
        "female": {"min": 50, "max": 100, "unit": "mg/dL"} # > 50
    },
    "Triglycerides": {
        "all": {"min": 0, "max": 150, "unit": "mg/dL"}
    },
    "Sodium": {
        "all": {"min": 135, "max": 145, "unit": "mEq/L"}
    },
    "Potassium": {
        "all": {"min": 3.5, "max": 5.2, "unit": "mEq/L"}
    },
    "Creatinine": {
        "male": {"min": 0.74, "max": 1.35, "unit": "mg/dL"},
        "female": {"min": 0.59, "max": 1.04, "unit": "mg/dL"}
    },
    "BUN (Blood Urea Nitrogen)": {
        "all": {"min": 7, "max": 20, "unit": "mg/dL"}
    },
    "ALT (Alanine Aminotransferase)": {
        "male": {"min": 0, "max": 50, "unit": "U/L"}, # Varies widely
        "female": {"min": 0, "max": 35, "unit": "U/L"}
    },
    "AST (Aspartate Aminotransferase)": {
        "male": {"min": 0, "max": 50, "unit": "U/L"},
        "female": {"min": 0, "max": 35, "unit": "U/L"}
    },
    "TSH (Thyroid Stimulating Hormone)": {
        "all": {"min": 0.4, "max": 4.0, "unit": "mIU/L"}
    },
    "Vitamin D (25-Hydroxy)": {
        "all": {"min": 20, "max": 50, "unit": "ng/mL"} # 20-50 is often considered adequate, >30 preferred
    }
}

def get_reference_range(test_name, gender="male", age=30):
    """
    Helper to get the range for a specific test, gender, and age.
    """
    # Normalize test name (simple substring match for now)
    test_key = None
    for key in REFERENCE_RANGES.keys():
        if key.lower() in test_name.lower() or test_name.lower() in key.lower():
            test_key = key
            break
    
    if not test_key:
        return None
        
    ranges = REFERENCE_RANGES[test_key]
    
    # Check gender specific
    gender = gender.lower()
    if gender in ranges:
        return ranges[gender]
    elif "all" in ranges:
        return ranges["all"]
    elif gender == "female" and "male" in ranges:
         # Fallback if only male defined (unlikely but safe)
         return ranges["male"]
    elif gender == "male" and "female" in ranges:
        return ranges["female"]
        
    return None
