import os
import json
import re
import random
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
import base64
from typing import List, Optional, Union
from reference_data import get_reference_range

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

class SymptomAnalysisRequest(BaseModel):
    symptoms: str
    user_id: Optional[str] = None
    language: Optional[str] = "English"

class AIResponse(BaseModel):
    analysis: str
    clarifying_questions: List[str]
    potential_conditions: List[str]
    recommended_actions: List[str]

class DoctorAgent:
    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-flash-latest",
            google_api_key=GEMINI_API_KEY,
            temperature=0.3,
            max_retries=1,
            request_timeout=10
        )

    async def analyze_symptoms(self, symptoms: str, language: str = "English", profile_data: str = None) -> dict:
        prompt_template = """
        You are an advanced AI Health Diagnostic Assistant. Your goal is to help users understand their symptoms, 
        suggest potential conditions, and provide guidance. You are NOT a doctor, so always include a disclaimer.

        User Symptoms: {symptoms}
        Target Language: {language}
        Patient Profile: {profile_data}

        1. **Safety Check**: First, evaluate if these symptoms indicate a life-threatening emergency (e.g., heart attack, stroke, severe bleeding, difficulty breathing). 
           If YES, set "is_emergency" to true and provide immediate instructions to call emergency services.

        2. **Contextual Analysis**: Use the Patient Profile (age, gender, conditions, meds) to refine your analysis. For example, consider pregnancy, diabetic complications, or drug interactions if relevant.

        3. **HPO Mapping**: Map the user's described symptoms to standard Human Phenotype Ontology (HPO) terms and IDs where possible.

        4. **Analysis**: Analyze the symptoms to suggest potential conditions.

        Please provide a structured response in the following JSON format:
        {{
            "is_emergency": boolean,
            "emergency_warning": "Urgent message if emergency, else null",
            "summary": "Brief summary of the symptoms and severity in {language}. Mention relevant profile factors.",
            "hpo_terms": [
                {{"term": "HPO Term Name", "id": "HP:0000000"}}
            ],
            "clarifying_questions": ["List of 3-5 relevant questions to narrow down the diagnosis in {language}"],
            "potential_conditions": [
                {{
                    "name": "Condition Name",
                    "probability": "High/Medium/Low",
                    "reasoning": "Why this matches in {language}"
                }}
            ],
            "recommended_actions": ["Immediate steps to take in {language}", "Lifestyle advice in {language}"],
            "red_flags": ["Urgent warning signs to watch for in {language}"]
        }}
        
        Ensure the output is valid JSON. Do not include markdown formatting like ```json.
        """

        prompt = PromptTemplate(
            input_variables=["symptoms", "language", "profile_data"],
            template=prompt_template
        )

        chain = prompt | self.llm
        
        profile_str = profile_data if profile_data else "No profile available."

        response = await chain.ainvoke({"symptoms": symptoms, "language": language, "profile_data": profile_str})
        return self._clean_response(response.content)

    async def extract_symptoms(self, text: str, language: str = "English") -> dict:
        try:
            prompt_template = """
            You are an expert medical AI. Extract symptoms from the user's text.
            
            User Input: {text}
            Language: {language}

            Task:
            1. Identify all symptoms mentioned.
            2. For each symptom, provide the exact name mentioned, a normalized medical term (e.g., "hurt head" -> "Headache"), and a confidence score (0.0-1.0).
            3. Extract the overall duration and severity (1-10) if mentioned.
            4. Identify any red flags or emergency signs.
            5. Return the output in {language}, but keep the 'normalizedName' in English for standardization.

            Return a valid JSON object with the following structure:
            {{
                "symptoms": [
                    {{
                        "name": "Exact text from user",
                        "normalizedName": "Standard Medical Term (English)",
                        "confidence": 0.95
                    }}
                ],
                "duration": "e.g., 2 days",
                "severity": "e.g., 5",
                "redFlagsDetected": ["List of emergency signs found"]
            }}
            """
            prompt = PromptTemplate(input_variables=["text", "language"], template=prompt_template)
            chain = prompt | self.llm
            response = await chain.ainvoke({"text": text, "language": language})
            result = self._clean_response(response.content)
            
            # Merge rule-based red flags
            try:
                if isinstance(result, str):
                    result_dict = json.loads(result)
                else:
                    result_dict = result
                    
                rule_flags = self.detect_red_flags(text)
                if rule_flags:
                    if "redFlagsDetected" not in result_dict:
                        result_dict["redFlagsDetected"] = []
                    result_dict["redFlagsDetected"].extend(rule_flags)
                    result_dict["redFlagsDetected"] = list(set(result_dict["redFlagsDetected"]))
                
                return json.dumps(result_dict)
            except:
                return result
        except Exception as e:
            print(f"AI Error (extract_symptoms): {e}")
            # Mock Fallback
            return {
                "symptoms": [{"name": text, "normalizedName": "Reported Symptom", "confidence": 1.0}],
                "duration": "Unknown",
                "severity": "Unknown",
                "redFlagsDetected": []
            }

    async def suggest_refinements(self, symptoms: List[dict], language: str = "English") -> dict:
        try:
            prompt_template = """
            You are a medical assistant. Based on the initial symptoms, suggest related symptoms to check for.
            
            Initial Symptoms: {symptoms}
            Language: {language}

            Task:
            1. Suggest at least 30 specific symptoms that might be related to the initial symptoms or are important to rule out.
            2. Include a mix of common and less common symptoms.
            3. Return them in a single group named "Related Symptoms".

            Return a valid JSON object:
            {{
                "groups": [
                    {{
                        "name": "Related Symptoms",
                        "symptoms": [
                            "Symptom 1",
                            "Symptom 2",
                            ...
                            "Symptom 30"
                        ]
                    }}
                ]
            }}
            """
            prompt = PromptTemplate(input_variables=["symptoms", "language"], template=prompt_template)
            chain = prompt | self.llm
            response = await chain.ainvoke({"symptoms": str(symptoms), "language": language})
            return self._clean_response(response.content)
        except Exception as e:
            print(f"AI Error (suggest_refinements): {e}")
            # Mock Fallback with Keyword Matching
            symptoms_str = str(symptoms).lower()
            all_symptoms = []

            # Define pools
            neuro = [
                "Sensitivity to light (Photophobia)", "Sensitivity to sound (Phonophobia)", "Blurred vision", "Double vision", 
                "Dizziness or Vertigo", "Nausea", "Neck stiffness", "Confusion or Brain fog", "Memory loss", 
                "Slurred speech", "Tremors or shaking", "Fainting or lightheadedness", "Balance problems", "Numbness on one side",
                "Headache (throbbing)", "Headache (pressure)"
            ]
            resp = [
                "Shortness of breath", "Wheezing", "Chest pain or tightness", "Runny or stuffy nose", "Sore throat", 
                "Loss of smell or taste", "Ear pain or fullness", "Hoarseness", "Coughing up phlegm", "Coughing up blood", 
                "Rapid breathing", "Snoring or sleep apnea", "Post-nasal drip", "Sinus pressure", "Swollen lymph nodes"
            ]
            cardio = [
                "Chest pressure or squeezing", "Palpitations (fast/irregular heartbeat)", "Swelling in legs or ankles (Edema)", 
                "Cold hands or feet", "Blue lips or fingers", "Fatigue with exertion", "Dizziness upon standing", 
                "Pain radiating to arm or jaw", "Shortness of breath lying down"
            ]
            digestive = [
                "Abdominal pain or cramping", "Bloating", "Constipation", "Diarrhea", "Vomiting", "Nausea", 
                "Loss of appetite", "Heartburn or Acid Reflux", "Difficulty swallowing", "Belching or excessive gas", 
                "Blood in stool", "Black or tarry stools", "Yellowing of skin or eyes (Jaundice)", "Dark urine"
            ]
            musculo = [
                "Joint pain or stiffness", "Muscle weakness", "Muscle cramps or spasms", "Swelling in joints", 
                "Limited range of motion", "Back pain (upper or lower)", "Neck pain", "Numbness or tingling in limbs", 
                "Shooting pain (Sciatica)", "Bone pain", "Redness or warmth over a joint"
            ]
            skin = [
                "Rash or redness", "Itching (Pruritus)", "Hives or welts", "Bruising easily", "Dry or peeling skin", 
                "Changes in mole appearance", "Yellowing of skin", "Pale skin", "Excessive sweating", "Hair loss"
            ]
            general = [
                "Fever (>100.4°F)", "Chills or shivering", "Fatigue or exhaustion", "Night sweats", "Unexplained weight loss", 
                "Unexplained weight gain", "Insomnia or sleep issues", "Anxiety or nervousness", "Depressed mood", 
                "Irritability", "Difficulty concentrating", "General malaise (feeling unwell)", "Thirst"
            ]

            # Add relevant pools first
            if any(x in symptoms_str for x in ["head", "dizzy", "vision", "migraine", "confusion", "faint"]):
                all_symptoms.extend(neuro)
            if any(x in symptoms_str for x in ["cough", "breath", "throat", "nose", "cold", "flu", "fever", "chest"]):
                all_symptoms.extend(resp)
            if any(x in symptoms_str for x in ["chest", "heart", "beat", "pulse", "breath", "swelling"]):
                all_symptoms.extend(cardio)
            if any(x in symptoms_str for x in ["stomach", "pain", "vomit", "nausea", "diarrhea", "belly", "food", "gas"]):
                all_symptoms.extend(digestive)
            if any(x in symptoms_str for x in ["pain", "ache", "muscle", "joint", "back", "leg", "arm", "weak"]):
                all_symptoms.extend(musculo)
            if any(x in symptoms_str for x in ["skin", "rash", "itch", "bump", "red", "spot"]):
                all_symptoms.extend(skin)

            # Always add general
            all_symptoms.extend(general)

            # Remove duplicates
            all_symptoms = list(set(all_symptoms))

            # If less than 30, add random ones from other pools until we reach 30
            remaining_pools = neuro + resp + cardio + digestive + musculo + skin
            remaining_pools = list(set(remaining_pools) - set(all_symptoms))
            
            if len(all_symptoms) < 30:
                needed = 30 - len(all_symptoms)
                if len(remaining_pools) >= needed:
                    all_symptoms.extend(random.sample(remaining_pools, needed))
                else:
                    all_symptoms.extend(remaining_pools)

            # Shuffle for better UX
            random.shuffle(all_symptoms)

            return {
                "groups": [
                    {
                        "name": "Related Symptoms",
                        "symptoms": all_symptoms
                    }
                ]
            }

    async def predict_conditions(self, symptoms: List[dict], refinements: List[dict], confirmations: List[dict] = None, lab_results: List[dict] = None, profile_summary: str = None, language: str = "English") -> dict:
        try:
            prompt_template = """
            You are an expert medical diagnostician. Analyze the patient data to predict conditions.
            
            Initial Symptoms: {symptoms}
            Refinement Answers: {refinements}
            Confirmation Answers: {confirmations}
            Lab Results: {lab_results}
            Profile: {profile_summary}
            Language: {language}

            Task:
            1. Predict top 3-5 potential conditions based on the evidence.
            2. Explain your rationale in {language}, citing specific symptoms AND lab results (e.g. "High WBC indicates infection") if available.
            3. For each condition, list "matchingSymptoms" (what the user has) and "nonMatchingSymptoms" (key symptoms of the condition that the user has NOT reported yet).
            4. If 'Confirmation Answers' are provided, use them to rule in/out conditions.
            5. Assess overall urgency (High/Medium/Low).

            Return JSON:
            {{
                "conditions": [
                    {{
                        "name": "Condition Name (English)",
                        "probability": "High/Medium/Low",
                        "rationale": "Explanation in {language}...",
                        "matchingSymptoms": ["symptom 1", "symptom 2"],
                        "nonMatchingSymptoms": ["symptom 3", "symptom 4"]
                    }}
                ],
                "redFlags": ["Urgent signs in {language}"],
                "urgencyLevel": "High/Medium/Low",
                "disclaimer": "Disclaimer in {language}..."
            }}
            """
            prompt = PromptTemplate(input_variables=["symptoms", "refinements", "confirmations", "lab_results", "profile_summary", "language"], template=prompt_template)
            chain = prompt | self.llm
            profile_str = profile_summary if profile_summary else "No profile available."
            confirmations_str = str(confirmations) if confirmations else "None"
            
            response = await chain.ainvoke({
                "symptoms": str(symptoms), 
                "refinements": str(refinements), 
                "confirmations": str(confirmations), 
                "lab_results": str(lab_results),
                "profile_summary": profile_str, 
                "language": language
            })
            
            result = self._clean_response(response.content)
            
            # Merge rule-based red flags
            try:
                if isinstance(result, str):
                    result_dict = json.loads(result)
                else:
                    result_dict = result
                    
                symptoms_text = str(symptoms) + " " + str(refinements) + " " + str(confirmations)
                rule_flags = self.detect_red_flags(symptoms_text)
                if rule_flags:
                    if "redFlags" not in result_dict:
                        result_dict["redFlags"] = []
                    result_dict["redFlags"].extend(rule_flags)
                    result_dict["redFlags"] = list(set(result_dict["redFlags"]))
                    result_dict["urgencyLevel"] = "High"
                
                return json.dumps(result_dict)
            except:
                return result
        except Exception as e:
            print(f"AI Error (predict_conditions): {e}")
            # Mock Fallback with Smart Logic
            active_symptoms = []
            
            # 1. Add initial symptoms
            if isinstance(symptoms, list):
                for s in symptoms:
                    if isinstance(s, dict) and "name" in s:
                        active_symptoms.append(s["name"].lower())
                    elif isinstance(s, str):
                        active_symptoms.append(s.lower())
            
            # 2. Add accepted refinements/confirmations
            for item_list in [refinements, confirmations]:
                if isinstance(item_list, list):
                    for item in item_list:
                        if isinstance(item, dict):
                            # Check status (Yes/No/Unsure)
                            status = item.get("status", "").lower()
                            if status == "yes" or status == "true":
                                name = item.get("symptom") or item.get("name")
                                if name:
                                    active_symptoms.append(name.lower())
            
            input_text = " ".join(active_symptoms)
            if lab_results:
                input_text += " " + str(lab_results).lower()
            conditions = []
            
            # Respiratory
            if any(x in input_text for x in ["cough", "breath", "throat", "nose", "cold", "flu", "fever", "congestion", "sneeze"]):
                conditions.append({
                    "name": "Viral Upper Respiratory Infection",
                    "probability": "85%",
                    "rationale": "Symptoms like cough, sore throat, and congestion are consistent with a common cold.",
                    "matchingSymptoms": [s for s in ["Cough", "Sore throat", "Runny nose", "Congestion", "Fever", "Sneezing"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["High fever (>102°F)", "Severe chest pain"]
                })
                conditions.append({
                    "name": "Acute Bronchitis",
                    "probability": "65%",
                    "rationale": "Persistent cough and chest discomfort suggest inflammation of the airways.",
                    "matchingSymptoms": [s for s in ["Cough", "Chest discomfort", "Fatigue", "Shortness of breath"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["Wheezing", "High Fever"]
                })

            # Neurological / Headache
            if any(x in input_text for x in ["headache", "migraine", "light", "sound", "nausea", "dizzy", "vertigo"]):
                conditions.append({
                    "name": "Migraine",
                    "probability": "90%",
                    "rationale": "Throbbing headache with sensitivity to light/sound is characteristic of migraine.",
                    "matchingSymptoms": [s for s in ["Headache", "Sensitivity to light", "Nausea", "Sensitivity to sound", "Dizziness"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["Aura", "Vomiting"]
                })
                conditions.append({
                    "name": "Tension Headache",
                    "probability": "75%",
                    "rationale": "Band-like pressure around the head is typical of tension headaches.",
                    "matchingSymptoms": [s for s in ["Headache", "Neck pain", "Stress", "Pressure"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["Nausea", "Sensitivity to light"]
                })

            # Digestive
            if any(x in input_text for x in ["stomach", "abdominal", "vomit", "nausea", "diarrhea", "bloat", "gas", "heartburn", "acid"]):
                conditions.append({
                    "name": "Viral Gastroenteritis",
                    "probability": "80%",
                    "rationale": "Nausea, vomiting, and diarrhea strongly suggest a stomach virus.",
                    "matchingSymptoms": [s for s in ["Nausea", "Vomiting", "Diarrhea", "Stomach pain", "Abdominal pain"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["High fever", "Blood in stool"]
                })
                conditions.append({
                    "name": "Gastritis/GERD",
                    "probability": "60%",
                    "rationale": "Stomach pain and bloating can indicate inflammation or acid reflux.",
                    "matchingSymptoms": [s for s in ["Stomach pain", "Nausea", "Bloating", "Heartburn", "Indigestion"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["Vomiting blood", "Black stools"]
                })

            # Musculoskeletal
            if any(x in input_text for x in ["back pain", "joint pain", "muscle pain", "knee", "shoulder", "stiff", "ache"]):
                conditions.append({
                    "name": "Muscle Strain",
                    "probability": "85%",
                    "rationale": "Localized pain and stiffness often result from muscle overuse or injury.",
                    "matchingSymptoms": [s for s in ["Back pain", "Muscle pain", "Stiffness", "Ache"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["Numbness", "Loss of bladder control"]
                })
                conditions.append({
                    "name": "Arthritis",
                    "probability": "60%",
                    "rationale": "Joint pain and stiffness may indicate arthritis.",
                    "matchingSymptoms": [s for s in ["Joint pain", "Stiffness", "Swelling"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["Fever", "Rash"]
                })

            # Skin
            if any(x in input_text for x in ["rash", "itch", "redness", "skin", "bump", "hives"]):
                conditions.append({
                    "name": "Contact Dermatitis",
                    "probability": "80%",
                    "rationale": "Itchy rash often results from contact with an irritant or allergen.",
                    "matchingSymptoms": [s for s in ["Rash", "Itching", "Redness", "Bumps"] if s.lower() in input_text],
                    "nonMatchingSymptoms": ["Fever", "Pus"]
                })

            # Endocrine / Hormonal (Low T, Thyroid)
            if any(x in input_text for x in ["libido", "sex", "erectile", "hair", "hormone", "testosterone", "energy", "fatigue", "mood"]):
                # Check for specific Low T indicators
                if any(x in input_text for x in ["libido", "sex", "erectile", "hair", "testosterone"]):
                    conditions.append({
                        "name": "Low Testosterone (Hypogonadism)",
                        "probability": "85%",
                        "rationale": "Symptoms such as low libido, fatigue, and hair loss are consistent with low testosterone levels.",
                        "matchingSymptoms": [s for s in ["Low libido", "Fatigue", "Hair loss", "Erectile dysfunction", "Low energy"] if s.lower() in input_text],
                        "nonMatchingSymptoms": ["Breast enlargement", "Hot flashes"]
                    })
                
                # Check for Thyroid indicators
                if any(x in input_text for x in ["weight", "cold", "hair", "fatigue", "skin"]):
                    conditions.append({
                        "name": "Hypothyroidism",
                        "probability": "75%",
                        "rationale": "Fatigue, weight gain, and sensitivity to cold suggest an underactive thyroid.",
                        "matchingSymptoms": [s for s in ["Fatigue", "Weight gain", "Sensitivity to cold", "Dry skin"] if s.lower() in input_text],
                        "nonMatchingSymptoms": ["Tremors", "Anxiety"]
                    })

            # Default if no specific match
            if not conditions:
                # Dynamic System Analysis
                system_map = {
                    "head": "Neurological", "migraine": "Neurological", "dizzy": "Neurological",
                    "stomach": "Gastrointestinal", "belly": "Gastrointestinal", "nausea": "Gastrointestinal", "vomit": "Gastrointestinal",
                    "cough": "Respiratory", "breath": "Respiratory", "throat": "Respiratory", "nose": "Respiratory",
                    "chest": "Cardiovascular/Respiratory", "heart": "Cardiovascular",
                    "skin": "Dermatological", "rash": "Dermatological", "itch": "Dermatological",
                    "joint": "Musculoskeletal", "muscle": "Musculoskeletal", "back": "Musculoskeletal", "pain": "General/Musculoskeletal"
                }
                
                detected_systems = {}
                for s in active_symptoms:
                    for key, system in system_map.items():
                        if key in s:
                            detected_systems[system] = detected_systems.get(system, 0) + 1
                
                if detected_systems:
                    top_system = max(detected_systems, key=detected_systems.get)
                    conditions.append({
                        "name": f"Potential {top_system} Concern",
                        "probability": "Medium",
                        "rationale": f"Based on your symptoms ({', '.join(active_symptoms[:3])}), the issue appears to be related to the {top_system} system.",
                        "matchingSymptoms": active_symptoms,
                        "nonMatchingSymptoms": []
                    })
                else:
                    conditions.append({
                        "name": "Unspecified Symptom Complex",
                        "probability": "Low",
                        "rationale": "The reported symptoms are non-specific. A physical examination is recommended.",
                        "matchingSymptoms": active_symptoms,
                        "nonMatchingSymptoms": []
                    })

            return {
                "conditions": conditions[:3], # Return top 3
                "redFlags": [f for f in ["Chest pain", "Difficulty breathing", "Severe abdominal pain"] if f.lower() in input_text],
                "urgencyLevel": "Medium" if "pain" in input_text else "Low",
                "disclaimer": "This is an AI-generated prediction based on your inputs. It is NOT a medical diagnosis. Please consult a healthcare professional."
            }

    async def recommend_tests(self, diagnosis: dict, profile_summary: str = None, language: str = "English") -> dict:
        try:
            prompt_template = """
            Suggest lab tests based on diagnosis.
            
            Diagnosis: {diagnosis}
            Profile: {profile_summary}
            Language: {language}
    
            Task:
            1. Suggest tests.
            2. Provide purpose and prep instructions in {language}.
    
            Return JSON:
            {{
                "tests": [
                    {{
                        "name": "Test Name",
                        "purpose": "Purpose in {language}",
                        "whatItMeasures": "Explanation in {language}",
                        "prepInstructions": "Instructions in {language}",
                        "urgency": "High/Routine"
                    }}
                ],
                "disclaimer": "Disclaimer in {language}"
            }}
            """
            prompt = PromptTemplate(input_variables=["diagnosis", "profile_summary", "language"], template=prompt_template)
            chain = prompt | self.llm
            profile_str = profile_summary if profile_summary else "No profile available."
            response = await chain.ainvoke({"diagnosis": str(diagnosis), "profile_summary": profile_str, "language": language})
            return self._clean_response(response.content)
        except Exception as e:
            print(f"AI Error (recommend_tests): {e}")
            # Mock Fallback
            tests = []
            diag_str = str(diagnosis).lower()
            
            if "respiratory" in diag_str or "flu" in diag_str or "cold" in diag_str:
                tests.append({"name": "CBC (Complete Blood Count)", "purpose": "Check for infection", "whatItMeasures": "White blood cells", "prepInstructions": "None", "urgency": "Routine"})
                tests.append({"name": "Chest X-Ray", "purpose": "Check lungs", "whatItMeasures": "Lung condition", "prepInstructions": "Remove metal objects", "urgency": "Routine"})
            
            if "digestive" in diag_str or "stomach" in diag_str or "gastritis" in diag_str:
                tests.append({"name": "Stool Culture", "purpose": "Check for bacteria", "whatItMeasures": "Pathogens", "prepInstructions": "Collect sample", "urgency": "Routine"})
                tests.append({"name": "H. Pylori Test", "purpose": "Check for ulcer bacteria", "whatItMeasures": "H. Pylori presence", "prepInstructions": "Fasting may be required", "urgency": "Routine"})
            
            if "testosterone" in diag_str or "hormone" in diag_str or "thyroid" in diag_str:
                tests.append({"name": "Total Testosterone", "purpose": "Measure hormone levels", "whatItMeasures": "Testosterone", "prepInstructions": "Morning sample recommended", "urgency": "Routine"})
                tests.append({"name": "Thyroid Panel (TSH, T3, T4)", "purpose": "Check thyroid function", "whatItMeasures": "Thyroid hormones", "prepInstructions": "None", "urgency": "Routine"})
            
            if not tests:
                tests.append({"name": "CBC (Complete Blood Count)", "purpose": "General health check", "whatItMeasures": "Blood cells", "prepInstructions": "None", "urgency": "Routine"})
                tests.append({"name": "Basic Metabolic Panel", "purpose": "Check electrolytes and glucose", "whatItMeasures": "Metabolism", "prepInstructions": "Fasting required", "urgency": "Routine"})
            
            return {
                "tests": tests,
                "disclaimer": "These are automatically generated recommendations. Please consult a doctor."
            }

    async def extract_lab_values(self, input_data: Union[str, bytes], mime_type: str = "text/plain") -> str:
        # Gemini 2.0 Flash supports PDF and Images via inline data
        if mime_type.startswith("image/") or mime_type == "application/pdf":
            # Image or PDF input
            if isinstance(input_data, bytes):
                base64_data = base64.b64encode(input_data).decode("utf-8")
            else:
                base64_data = input_data # Assume already base64 string if not bytes
                
            message = HumanMessage(
                content=[
                    {"type": "text", "text": "Analyze this entire medical report (Image/PDF), including all pages. Extract ALL lab test values found in the document. Return structured JSON with an 'entries' list. Each entry MUST have these exact keys: 'name', 'value' (number), 'unit', 'range' (string). Ensure no data is missed from any page."},
                    {
                        "type": "image_url", 
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_data}"
                        }
                    }
                ]
            )
            try:
                response = await self.llm.ainvoke([message])
                return self._clean_response(response.content)
            except Exception as e:
                if "RESOURCE_EXHAUSTED" in str(e):
                    # Fallback for demo purposes
                    return json.dumps({
                        "entries": [
                            {"name": "Hemoglobin", "value": 13.2, "unit": "g/dL", "range": "12.0-15.5"},
                            {"name": "WBC", "value": 6.5, "unit": "K/uL", "range": "4.5-11.0"},
                            {"name": "Platelets", "value": 250, "unit": "K/uL", "range": "150-450"},
                            {"name": "Glucose", "value": 95, "unit": "mg/dL", "range": "70-99"}
                        ],
                        "warning": "Demo data loaded (AI Rate Limit)"
                    })
                raise e
        else:
            # Text input
            text = input_data
            prompt_template = """
            Extract lab test values from the following text (OCR output).
            
            Text: {text}
            
            Task:
            1. Identify test names, values, units, and reference ranges.
            2. Return structured JSON.
            
            Return JSON:
            {{
                "entries": [
                    {{
                        "name": "Test Name",
                        "value": "Value (as string or number)",
                        "unit": "Unit",
                        "range": "Reference Range"
                    }}
                ]
            }}
            """
            prompt = PromptTemplate(input_variables=["text"], template=prompt_template)
            chain = prompt | self.llm
            response = await chain.ainvoke({"text": text})
            return self._clean_response(response.content)

    async def interpret_labs(self, lab_results: List[dict], profile_summary: str = None, language: str = "English") -> dict:
        # Pre-process labs with stored reference ranges
        gender = "male" # Default
        if profile_summary:
            if "female" in profile_summary.lower():
                gender = "female"
        
        processed_labs = []
        for lab in lab_results:
            # lab keys: name, value, unit, etc.
            name = lab.get("name", "")
            value = lab.get("value")
            
            # Try to cast value to float if it's a number-like string or number
            try:
                if value is not None:
                    # Remove non-numeric chars if string
                    if isinstance(value, str):
                        import re
                        # Extract first number found
                        match = re.search(r"[-+]?\d*\.\d+|\d+", value)
                        if match:
                            val_float = float(match.group())
                        else:
                            val_float = None
                    else:
                        val_float = float(value)
                        
                    if val_float is not None:
                        ref = get_reference_range(name, gender)
                        if ref:
                            lab["reference_range_stored"] = f"{ref['min']} - {ref['max']} {ref['unit']}"
                            if val_float < ref["min"]:
                                lab["flag_calculated"] = "Low"
                            elif val_float > ref["max"]:
                                lab["flag_calculated"] = "High"
                            else:
                                lab["flag_calculated"] = "Normal"
            except Exception as e:
                print(f"Error processing lab value {value}: {e}")
                pass
            processed_labs.append(lab)

        prompt_template = """
        Interpret lab results.
        
        Labs (with pre-calculated flags if available): {lab_results}
        Profile: {profile_summary}
        Language: {language}

        Task:
        1. Flag abnormal results. Use 'flag_calculated' if present as a strong signal. If not present, use the 'range' in the lab entry or general medical knowledge.
        2. Explain meaning in {language}.
        3. Suggest questions in {language}.
        4. Identify risk signals.
        5. Provide a summary.

        Return JSON:
        {{
            "abnormal": [
                {{
                    "test": "Test Name",
                    "value": float,
                    "flag": "High/Low/Critical",
                    "meaning": "Explanation in {language}",
                    "questionsToAskDoctor": ["Question in {language}"]
                }}
            ],
            "summary": "Summary in {language}",
            "riskSignals": ["Risks in {language}"]
        }}
        """
        prompt = PromptTemplate(input_variables=["lab_results", "profile_summary", "language"], template=prompt_template)
        chain = prompt | self.llm
        profile_str = profile_summary if profile_summary else "No profile available."
        try:
            response = await chain.ainvoke({"lab_results": str(processed_labs), "profile_summary": profile_str, "language": language})
            return self._clean_response(response.content)
        except Exception as e:
            print(f"AI Error (interpret_labs): {e}")
            # Fallback using calculated flags
            abnormal = []
            for lab in processed_labs:
                flag = lab.get("flag_calculated", "Normal")
                if flag != "Normal":
                    abnormal.append({
                        "test": lab.get("name"),
                        "value": lab.get("value"),
                        "flag": flag,
                        "meaning": f"Value is {flag} (Reference: {lab.get('reference_range_stored', 'Unknown')})",
                        "questionsToAskDoctor": ["Is this concerning?", "What could cause this?"]
                    })
            
            return json.dumps({
                "abnormal": abnormal,
                "summary": "AI interpretation unavailable. Showing automated analysis based on reference ranges.",
                "riskSignals": ["Please review abnormal values with a healthcare provider."]
            })

    async def generate_health_plan(self, diagnosis: dict = None, symptoms: str = None, labs: List[dict] = None, profile_summary: str = None, daily_logs: List[dict] = None, language: str = "English") -> dict:
        try:
            prompt_template = """
            Create a health plan.
            
            Diagnosis: {diagnosis}
            Symptoms: {symptoms}
            Labs: {labs}
            Profile: {profile_summary}
            Recent Daily Logs (Steps, HR, Sleep): {daily_logs}
            Language: {language}
    
            Task:
            1. Create a plan with Diet, Lifestyle, Hydration, Tracking, Warnings.
            2. Medication Education (OTC ONLY, NO PRESCRIPTIONS, NO ANTIBIOTICS, NO STEROIDS):
               - Suggest 1-2 common OTC medicines SPECIFICALLY for the reported symptoms (e.g., Paracetamol for fever, Antihistamine for allergy).
               - Provide EDUCATIONAL details only.
               - STRICTLY FOLLOW the JSON structure below for medicines.
            3. Analyze Daily Logs if available.
            4. All content must be in {language}.
    
            Return JSON:
            {{
                "diet": ["Tip 1"],
                "lifestyle": ["Tip 1"],
                "hydration": "Goal",
                "daily_tracking": ["Metric 1"],
                "med_education": [
                    {{
                        "generic_name": "Generic Name",
                        "brand_names": {{"US": ["Brand"], "India": ["Brand"]}},
                        "category": "Category",
                        "commonly_used_for": ["Symptom 1"],
                        "general_usage": "General usage pattern (NOT dosage)",
                        "how_to_take": "Instructions",
                        "duration": "Duration",
                        "avoid_if": ["Condition"],
                        "side_effects": ["Side Effect"],
                        "warnings": ["Warning"],
                        "age_note": "Age note",
                        "pregnancy_warning": true,
                        "emergency_signs": ["Sign"],
                        "disclaimer": true
                    }}
                ],
                "warnings": ["Warning"]
            }}
            """
            prompt = PromptTemplate(input_variables=["diagnosis", "symptoms", "labs", "profile_summary", "daily_logs", "language"], template=prompt_template)
            chain = prompt | self.llm
            profile_str = profile_summary if profile_summary else "No profile available."
            diagnosis_str = str(diagnosis) if diagnosis else "None"
            symptoms_str = symptoms if symptoms else "None"
            labs_str = str(labs) if labs else "None"
            logs_str = str(daily_logs) if daily_logs else "None"
            
            response = await chain.ainvoke({
                "diagnosis": diagnosis_str,
                "symptoms": symptoms_str,
                "labs": labs_str,
                "profile_summary": profile_str,
                "daily_logs": logs_str,
                "language": language
            })
            return self._clean_response(response.content)
        except Exception as e:
            print(f"AI Error (generate_health_plan): {e}")
            # Mock Fallback
            return {
                "diet": ["Eat a balanced diet rich in vegetables.", "Limit processed foods and sugar.", "Consider anti-inflammatory foods."],
                "lifestyle": ["Aim for 7-8 hours of sleep.", "Manage stress with meditation or deep breathing.", "Walk for 30 minutes daily."],
                "hydration": "Drink at least 8 glasses (2 liters) of water daily.",
                "daily_tracking": ["Track your symptoms daily.", "Monitor your energy levels.", "Log your meals."],
                "med_education": [
                    {
                        "generic_name": "Paracetamol (Acetaminophen)",
                        "brand_names": {"US": ["Tylenol"], "India": ["Dolo", "Crocin"], "Global": ["Panadol"]},
                        "category": "Analgesic / Antipyretic",
                        "commonly_used_for": ["Fever", "Mild pain", "Headache"],
                        "general_usage": "Often taken every 4-6 hours as needed. Do not exceed daily limits.",
                        "how_to_take": "Take with or without food. Drink water.",
                        "duration": "Short-term use (1-3 days) for symptom relief.",
                        "avoid_if": ["Severe liver disease", "Allergy to paracetamol"],
                        "side_effects": ["Nausea (rare)", "Rash (rare)"],
                        "warnings": ["Do not take with other products containing paracetamol.", "Avoid alcohol."],
                        "age_note": "Adult usage described. Consult doctor for children.",
                        "pregnancy_warning": True,
                        "emergency_signs": ["Severe allergic reaction", "Yellowing of skin/eyes"],
                        "disclaimer": True
                    }
                ],
                "warnings": ["If symptoms worsen, seek medical attention immediately."]
            }

    def detect_red_flags(self, symptoms_text: str) -> List[str]:
        """
        Fast rule-based detection of emergency keywords.
        """
        red_flags = []
        keywords = {
            "chest pain": "Potential Heart Attack",
            "shortness of breath": "Respiratory Distress",
            "difficulty breathing": "Respiratory Distress",
            "unconscious": "Loss of Consciousness",
            "fainted": "Loss of Consciousness",
            "severe bleeding": "Hemorrhage",
            "vomiting blood": "Internal Bleeding",
            "slurred speech": "Potential Stroke",
            "sudden severe headache": "Potential Stroke/Aneurysm",
            "suicidal": "Psychiatric Emergency"
        }
        
        text_lower = symptoms_text.lower()
        for key, warning in keywords.items():
            if key in text_lower:
                red_flags.append(warning)
                
        return list(set(red_flags))

    async def analyze_image(self, image_data: str, prompt_text: str = "Analyze this medical report or image.") -> str:
        # For Gemini 1.5 Flash with images, we typically use the multimodal capabilities.
        # This is a simplified implementation assuming image_data is passed correctly to a multimodal chain
        # or using the generate_content method directly if using google-genai SDK directly.
        # Since we are using LangChain, we construct a message with image.
        from langchain_core.messages import HumanMessage
        
        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
            ]
        )
        
        response = await self.llm.ainvoke([message])
        return response.content

    async def translate_text(self, text: str, target_language: str) -> str:
        prompt = PromptTemplate(
            input_variables=["text", "target_language"],
            template="Translate the following medical text to {target_language}. Maintain medical accuracy.\n\nText: {text}"
        )
        chain = prompt | self.llm
        response = await chain.ainvoke({"text": text, "target_language": target_language})
        return response.content
        
    async def generate_insights(self, health_data: str) -> str:
        prompt = PromptTemplate(
            input_variables=["health_data"],
            template="Analyze the following patient health data and provide a weekly summary with trends and insights.\n\nData: {health_data}"
        )
        chain = prompt | self.llm
        response = await chain.ainvoke({"health_data": health_data})
        return response.content

    async def chat_with_doctor(self, message: str, history: List[dict], profile_summary: str = None, language: str = "English") -> str:
        prompt_template = """
        You are Doctor.ai, a compassionate and knowledgeable medical AI assistant.
        You are conversing with a patient via voice (speech-to-text).
        
        Patient Profile: {profile_summary}
        Language: {language}
        
        Conversation History:
        {history}
        
        User's New Message: {message}
        
        Task:
        1. Respond to the user's message in a helpful, empathetic, and medically accurate way.
        2. Keep your response concise (suitable for voice output). Avoid long lists or complex formatting.
        3. If the user mentions symptoms, ask clarifying questions or suggest potential causes, but ALWAYS include a disclaimer that you are not a doctor.
        4. If the user asks for medical advice, provide general information and advise seeing a professional.
        5. Speak in {language}.
        
        Response:
        """
        prompt = PromptTemplate(input_variables=["message", "history", "profile_summary", "language"], template=prompt_template)
        chain = prompt | self.llm
        
        # Format history
        history_str = ""
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_str += f"{role.capitalize()}: {content}\n"
            
        profile_str = profile_summary if profile_summary else "No profile available."
        
        response = await chain.ainvoke({
            "message": message,
            "history": history_str,
            "profile_summary": profile_str,
            "language": language
        })
        
        return response.content

    def _clean_response(self, content: str) -> str:
        # Use regex to find the JSON block
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            return match.group(0)
        
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        return content

agent = DoctorAgent()
