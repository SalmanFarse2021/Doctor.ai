
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.connect()
    yield
    # Shutdown
    db.close()

import os

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
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

class PlanGenerationRequest(BaseModel):
    visit_id: Optional[str] = None
    user_id: str
    diagnosis: Optional[dict] = None
    labs: Optional[List[dict]] = None
    profile_summary: Optional[str] = None
    language: str = "English"

@app.post("/api/ai/generate-plan")
async def generate_plan(request: PlanGenerationRequest):
    try:
        # Fetch recent logs
        daily_logs = []
        database = db.get_db()
        if database is not None:
            logs_collection = database["daily_logs"]
            cursor = logs_collection.find({"user_id": request.user_id}).sort("date", -1).limit(3)
            logs = await cursor.to_list(length=3)
            for log in logs:
                if "_id" in log:
                    log["_id"] = str(log["_id"])
                daily_logs.append(log)

        result_data = await agent.generate_health_plan(request.diagnosis, request.labs, request.profile_summary, daily_logs, request.language)
        if isinstance(result_data, str):
            try:
                result = json.loads(result_data)
            except json.JSONDecodeError:
                result = {"error": "Invalid JSON from AI", "raw": result_data}
        else:
            result = result_data
        
        # Save plan to database
        plan = HealthPlan(
            visit_id=request.visit_id,
            user_id=request.user_id,
            **result
        )
        
        database = db.get_db()
        if database is not None:
            plans_collection = database["health_plans"]
            res = await plans_collection.insert_one(plan.dict())
            result["plan_id"] = str(res.inserted_id)
            
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
    return plan

@app.post("/api/voice-chat")
async def voice_chat(request: VoiceChatRequest):
    try:
        database = db.get_db()
        if database is None:
            return {"error": "Database not connected"}
        
        conversations_collection = database["conversations"]
        profiles_collection = database["patient_profiles"]
        
        # Get or create conversation
        query = {"user_id": request.user_id}
        if request.profile_id:
            query["profile_id"] = request.profile_id
            
        try:
            conversation = conversations_collection.find_one(query)
        except Exception as e:
            print(f"Error finding conversation: {e}")
            conversation = None
        
        if not conversation:
            conversation = Conversation(
                user_id=request.user_id,
                profile_id=request.profile_id
            )
            try:
                res = conversations_collection.insert_one(conversation.dict(exclude={"id"}))
                conversation_id = res.inserted_id
                messages = []
            except Exception as e:
                print(f"Error creating conversation: {e}")
                # Continue without saving conversation
                conversation_id = None
                messages = []
        else:
            conversation_id = conversation["_id"]
            messages = conversation.get("messages", [])
            
        # Get profile summary
        profile_summary = "No profile data."
        if request.profile_id:
            try:
                profile = profiles_collection.find_one({"_id": ObjectId(request.profile_id)})
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
                language=request.language
            )
        except Exception as e:
            print(f"Error calling AI agent: {e}")
            return {"error": f"AI service error: {str(e)}"}
        
        # Update conversation
        if conversation_id:
            try:
                new_user_msg = ChatMessage(role="user", content=request.message)
                new_ai_msg = ChatMessage(role="assistant", content=ai_response_text)
                
                conversations_collection.update_one(
                    {"_id": conversation_id},
                    {
                        "$push": {"messages": {"$each": [new_user_msg.dict(), new_ai_msg.dict()]}},
                        "$set": {"updated_at": datetime.utcnow()}
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

