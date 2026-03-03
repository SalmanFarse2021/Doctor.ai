
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import db
from ai_agent import agent, SymptomAnalysisRequest
from models import User, UserUpdate, HealthProfile, VisitDraft, LabResult, HealthPlan, DailyLog, VoiceChatRequest, Conversation, ChatMessage, HealthPlanRequest
from bson import ObjectId
from datetime import datetime
import json
from pydantic import BaseModel
from typing import List, Optional
from fastapi.responses import StreamingResponse, Response

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.connect()
    yield
    # Shutdown
    db.close()

import os

app = FastAPI(lifespan=lifespan)

# Configure CORS for both local and production
allowed_origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://localhost:3000",
    "https://doctor-ai-01.onrender.com",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Doctor.ai API"}

@app.get("/health")
async def health_check():
    if db.get_db() is not None:
        return {"status": "ok", "database": "connected"}
    return {"status": "error", "database": "disconnected"}

@app.post("/api/users/sync")
async def sync_user(user: User):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    users_collection = database["users"]
    
    existing_user = await users_collection.find_one({"uid": user.uid})
    
    if existing_user:
        # Update last_login and other fields if changed
        update_data = {
            "last_login": datetime.utcnow(),
            "name": user.name,
            "photo_url": user.photo_url,
            "locale": user.locale,
            "timezone": user.timezone
        }
        await users_collection.update_one(
            {"uid": user.uid},
            {"$set": update_data}
        )
        return {"status": "updated", "uid": user.uid}
    else:
        # Create new user
        user_dict = user.dict()
        await users_collection.insert_one(user_dict)
        return {"status": "created", "uid": user.uid}

