import os
import json
import re
import random
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
import base64
from typing import List, Optional, Union
from reference_data import get_reference_range
import io
from openai import AsyncOpenAI

# PDF Handling
try:
    from pypdf import PdfReader
except ImportError:
    pass # Will be handled if missing in requirements

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

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
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.llm = ChatOpenAI(
            model="gpt-5.2",
            api_key=OPENAI_API_KEY,
            temperature=0.3,
            max_retries=1,
            request_timeout=120
        )
        self.client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    def _clean_response(self, text: str) -> str:
        """Removes markdown code blocks if present."""
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

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
            return {"error": str(e)}

    def detect_red_flags(self, text: str) -> List[str]:
        """Simple regex/keyword based red flag detection as a backup layer"""
        flags = []
        text_lower = text.lower()
        if any(x in text_lower for x in ["chest pain", "heart attack", "crushing"]):
            flags.append("Possible Cardiac Event")
        if any(x in text_lower for x in ["stroke", "slurred speech", "numbness one side"]):
            flags.append("Possible Stroke Signs")
        if any(x in text_lower for x in ["suicide", "kill myself", "want to die"]):
            flags.append("Self-Harm Risk")
        if "fever" in text_lower and ("103" in text_lower or "104" in text_lower or "105" in text_lower or "high" in text_lower):
            flags.append("High Fever")
        if any(x in text_lower for x in ["trouble breathing", "can't breathe", "shortness of breath", "gasping"]):
             flags.append("Respiratory Distress")
        return flags

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
            # Mock Fallback using static list (omitted for brevity, assume similar fallback as before if crash)
            return {"groups": [{"name": "Related Symptoms (Fallback)", "symptoms": ["General Malaise", "Fatigue", "Fever"]}]}

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
            6. CRITICAL: For "probability", provide a specific percentage (e.g., "85%") based on how well symptoms match.

            Return JSON:
            {{
                "conditions": [
                    {{
                        "name": "Condition Name (English)",
                        "probability": "Percentage (e.g., '85%')",
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
            return {"error": str(e)}

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
            return {"error": str(e)}

    async def extract_lab_values(self, input_data: Union[str, bytes], mime_type: str = "text/plain") -> str:
        extracted_text = ""
        is_vision = False
        message_content = []

        # 1. Handle PDF (Text Extraction -> Fallback to Image Extraction)
        if mime_type == "application/pdf":
            try:
                if isinstance(input_data, bytes):
                    reader = PdfReader(io.BytesIO(input_data))
                else:
                    return json.dumps({"error": "PDF input must be bytes"})
                
                # Attempt Text Extraction
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"
                
                # Check if text is sufficient (heuristic: < 50 chars implies scanned doc)
                if len(extracted_text.strip()) < 50:
                    print("Low text content detected in PDF. Attempting image extraction for Vision processing...")
                    images = self._extract_images_from_pdf(reader)
                    
                    if images:
                        is_vision = True
                        message_content = [{"type": "text", "text": "Analyze these images from a medical report. Extract ALL lab test values found. Return structured JSON with an 'entries' list. Each entry MUST have these exact keys: 'name', 'value' (number), 'unit', 'range' (string). Ensure no data is missed."}]
                        
                        for img_base64 in images:
                            message_content.append({
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{img_base64}"}
                            })
                    else:
                        return json.dumps({"error": "Could not extract text and no embedded images found in PDF. It might be a flat scanned file that requires server-side OCR tools."})
            
            except Exception as e:
                print(f"PDF Extraction Error: {e}")
                return json.dumps({"error": f"Failed to read PDF file: {str(e)}"})

        # 2. Handle Images (Vision API)
        elif mime_type.startswith("image/"):
            is_vision = True
            if isinstance(input_data, bytes):
                base64_data = base64.b64encode(input_data).decode("utf-8")
            else:
                base64_data = input_data 
            
            message_content = [
                {"type": "text", "text": "Analyze this medical report image. Extract ALL lab test values found. Return structured JSON with an 'entries' list. Each entry MUST have these exact keys: 'name', 'value' (number), 'unit', 'range' (string). Ensure no data is missed."},
                {
                    "type": "image_url", 
                    "image_url": {
                        "url": f"data:{mime_type};base64,{base64_data}"
                    }
                }
            ]

        # 3. Handle Plain Text
        else:
            extracted_text = input_data

        # Construct Message for LLM
        if is_vision:
            try:
                # Limit to first 5 images to avoid token limits/cost if huge PDF
                if len(message_content) > 6: # 1 text + 5 images
                    message_content = message_content[:6]
                    print("Warning: Limiting to first 5 extracted images for Vision analysis.")

                message = HumanMessage(content=message_content)
                response = await self.llm.ainvoke([message])
                return self._clean_response(response.content)
            except Exception as e:
                print(f"Vision API Error: {e}")
                return json.dumps({"error": str(e)})
        else:
            # Text-based processing
            prompt_template = """
            Extract lab test values from the following text (from a medical report).
            
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
            try:
                prompt = PromptTemplate(input_variables=["text"], template=prompt_template)
                chain = prompt | self.llm
                response = await chain.ainvoke({"text": extracted_text})
                return self._clean_response(response.content)
            except Exception as e:
                print(f"Text Analysis Error: {e}")
                return json.dumps({"error": str(e)})

    def _extract_images_from_pdf(self, reader: PdfReader) -> List[str]:
        """Extracts images from PDF pages and returns them as base64 strings."""
        images = []
        try:
            for page in reader.pages:
                if hasattr(page, "images"):
                    for image_file_object in page.images:
                        try:
                            # Convert to base64
                            final_data = image_file_object.data
                            base64_str = base64.b64encode(final_data).decode("utf-8")
                            images.append(base64_str)
                        except Exception as img_err:
                            print(f"Error processing a PDF image: {img_err}")
        except Exception as e:
            print(f"Error extracting images from PDF: {e}")
        return images

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
            return {"error": str(e)}

    async def generate_health_plan(self, diagnosis: dict = None, symptoms: str = None, labs: List[dict] = None, profile_summary: str = None, daily_logs: List[dict] = None, language: str = "English") -> dict:
        try:
            prompt_template = """
            Create a highly personalized health plan STRICTLY based on the identified disease/condition provided in the Diagnosis below.

            Diagnosis: {diagnosis}
            Symptoms: {symptoms}
            Labs: {labs}
            Profile: {profile_summary}
            Recent Daily Logs (Steps, HR, Sleep): {daily_logs}
            Language: {language}

            Task:
            1. Create a plan with Diet, Lifestyle, Hydration, Tracking, Warnings TAILORED to the Diagnosis.
            2. Medication Recommendations (OTC ONLY):
               - Recommend effective OTC medicines to TREAT and CURE the identified disease/symptoms.
               - Provide clear usage instructions for RECOVERY.
               - STRICTLY FOLLOW the JSON structure below for medicines.
            3. Analyze Daily Logs if available.
            4. All content must be in {language}.
            5. CRITICAL: DO NOT PROVIDE GENERIC ADVICE.
                - Diet: List specific foods to EAT and to AVOID to Cure/Treat the diagnosed condition.
                - Lifestyle: Suggest 3-4 specific actionable habits to accelerate RECOVERY from the diagnosis.
                - Hydration: Prescribe exact fluid intake strategies beneficial for the condition (e.g., ORS for dehydration, warm water for cold).
                - Daily Tracking: Monitor specific vital signs/symptoms relevant to the disease to track RECOVERY progress.

            Return JSON:
            {{
                "diet": ["Specific Diet Tip 1", "Specific Diet Tip 2"],
                "lifestyle": ["Specific Lifestyle Tip 1", "Specific Lifestyle Tip 2"],
                "hydration": ["Specific Hydration Tip 1 (e.g. 3L water)"],
                "daily_tracking": ["Specific Metric 1 (e.g. Temp > 101F)", "Specific Metric 2"],
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
                "hydration": ["Drink at least 8 glasses (2 liters) of water daily."],
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
        # Detect if Bengali
        is_bengali = language.lower() in ["bengali", "bangla", "bn"]
        
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
        3. If the user mentions symptoms, ask clarifying questions ONE BY ONE. Do not stack multiple questions. Wait for the user's response before asking the next one.
        4. If the user asks for medical advice, provide general information and advise seeing a professional.
        5. Speak in {language}.
        
        {language_specific_instructions}
        
        CRITICAL: ASK ONLY ONE FOLLOW-UP QUESTION AT A TIME to mimic a real conversation.
        
        Response:
        """
        
        # Prepare disclaimer instruction based on history length
        # Only show disclaimer on the first message (when history is empty)
        should_show_disclaimer = len(history) == 0
        print(f"[AI-AGENT] Disclaimer Debug: History Length={len(history)}, Should Show={should_show_disclaimer}")
        
        # Language-specific instructions
        if is_bengali:
            # Only include the instruction if needed. Otherwise, explicitly forbid it.
            disclaimer_text = 'Always add a brief disclaimer in Bengali at the end: "মনে রাখবেন, এটি শুধুমাত্র তথ্যমূলক। কোনো সমস্যা হলে ডাক্তারের পরামর্শ নিন।"' if should_show_disclaimer else 'DO NOT add any medical disclaimer.'
            
            lang_instructions = f"""
            Bengali Language Guidelines:
            - Use simple, conversational Bengali (বাংলা)
            - For medical terms, use Bengali first, then add English in parentheses. Example: "জ্বর (fever)", "রক্তচাপ (blood pressure)"
            - Keep sentences short and clear for voice
            - Use polite form (আপনি/আপনার)
            {disclaimer_text}
            """
        else:
            # Only include the instruction if needed. Otherwise, explicitly forbid it.
            disclaimer_text = 'Always add a brief disclaimer at the end: "Remember this is for informational purposes only. Please visit a doctor if needed."' if should_show_disclaimer else 'DO NOT add any medical disclaimer.'
            
            lang_instructions = f"""
            English Language Guidelines:
            - Use simple, conversational English
            - Keep sentences short and clear for voice
            - Be empathetic and reassuring
            {disclaimer_text}
            """
        
        prompt = PromptTemplate(
            input_variables=["message", "history", "profile_summary", "language", "language_specific_instructions"], 
            template=prompt_template
        )
        chain = prompt | self.llm
        
        # Format history
        history_str = ""
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            role_label = "ডাক্তার" if role == "assistant" and is_bengali else "Patient" if role == "user" and is_bengali else role.capitalize()
            history_str += f"{role_label}: {content}\n"
            
        profile_str = profile_summary if profile_summary else ("প্রোফাইল পাওয়া যায়নি।" if is_bengali else "No profile available.")
        
        response = await chain.ainvoke({
            "message": message,
            "history": history_str,
            "profile_summary": profile_str,
            "language": "বাংলা (Bengali)" if is_bengali else language,
            "language_specific_instructions": lang_instructions
        })
        
        response_text = response.content
        
        response_text = response.content
        
        # Post-processing: Aggressive Removal
        if not should_show_disclaimer:
            # List of phrases that trigger removal of the whole sentence or block
            trigger_phrases = [
                "informational purposes only",
                "visit a doctor",
                "consult a doctor",
                "consult a healthcare professional",
                "medical advice",
                "তথ্যমূলক",
                "ডাক্তারের পরামর্শ"
            ]
            
            # Simple line-based filtering first (often disclaimer is on its own line)
            lines = response_text.split('\n')
            clean_lines = []
            for line in lines:
                if any(phrase.lower() in line.lower() for phrase in trigger_phrases):
                    continue # Skip this line
                clean_lines.append(line)
            
            response_text = '\n'.join(clean_lines).strip()
            
            # If disclaimer was inline, fallback to regex
            response_text = re.sub(r"(Remember|Note|Please note).*?(informational purposes|visit a doctor|medical advice).*?(\.|$)", "", response_text, flags=re.IGNORECASE | re.DOTALL).strip()
        
        return response_text

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



    async def transcribe_audio(self, audio_file: bytes, filename: str = "audio.webm") -> dict:
        try:
            # OpenAI requires a file-like object with a name
            transcript = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=(filename, audio_file)
            )
            return {"text": transcript.text}
        except Exception as e:
            print(f"STT Error: {e}")
            return {"error": str(e)}

    async def generate_audio(self, text: str, voice: str = "alloy") -> bytes:
        try:
            response = await self.client.audio.speech.create(
                model="gpt-4o-mini-tts", # Fallback to tts-1 if this assumes specific model access
                voice=voice,
                input=text
            )
            # response.read() returns bytes for standard sync, but for async we iterate or read
            # The async client returns a response object that can be streamed.
            # actually response.content is accessible ? 
            # With AsyncOpenAI, response might be a HttpxBinaryResponseContent
            return response.content
        except Exception as e:
            # Fallback to standard tts-1 if gpt-4o-mini-tts fails (it might not exist yet publicly or strictly named tts-1)
            try:
                print(f"TTS Error (primary): {e}. Retrying with tts-1")
                response = await self.client.audio.speech.create(
                    model="tts-1",
                    voice=voice,
                    input=text
                )
                return response.content
            except Exception as e2:
                print(f"TTS Error (fallback): {e2}")
                return None

agent = DoctorAgent()
