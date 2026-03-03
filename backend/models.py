from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime

class HealthProfile(BaseModel):
    user_id: str
    dob: Optional[str] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    allergies: List[str] = []
    conditions: List[str] = []
    medications: List[str] = []
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PatientProfile(BaseModel):
    owner_id: str
    name: str
    relation: str = "Self"
    dob: Optional[str] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    allergies: List[str] = []
    conditions: List[str] = []
    medications: List[str] = []
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VisitDraft(BaseModel):
    user_id: str
    profile_id: Optional[str] = None
    symptoms: str
    duration: Optional[str] = None
    severity: Optional[int] = None # 1-10
    age: Optional[int] = None
    gender: Optional[str] = None
    extracted_data: Optional[dict] = None
    refinements: Optional[List[dict]] = None
    confirmations: Optional[List[dict]] = None
    diagnosis: Optional[dict] = None
    recommended_tests: Optional[dict] = None
    status: str = "DRAFT"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RefinementRequest(BaseModel):
    symptoms: List[dict]
    language: str = "English"

class SymptomExtractionRequest(BaseModel):
    text: str
    language: str = "English"



class PredictionRequest(BaseModel):
    visit_id: str
    symptoms: List[dict]
    refinements: List[dict]
    confirmations: Optional[List[dict]] = None
    lab_results: Optional[List[dict]] = None
    profile_summary: Optional[str] = None
    language: str = "English"

class LabEntry(BaseModel):
    name: str
    value: float
    unit: str
    reference_range: Optional[str] = None

class LabResult(BaseModel):
    visit_id: Optional[str] = None
    user_id: str
    profile_id: Optional[str] = None
    test_type: str # e.g., "CBC", "LFT"
    entries: List[LabEntry]
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LabInterpretationRequest(BaseModel):
    lab_results: List[dict]
    profile_summary: Optional[str] = None
    language: str = "English"

class HealthPlanRequest(BaseModel):
    visit_id: Optional[str] = None
    user_id: str
    diagnosis: Optional[dict] = None
    symptoms: Optional[str] = None
    labs: Optional[List[dict]] = None
    profile_summary: Optional[str] = None
    language: str = "English"

class MedicationEducation(BaseModel):
    generic_name: str
    brand_names: Optional[dict] = None
    category: str
    commonly_used_for: List[str]
    general_usage: str
    how_to_take: str
    duration: str
    avoid_if: List[str]
    side_effects: List[str]
    warnings: List[str]
    age_note: str
    pregnancy_warning: bool
    emergency_signs: List[str]
    disclaimer: bool = True

class HealthPlan(BaseModel):
    visit_id: Optional[str] = None
    user_id: str
    profile_id: Optional[str] = None
    diet: List[str]
    lifestyle: List[str]
    hydration: List[str]
    daily_tracking: List[str]
    med_education: List[MedicationEducation]
    warnings: List[str]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DailyLog(BaseModel):
    user_id: str
    profile_id: Optional[str] = None
    date: str # YYYY-MM-DD
    fever: Optional[float] = None
    pain: Optional[int] = None # 1-10
    sleep_hours: Optional[float] = None
    hydration_liters: Optional[float] = None
    appetite: Optional[str] = None # Poor, Fair, Good
    energy: Optional[int] = None # 1-10
    steps: Optional[int] = None
    heart_rate_avg: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class User(BaseModel):
    uid: str
    name: str
    email: EmailStr
    photo_url: Optional[str] = None
    locale: Optional[str] = None
    timezone: Optional[str] = None
    language: str = "English"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime = Field(default_factory=datetime.utcnow)
    health_profile: Optional[HealthProfile] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    photo_url: Optional[str] = None
    locale: Optional[str] = None
    timezone: Optional[str] = None
    last_login: Optional[datetime] = None

class ChatMessage(BaseModel):
    role: str # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Conversation(BaseModel):
    user_id: str
    profile_id: Optional[str] = None
    messages: List[ChatMessage] = []
    language: str = "English"  # NEW: "English" or "Bengali"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class VoiceChatRequest(BaseModel):
    user_id: str
    profile_id: Optional[str] = None
    message: str
    language: str = "English"