@app.get("/api/users/{uid}")
async def get_user(uid: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    users_collection = database["users"]
    user = await users_collection.find_one({"uid": uid})
    if user:
        user["_id"] = str(user["_id"])
        return user
    return {"status": "not_found"}

@app.patch("/api/users/{uid}")
async def update_user(uid: str, update: UserUpdate):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    users_collection = database["users"]
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if update_data:
        await users_collection.update_one(
            {"uid": uid},
            {"$set": update_data}
        )
    return {"status": "updated"}

@app.get("/api/users/{uid}/profile")
async def get_health_profile(uid: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    profiles_collection = database["health_profiles"]
    profile = await profiles_collection.find_one({"user_id": uid})
    
    if profile:
        profile["_id"] = str(profile["_id"])
        return profile
    return {"status": "not_found"}

@app.post("/api/users/{uid}/profile")
async def update_health_profile(uid: str, profile: HealthProfile):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    profiles_collection = database["health_profiles"]
    
    # Ensure user_id matches path
    profile.user_id = uid
    profile.updated_at = datetime.utcnow()
    
    await profiles_collection.update_one(
        {"user_id": uid},
        {"$set": profile.dict()},
        upsert=True
    )
    return {"status": "updated", "user_id": uid}

from models import PatientProfile

@app.get("/api/users/{uid}/profiles")
async def get_patient_profiles(uid: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    profiles_collection = database["patient_profiles"]
    cursor = profiles_collection.find({"owner_id": uid})
    profiles = await cursor.to_list(length=20)
    
    for p in profiles:
        p["_id"] = str(p["_id"])
        
    # If no profiles, create default "Self" profile from HealthProfile if exists, or new
    if not profiles:
        # Check HealthProfile
        hp_collection = database["health_profiles"]
        hp = await hp_collection.find_one({"user_id": uid})
        
        new_profile = PatientProfile(
            owner_id=uid,
            name="Self",
            relation="Self"
        )
        
        if hp:
            # Migrate data
            new_profile.dob = hp.get("dob")
            new_profile.gender = hp.get("gender")
            new_profile.blood_type = hp.get("blood_type")
            new_profile.height_cm = hp.get("height_cm")
            new_profile.weight_kg = hp.get("weight_kg")
            new_profile.allergies = hp.get("allergies", [])
            new_profile.conditions = hp.get("conditions", [])
            new_profile.medications = hp.get("medications", [])
            new_profile.emergency_contact_name = hp.get("emergency_contact_name")
            new_profile.emergency_contact_phone = hp.get("emergency_contact_phone")
            
        res = await profiles_collection.insert_one(new_profile.dict(by_alias=True, exclude={"id"}))
        new_profile.id = str(res.inserted_id)
        profiles = [new_profile.dict(by_alias=True)]
        
    return profiles

@app.patch("/api/profiles/{profile_id}")
async def update_patient_profile(profile_id: str, update_data: dict):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    profiles_collection = database["patient_profiles"]
    from bson import ObjectId
    
    # Remove _id if present in update_data to avoid immutable field error
    if "_id" in update_data:
        del update_data["_id"]
        
    # Remove owner_id to prevent changing ownership (optional safety)
    if "owner_id" in update_data:
        del update_data["owner_id"]

    await profiles_collection.update_one(
        {"_id": ObjectId(profile_id)},
        {"$set": update_data}
    )
    return {"status": "updated", "profile_id": profile_id}

@app.post("/api/users/{uid}/profiles")
async def create_patient_profile(uid: str, profile: PatientProfile):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    profiles_collection = database["patient_profiles"]
    profile.owner_id = uid
    res = await profiles_collection.insert_one(profile.dict(exclude={"id"}))
    return {"status": "created", "profile_id": str(res.inserted_id)}

from models import VisitDraft

@app.post("/api/visits/draft")
async def create_visit_draft(draft: VisitDraft):
    print(f"Received draft request: {draft}")
    database = db.get_db()
    if database is None:
        print("Error: Database not connected")
        return {"error": "Database not connected"}
    
    visits_collection = database["visits"]
    
    try:
        visit_dict = draft.dict()
        print(f"Inserting visit: {visit_dict}")
        result = await visits_collection.insert_one(visit_dict)
        print(f"Visit created with ID: {result.inserted_id}")
        
        return {"status": "created", "visit_id": str(result.inserted_id)}
    except Exception as e:
        print(f"Error creating visit draft: {e}")
        return {"error": str(e)}

@app.post("/api/analyze")
async def analyze_symptoms(request: SymptomAnalysisRequest):
    try:
        profile_data = None
        database = db.get_db()
        if database is not None:
            # Check if profile_id is in request (need to update SymptomAnalysisRequest model first ideally, but it's dynamic)
            # Assuming request has profile_id if we update frontend
            # For now, let's try to fetch profile based on user_id or profile_id logic
            
            # Since SymptomAnalysisRequest is imported from ai_agent, we might not be able to modify it easily here.
            # But we can check if we can fetch the profile.
            
            # Actually, let's fetch the profile if user_id is present.
            # If we had profile_id, we would use that.
            # For now, let's assume user_id maps to the main profile or we need to update the request model.
            
            # Let's stick to user_id for now as the request model hasn't been updated in this step explicitly
            # but we should try to find the PatientProfile if we can.
            
            if request.user_id:
                profiles_collection = database["patient_profiles"]
                # Try to find "Self" profile for this user if no specific profile_id passed (which isn't in model yet)
                profile = await profiles_collection.find_one({"owner_id": request.user_id, "relation": "Self"})
                
                # Fallback to HealthProfile if not found (migration logic handled in get_profiles but maybe not here)
                if not profile:
                     hp_collection = database["health_profiles"]
                     profile = await hp_collection.find_one({"user_id": request.user_id})

                if profile:
                    profile_data = f"Age: {calculate_age(profile.get('dob')) if profile.get('dob') else 'Unknown'}, Gender: {profile.get('gender', 'Unknown')}, Conditions: {', '.join(profile.get('conditions', []))}, Meds: {', '.join(profile.get('medications', []))}, Allergies: {', '.join(profile.get('allergies', []))}"

        result_json_str = await agent.analyze_symptoms(request.symptoms, request.language, profile_data)
        result = json.loads(result_json_str)
        return result
    except Exception as e:
        return {"error": str(e)}

from models import SymptomExtractionRequest

@app.post("/api/ai/extract-symptoms")
async def extract_symptoms(request: SymptomExtractionRequest):
    try:
        result_data = await agent.extract_symptoms(request.text, request.language)
        if isinstance(result_data, str):
            try:
                result = json.loads(result_data)
            except json.JSONDecodeError:
                result = {"error": "Invalid JSON from AI", "raw": result_data}
        else:
            result = result_data
        return result
    except Exception as e:
        return {"error": str(e)}

from models import RefinementRequest

@app.post("/api/ai/refine-symptoms")
async def refine_symptoms(request: RefinementRequest):
    try:
        result_data = await agent.suggest_refinements(request.symptoms, request.language)
        if isinstance(result_data, str):
            try:
                result = json.loads(result_data)
            except json.JSONDecodeError:
                result = {"error": "Invalid JSON from AI", "raw": result_data}
        else:
            result = result_data
        return result
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/visits/{visit_id}")
async def get_visit_draft(visit_id: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    visits_collection = database["visits"]
    from bson import ObjectId
    try:
        visit = await visits_collection.find_one({"_id": ObjectId(visit_id)})
        if visit:
            visit["_id"] = str(visit["_id"])
            return visit
        return {"status": "not_found"}
    except:
        return {"status": "invalid_id"}

@app.post("/api/visits/{visit_id}/refinements")
async def save_refinements(visit_id: str, refinements: List[dict]):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    visits_collection = database["visits"]
    from bson import ObjectId
    
    await visits_collection.update_one(
        {"_id": ObjectId(visit_id)},
        {"$set": {"refinements": refinements}}
    )
    return {"status": "updated"}

from models import PredictionRequest

@app.post("/api/ai/predict-conditions")
async def predict_conditions(request: PredictionRequest):
    try:
        # Fetch labs if visit_id exists
        lab_results = request.lab_results
        if not lab_results and request.visit_id:
            database = db.get_db()
            if database is not None:
                labs_collection = database["labs"]
                cursor = labs_collection.find({"visit_id": request.visit_id})
                labs = await cursor.to_list(length=20)
                if labs:
                    lab_results = []
                    for l in labs:
                        l["_id"] = str(l["_id"])
                        if "entries" in l and isinstance(l["entries"], list):
                            lab_results.extend(l["entries"])
                        else:
                            lab_results.append(l)

        result_data = await agent.predict_conditions(
            request.symptoms, 
            request.refinements, 
            request.confirmations, 
            lab_results,
            request.profile_summary,
            request.language
        )
        if isinstance(result_data, str):
            try:
                result = json.loads(result_data)
            except json.JSONDecodeError:
                result = {"error": "Invalid JSON from AI", "raw": result_data}
        else:
            result = result_data
        
        # Save diagnosis to visit
        if request.visit_id:
            database = db.get_db()
            if database is not None:
                visits_collection = database["visits"]
                from bson import ObjectId
                
                update_data = {"diagnosis": result, "status": "COMPLETED"}
                if request.confirmations:
                    update_data["confirmations"] = request.confirmations
                
                await visits_collection.update_one(
                    {"_id": ObjectId(request.visit_id)},
                    {"$set": update_data}
                )
        
        return result
    except Exception as e:
        return {"error": str(e)}

class VoiceChatRequest(BaseModel):
    user_id: str
    message: str
    profile_id: Optional[str] = None
    language: Optional[str] = "English"
    new_session: Optional[bool] = False

@app.post("/api/ai/voice-chat")
async def voice_chat(request: VoiceChatRequest):
    try:
        profile_data = None
        chat_history = []
        database = db.get_db()

        if database is not None:
            # Fetch profile data
            profiles_collection = database["patient_profiles"]
            query = {"owner_id": request.user_id}
            if request.profile_id:
                query["_id"] = ObjectId(request.profile_id)
            else:
                query["relation"] = "Self" # Default to "Self" profile if no profile_id

            profile = await profiles_collection.find_one(query)
            if not profile:
                # Fallback to HealthProfile if not found
                hp_collection = database["health_profiles"]
                profile = await hp_collection.find_one({"user_id": request.user_id})

            if profile:
                profile_data = f"Age: {calculate_age(profile.get('dob')) if profile.get('dob') else 'Unknown'}, Gender: {profile.get('gender', 'Unknown')}, Conditions: {', '.join(profile.get('conditions', []))}, Meds: {', '.join(profile.get('medications', []))}, Allergies: {', '.join(profile.get('allergies', []))}"

            # Fetch chat history if not a new session
            if not request.new_session:
                chat_collection = database["chat_history"]
                history_query = {"user_id": request.user_id}
                if request.profile_id:
                    history_query["profile_id"] = request.profile_id
                
                # Fetch the last N messages for context
                cursor = chat_collection.find(history_query).sort("timestamp", 1).limit(10)
                chat_history_docs = await cursor.to_list(length=10)
                chat_history = [{"role": msg["role"], "content": msg["content"]} for msg in chat_history_docs]

        # Call the AI agent
        response_json_str = await agent.voice_chat(request.message, chat_history, profile_data, request.language)
        response = json.loads(response_json_str)

        # Save current message and AI response to chat history
        if database is not None:
            chat_collection = database["chat_history"]
            timestamp = datetime.utcnow()
            
            user_message_doc = {
                "user_id": request.user_id,
                "profile_id": request.profile_id,
                "role": "user",
                "content": request.message,
                "timestamp": timestamp
            }
            await chat_collection.insert_one(user_message_doc)

            ai_response_doc = {
                "user_id": request.user_id,
                "profile_id": request.profile_id,
                "role": "assistant",
                "content": response.get("response", ""), # Assuming the AI response has a 'response' field
                "timestamp": timestamp
            }
            await chat_collection.insert_one(ai_response_doc)

        return response
    except Exception as e:
        return {"error": str(e)}

class TestRecommendationRequest(BaseModel):
    visit_id: str
    diagnosis: dict
    profile_summary: Optional[str] = None
    language: str = "English"

@app.post("/api/ai/recommend-tests")
async def recommend_tests(request: TestRecommendationRequest):
    try:
        result_json_str = await agent.recommend_tests(request.diagnosis, request.profile_summary, request.language)
        result = json.loads(result_json_str)
        
        # Save tests to visit
        if request.visit_id:
            database = db.get_db()
            if database is not None:
                visits_collection = database["visits"]
                from bson import ObjectId
                await visits_collection.update_one(
                    {"_id": ObjectId(request.visit_id)},
                    {"$set": {"recommended_tests": result}}
                )
        
        return result
    except Exception as e:
        return {"error": str(e)}



@app.post("/api/labs")
async def save_lab_results(result: LabResult):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    labs_collection = database["labs"]
    
    lab_dict = result.dict()
    res = await labs_collection.insert_one(lab_dict)
    
    return {"status": "created", "lab_id": str(res.inserted_id)}

@app.get("/api/visits/{visit_id}/labs")
async def get_visit_labs(visit_id: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    labs_collection = database["labs"]
    cursor = labs_collection.find({"visit_id": visit_id})
    labs = await cursor.to_list(length=100)
    
    for lab in labs:
        lab["_id"] = str(lab["_id"])
        
    return labs

from services.google_fit import fetch_google_fit_data

class GoogleFitSyncRequest(BaseModel):
    access_token: str
    user_id: str

@app.post("/api/integrations/google-fit/sync")
async def sync_google_fit(request: GoogleFitSyncRequest):
    data = await fetch_google_fit_data(request.access_token)
    if not data:
        return {"status": "failed", "error": "Could not fetch data from Google Fit"}
    
    # Save to DailyLog
    database = db.get_db()
    if database is not None:
        logs_collection = database["daily_logs"]
        today = datetime.utcnow().strftime("%Y-%m-%d")
        
        # Update or Insert
        await logs_collection.update_one(
            {"user_id": request.user_id, "date": today},
            {"$set": {
                "steps": data.get("steps"),
                "heart_rate_avg": data.get("heart_rate_avg"),
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
        
    return {"status": "success", "data": data}

@app.get("/api/labs/{lab_id}")
async def get_lab_by_id(lab_id: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    labs_collection = database["labs"]
    from bson import ObjectId
    try:
        lab = await labs_collection.find_one({"_id": ObjectId(lab_id)})
        if lab:
            lab["_id"] = str(lab["_id"])
            return lab
        return {"status": "not_found"}
    except:
        return {"status": "invalid_id"}

from fastapi import UploadFile, File
import pytesseract
from PIL import Image
import io

@app.post("/api/labs/upload")
async def upload_lab_report(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        file_obj = io.BytesIO(contents)
        
        text = ""
        # Check for PDF or Image
        if file.content_type == "application/pdf" or file.filename.lower().endswith(".pdf"):
            # Pass PDF bytes directly to Gemini (supports multimodal PDF)
            result_json_str = await agent.extract_lab_values(contents, mime_type="application/pdf")
        else:
            # Image - Pass bytes directly to Gemini
            result_json_str = await agent.extract_lab_values(contents, mime_type=file.content_type or "image/jpeg")
        
        result = json.loads(result_json_str)
        
        return result
    except Exception as e:
        return {"error": str(e)}

from models import LabInterpretationRequest

@app.post("/api/ai/interpret-labs")
async def interpret_labs(request: LabInterpretationRequest):
    try:
        result_json_str = await agent.interpret_labs(request.lab_results, request.profile_summary, request.language)
        result = json.loads(result_json_str)
        return result
    except Exception as e:
        return {"error": str(e)}




@app.post("/api/tracking/logs")
async def save_daily_log(log: DailyLog):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    logs_collection = database["daily_logs"]
    
    # Check if log exists for this date and profile
    query = {"user_id": log.user_id, "date": log.date}
    if log.profile_id:
        query["profile_id"] = log.profile_id
        
    existing = await logs_collection.find_one(query)
    if existing:
        await logs_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": log.dict(exclude={"created_at"})}
        )
        return {"status": "updated"}
    
    await logs_collection.insert_one(log.dict())
    return {"status": "created"}

@app.get("/api/tracking/logs")
async def get_daily_logs(user_id: str, days: int = 7, profile_id: Optional[str] = None):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    logs_collection = database["daily_logs"]
    query = {"user_id": user_id}
    if profile_id:
        query["profile_id"] = profile_id
        
    cursor = logs_collection.find(query).sort("date", 1).limit(days)
    logs = await cursor.to_list(length=days)
    
    for log in logs:
        log["_id"] = str(log["_id"])
        
    return logs

@app.get("/api/tracking/score")
async def get_health_score(user_id: str, profile_id: Optional[str] = None):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    logs_collection = database["daily_logs"]
    query = {"user_id": user_id}
    if profile_id:
        query["profile_id"] = profile_id
        
    cursor = logs_collection.find(query).sort("date", -1).limit(5)
    logs = await cursor.to_list(length=5)
    
    if not logs:
        return {"score": 0, "trend": "No data"}
    
    def calculate_daily_score(log):
        score = 70 # Base score
        
        # Sleep
        sleep = log.get("sleep_hours", 0) or 0
        if sleep >= 7 and sleep <= 9: score += 10
        elif sleep >= 5: score += 5
        else: score -= 10
        
        # Hydration
        water = log.get("hydration_liters", 0) or 0
        if water >= 2: score += 5
        elif water < 1: score -= 5
        
        # Pain
        pain = log.get("pain", 0) or 0
        if pain == 0: score += 10
        elif pain <= 3: score += 5
        elif pain <= 6: score -= 5
        else: score -= 15
        
        # Energy
        energy = log.get("energy", 5) or 5
        if energy >= 8: score += 5
        elif energy <= 3: score -= 5
        
        # Fever (Temp in C)
        fever = log.get("fever")
        if fever:
            if 36.1 <= fever <= 37.2: score += 5
            elif fever > 37.5: score -= 10
            
        # Heart Rate
        hr = log.get("heart_rate_avg")
        if hr:
            if 60 <= hr <= 100: score += 5
            else: score -= 5
            
        # Blood Pressure
        sys = log.get("blood_pressure_systolic")
        dia = log.get("blood_pressure_diastolic")
        if sys and dia:
            if 90 <= sys <= 120 and 60 <= dia <= 80: score += 10
            elif sys > 140 or dia > 90: score -= 10
            
        return min(100, max(0, score))
    
    latest = logs[0]
    score = calculate_daily_score(latest)
    
    # Trend
    trend = "Stable"
    if len(logs) > 1:
        prev = logs[1]
        prev_score = calculate_daily_score(prev)
        
        if score > prev_score: trend = "Improving"
        elif score < prev_score: trend = "Declining"
        
    return {"score": score, "trend": trend}

@app.get("/api/users/{user_id}/visits")
async def get_user_visits(user_id: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    visits_collection = database["visits"]
    cursor = visits_collection.find({"user_id": user_id}).sort("created_at", -1)
    visits = await cursor.to_list(length=100)
    
    for visit in visits:
        visit["_id"] = str(visit["_id"])
        
    return visits

@app.get("/api/users/{user_id}/labs")
async def get_user_labs(user_id: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    labs_collection = database["labs"]
    cursor = labs_collection.find({"user_id": user_id}).sort("date", -1)
    labs = await cursor.to_list(length=100)
    
    for lab in labs:
        lab["_id"] = str(lab["_id"])
        
    return labs

@app.delete("/api/visits/{visit_id}")
async def delete_visit(visit_id: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    visits_collection = database["visits"]
    from bson import ObjectId
    try:
        result = await visits_collection.delete_one({"_id": ObjectId(visit_id)})
        if result.deleted_count == 1:
            return {"status": "deleted"}
        return {"status": "not_found"}
    except:
        return {"status": "invalid_id"}

@app.delete("/api/labs/{lab_id}")
async def delete_lab(lab_id: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    labs_collection = database["labs"]
    from bson import ObjectId
    try:
        result = await labs_collection.delete_one({"_id": ObjectId(lab_id)})
        if result.deleted_count == 1:
            return {"status": "deleted"}
        return {"status": "not_found"}
    except:
        return {"status": "invalid_id"}

def calculate_age(dob_str):
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d")
        today = datetime.utcnow()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except:
        return "Unknown"


@app.post("/api/ai/generate-plan")
async def generate_plan(request: HealthPlanRequest):
    # Fetch daily logs
    database = db.get_db()
    daily_logs = []
    if database:
        logs_collection = database["daily_logs"]
        cursor = logs_collection.find({"user_id": request.user_id}).sort("date", -1).limit(7)
        daily_logs = await cursor.to_list(length=7)
        for log in daily_logs:
            log["_id"] = str(log["_id"])

    plan = await agent.generate_health_plan(
        diagnosis=request.diagnosis,
        symptoms=request.symptoms,
        labs=request.labs,
        profile_summary=request.profile_summary,
        daily_logs=daily_logs,
        language=request.language
    )
    
    if isinstance(plan, str):
        try:
             result = json.loads(plan)
        except json.JSONDecodeError:
             result = {"error": "Invalid JSON from AI", "raw": plan}
    else:
        result = plan

    # Save plan to database
    try:
        db_plan = HealthPlan(
            visit_id=request.visit_id,
            user_id=request.user_id,
            **result
        )
        
        if database:
            plans_collection = database["health_plans"]
            res = await plans_collection.insert_one(db_plan.dict())
            result["plan_id"] = str(res.inserted_id)
    except Exception as e:
        print(f"Error saving plan: {e}")
        # Return result anyway

    return result

@app.delete("/api/voice-chat/reset")
async def reset_voice_chat(user_id: str, profile_id: Optional[str] = None):
    """Reset/clear conversation history for a user/profile"""
    try:
        print(f"[RESET] Request to reset conversation for user_id={user_id}, profile_id={profile_id}")
        
        database = db.get_db()
        if database is None:
            print("[RESET] Database not connected")
            return {"error": "Database not connected"}
        
        conversations_collection = database["conversations"]
        
        # Build query - if no profile_id, delete ALL conversations for this user
        if profile_id and profile_id != 'null' and profile_id != '':
            query = {"user_id": user_id, "profile_id": profile_id}
            print(f"[RESET] Deleting conversation for specific profile")
        else:
            query = {"user_id": user_id}
            print(f"[RESET] Deleting ALL conversations for user")
        
        print(f"[RESET] Query: {query}")
        
        # Delete matching conversations (delete_many to be safe)
        result = await conversations_collection.delete_many(query)
        
        print(f"[RESET] Deleted {result.deleted_count} conversation(s)")
        
        return {
            "success": True,
            "deleted": result.deleted_count > 0,
            "deleted_count": result.deleted_count,
            "message": "Conversation reset successfully",
            "query": str(query)
        }
    except Exception as e:
        print(f"[RESET] Error resetting conversation: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.post("/api/voice-chat")
async def voice_chat(request: VoiceChatRequest):
    try:
        print(f"[VOICE-CHAT] Request from user_id={request.user_id}, profile_id={request.profile_id}")
        
        database = db.get_db()
        if database is None:
            return {"error": "Database not connected"}
        
        conversations_collection = database["conversations"]
        profiles_collection = database["patient_profiles"]
        
        # Get or create conversation
        query = {"user_id": request.user_id}
        if request.profile_id:
            query["profile_id"] = request.profile_id
        
        print(f"[VOICE-CHAT] Looking for conversation with query: {query}")
            
        # Try to find existing conversation unless new_session is requested
        conversation = None
        if not request.new_session:
            try:
                conversation = await conversations_collection.find_one(query)
                if conversation:
                    print(f"[VOICE-CHAT] Found existing conversation with {len(conversation.get('messages', []))} messages")
                else:
                    print(f"[VOICE-CHAT] No existing conversation found")
            except Exception as e:
                print(f"[VOICE-CHAT] Error finding conversation: {e}")
                conversation = None
        else:
             print(f"[VOICE-CHAT] New session requested, forcing new conversation.")
        
        if not conversation:
            print(f"[VOICE-CHAT] Creating new conversation with language={request.language}")
            conversation = Conversation(
                user_id=request.user_id,
                profile_id=request.profile_id,
                language=request.language
            )
            try:
                res = await conversations_collection.insert_one(conversation.dict(exclude={"id"}))
                conversation_id = res.inserted_id
                messages = []
                current_language = request.language
            except Exception as e:
                print(f"[VOICE-CHAT] Error creating conversation: {e}")
                # Continue without saving conversation
                conversation_id = None
                messages = []
                current_language = request.language
        else:
            conversation_id = conversation["_id"]
            messages = conversation.get("messages", [])
            current_language = conversation.get("language", "English")
            
            # Update language if changed
            if request.language != current_language:
                print(f"[VOICE-CHAT] Language changed from {current_language} to {request.language}")
                current_language = request.language
            
        # Get profile summary
        profile_summary = "No profile data."
        if request.profile_id:
            try:
                profile = await profiles_collection.find_one({"_id": ObjectId(request.profile_id)})
                if profile:
                    profile_summary = f"Name: {profile.get('name')}, Age: {profile.get('dob')}, Gender: {profile.get('gender')}, Conditions: {', '.join(profile.get('conditions', []))}, Meds: {', '.join(profile.get('medications', []))}"
            except Exception as e:
                print(f"Error getting profile: {e}")
                pass
                
        # Call AI Agent
        # Convert messages to dict for agent
        history_dicts = [{"role": m["role"], "content": m["content"]} for m in messages[-10:]] # Last 10 messages context
        
        try:
            ai_response_text = await agent.chat_with_doctor(
                message=request.message,
                history=history_dicts,
                profile_summary=profile_summary,
                language=current_language  # Use current language preference
            )
        except Exception as e:
            print(f"Error calling AI agent: {e}")
            return {"error": f"AI service error: {str(e)}"}
        
        # Update conversation
        if conversation_id:
            try:
                new_user_msg = ChatMessage(role="user", content=request.message)
                new_ai_msg = ChatMessage(role="assistant", content=ai_response_text)
                
                await conversations_collection.update_one(
                    {"_id": conversation_id},
                    {
                        "$push": {"messages": {"$each": [new_user_msg.dict(), new_ai_msg.dict()]}},
                        "$set": {
                            "updated_at": datetime.utcnow(),
                            "language": current_language  # Store language preference
                        }
                    }
                )
            except Exception as e:
                print(f"Error updating conversation: {e}")
                # Continue anyway, we have the response
        
        return {"response": ai_response_text}
    
    except Exception as e:
        print(f"Voice chat error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Server error: {str(e)}"}


# --- Premium TTS Endpoints ---

from utils.text_normalizer import normalize_for_tts, extract_voice_summary
from utils.sentence_splitter import split_into_sentences, format_for_doctor_tone
from utils.tts_cache import tts_cache, chunk_store
from openai import AsyncOpenAI
import time
import uuid

# Initialize OpenAI client for TTS
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# TTS Configuration
TTS_MODEL = os.getenv("TTS_MODEL", "gpt-4o-mini-tts")
TTS_VOICE = os.getenv("TTS_VOICE", "alloy")
TTS_FORMAT = os.getenv("TTS_FORMAT", "mp3")


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"
    format: Optional[str] = "mp3"


class TTSChunksRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"
    lang: Optional[str] = "English"


@app.post("/api/voice/speak")
async def speak_single(request: TTSRequest):
    """
    Generate single TTS audio from text
    Returns audio/mpeg bytes
    """
    try:
        # Normalize text
        normalized_text = normalize_for_tts(request.text, "English")
        
        if not normalized_text:
            return Response(content=b"", media_type="audio/mpeg")
        
        # Check cache
        cached_audio = tts_cache.get(TTS_MODEL, request.voice, normalized_text)
        if cached_audio:
            print(f"[TTS] Cache HIT for text: {normalized_text[:50]}...")
            return Response(content=cached_audio, media_type="audio/mpeg")
        
        # Generate TTS
        print(f"[TTS] Generating audio for: {normalized_text[:50]}...")
        start_time = time.time()
        
        response = await openai_client.audio.speech.create(
            model=TTS_MODEL,
            voice=request.voice,
            input=normalized_text,
            response_format=request.format
        )
        
        audio_bytes = response.content
        generation_time = time.time() - start_time
        
        # Cache result
        tts_cache.set(TTS_MODEL, request.voice, normalized_text, audio_bytes, generation_time)
        
        print(f"[TTS] Generated in {generation_time:.2f}s")
        
        return Response(content=audio_bytes, media_type="audio/mpeg")
    
    except Exception as e:
        print(f"[TTS] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


@app.post("/api/voice/speak-chunks")
async def speak_chunks(request: TTSChunksRequest):
    """
    Generate chunked TTS audio for smooth playback
    Returns chunk metadata with URLs
    """
    try:
        # Extract voice-friendly summary if text is too long
        voice_text, caption_text = extract_voice_summary(request.text, max_chars=900)
        
        # Normalize
        normalized_text = normalize_for_tts(voice_text, request.lang)
        
        if not normalized_text:
            return {"chunks": [], "caption": caption_text}
        
        # Split into sentences
        sentences = split_into_sentences(normalized_text, request.lang, max_sentences=12)
        sentences = format_for_doctor_tone(sentences, request.lang)
        
        print(f"[TTS-CHUNKS] Processing {len(sentences)} sentences")
        
        # Generate session ID
        session_id = str(uuid.uuid4())[:8]
        
        chunks_data = []
        
        # Generate audio for each sentence
        for i, sentence in enumerate(sentences):
            chunk_id = f"c{i+1}"
            
            # Check cache
            cached_audio = tts_cache.get(TTS_MODEL, request.voice, sentence)
            
            if cached_audio:
                print(f"[TTS-CHUNKS] Cache HIT for chunk {chunk_id}")
                audio_bytes = cached_audio
            else:
                print(f"[TTS-CHUNKS] Generating chunk {chunk_id}: {sentence[:40]}...")
                start_time = time.time()
                
                response = await openai_client.audio.speech.create(
                    model=TTS_MODEL,
                    voice=request.voice,
                    input=sentence,
                    response_format="mp3"
                )
                
                audio_bytes = response.content
                generation_time = time.time() - start_time
                
                # Cache
                tts_cache.set(TTS_MODEL, request.voice, sentence, audio_bytes, generation_time)
                print(f"[TTS-CHUNKS] Generated in {generation_time:.2f}s")
            
            chunks_data.append((chunk_id, audio_bytes, sentence))
        
        # Store chunks
        chunk_metadata = chunk_store.save_chunks(session_id, chunks_data)
        
        # Get cache stats
        stats = tts_cache.get_stats()
        print(f"[TTS-CHUNKS] Cache stats: {stats['hit_rate']}% hit rate")
        
        return {
            "session_id": session_id,
            "chunks": chunk_metadata,
            "caption": caption_text,
            "cache_stats": stats
        }
    
    except Exception as e:
        print(f"[TTS-CHUNKS] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


@app.get("/api/voice/chunk/{session_id}/{chunk_id}")
async def get_chunk(session_id: str, chunk_id: str):
    """
    Retrieve a specific audio chunk
    Returns audio/mpeg bytes
    """
    try:
        audio_bytes = chunk_store.get_chunk(session_id, chunk_id)
        
        if audio_bytes is None:
            return Response(
                content=json.dumps({"error": "Chunk not found or expired"}),
                status_code=404,
                media_type="application/json"
            )
        
        return Response(content=audio_bytes, media_type="audio/mpeg")
    
    except Exception as e:
        print(f"[TTS-CHUNK] Error: {e}")
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=500,
            media_type="application/json"
        )


@app.get("/api/voice/cache-stats")
async def cache_stats():
    """Get TTS cache statistics"""
    return tts_cache.get_stats()


# --- Voice Doctor Endpoints ---

class VoiceSessionCreate(BaseModel):
    user_id: str
    profile_id: Optional[str] = None

class VoiceAnalyzeRequest(BaseModel):
    session_id: str
    text: str

class VoiceSpeakRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"

@app.post("/api/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...)):
    try:
        content = await file.read()
        # Create a "file-like" tuple for OpenAI
        # We can use file.filename or just "audio.webm"
        result = await agent.transcribe_audio(content, filename=file.filename or "audio.webm")
        if "error" in result:
             return {"error": result["error"]}
        return result
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/voice/session")
async def create_voice_session(request: VoiceSessionCreate):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    sessions_collection = database["voice_sessions"]
    
    session_data = {
        "user_id": request.user_id,
        "profile_id": request.profile_id,
        "messages": [], # {role, content, timestamp}
        "stage": "INTAKE", # INTAKE, REFINE, PREDICT, DONE
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    res = await sessions_collection.insert_one(session_data)
    return {"session_id": str(res.inserted_id), "status": "created"}

@app.get("/api/voice/session/{session_id}")
async def get_voice_session(session_id: str):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    sessions_collection = database["voice_sessions"]
    try:
        session = await sessions_collection.find_one({"_id": ObjectId(session_id)})
        if session:
            session["_id"] = str(session["_id"])
            return session
        return {"error": "Session not found"}
    except:
        return {"error": "Invalid session ID"}

@app.post("/api/voice/speak")
async def voice_speak(request: VoiceSpeakRequest):
    audio_bytes = await agent.generate_audio(request.text, request.voice)
    if not audio_bytes:
        return {"error": "Failed to generate audio"}
    
    return Response(content=audio_bytes, media_type="audio/mpeg")

@app.post("/api/voice/analyze")
async def analyze_voice_session(request: VoiceAnalyzeRequest):
    database = db.get_db()
    if database is None:
        return {"error": "Database not connected"}
    
    sessions_collection = database["voice_sessions"]
    
    # 1. Fetch Session
    try:
        session_id = ObjectId(request.session_id)
        session = await sessions_collection.find_one({"_id": session_id})
        if not session:
            return {"error": "Session not found"}
    except:
        return {"error": "Invalid session ID"}
    
    # 2. Append User Message
    user_msg = {"role": "user", "content": request.text, "ts": datetime.utcnow()}
    await sessions_collection.update_one(
        {"_id": session_id},
        {"$push": {"messages": user_msg}, "$set": {"updated_at": datetime.utcnow()}}
    )
    
    # 3. Analyze Logic
    # We want to mimic the text flow: Extract -> Analyze -> Suggest/Predict
    
    # A. Extract Symptoms & Red Flags first
    # We combine previous user messages + current text for better extraction? 
    # Or just current text? Let's use current text + recent context if needed.
    # For now, just current text to keep it simple, or full conversation?
    # extract_symptoms expects "text".
    
    full_context_text = request.text # Or construct from history
    
    # Optional: Retrieve profile for context
    profile_data = "Unknown"
    if session.get("profile_id"):
        # Fetch profile... (omitted for brevity, can implement if needed)
        pass

    # Call AI Agent to "Chat/Analyze"
    # We'll use a specific logic: 
    # If explicit "diagnose me" or enough symptoms -> Predict
    # Else -> Gather info (Intake)
    
    # Let's try to Extract Symptoms first
    extraction = await agent.extract_symptoms(request.text)
    extracted_symptoms = []
    red_flags = []
    
    if isinstance(extraction, str):
         try: extraction = json.loads(extraction) 
         except: pass
         
    if isinstance(extraction, dict):
        extracted_symptoms = extraction.get("symptoms", [])
        red_flags = extraction.get("redFlagsDetected", [])

    # Decide Stage
    current_stage = session.get("stage", "INTAKE")
    
    # If red flags -> URGENT
    urgency = "low"
    if red_flags:
        urgency = "high"
    
    # Generate Assistant Reply
    # We use chat_with_doctor to get a conversational reply + questions
    # But we also want "Suggested Symptoms" buttons (Follow-ups)
    
    # Get history for context
    history = session.get("messages", []) + [user_msg]
    # Limit history to last 10 messages
    history_tuples = [{"role": m["role"], "content": m["content"]} for m in history[-10:]]

    # Generate conversational reply
    reply_text = await agent.chat_with_doctor(
        message=request.text,
        history=history_tuples[:-1], # Exclude current message from history param as it's passed as message
        profile_summary=None, # Todo: fetch
        language="English"
    )
    
    # Generate Follow-up Options (Suggested Symptoms)
    # If we found symptoms, assume we are in "REFINE" or "INTAKE" -> suggest related
    suggested_symptoms = []
    if extracted_symptoms:
        # Get existing symptom names
        symptom_names = [s["name"] for s in extracted_symptoms]
        # Call refinement
        refinements = await agent.suggest_refinements(symptom_names)
        if isinstance(refinements, str):
             try: refinements = json.loads(refinements)
             except: pass
        
        if isinstance(refinements, dict):
             groups = refinements.get("groups", [])
             for g in groups:
                 suggested_symptoms.extend([{"label": s, "key": s} for s in g.get("symptoms", [])[:4]]) # Limit to 4
    
    # Save Assistant Message
    asst_msg = {"role": "assistant", "content": reply_text, "ts": datetime.utcnow()}
    await sessions_collection.update_one(
        {"_id": session_id},
        {"$push": {"messages": asst_msg}}
    )
    
    return {
        "reply": reply_text,
        "suggestedSymptoms": suggested_symptoms, # For buttons
        "urgency": urgency,
        "stage": current_stage,
        "redFlags": red_flags
    }
# Reload trigger
# Reloader
# Reload for model update
