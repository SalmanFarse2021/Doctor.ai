# Doctor.ai 🩺

**Doctor.ai** is an intelligent diagnostic assistant that leverages advanced AI to analyze user symptoms and lab reports, providing instant disease predictions and personalized, curative health plans.

## 🚀 Key Features

*   **Smart Diagnosis**: Analyzes natural language symptoms and medical history to predict potential conditions with probability scores.
*   **Lab Report Analysis**: Extracts and interprets data from PDF lab reports to enhance diagnostic accuracy.
*   **Curative Health Plans**: Generates actionable recovery roadmaps including tailored nutrition, lifestyle changes, hydration patterns, and OTC medication recommendations.
*   **Secure Dashboard**: A user-friendly interface to manage checkup history, view health trends, and access personalized medical insights.

## 🛠️ Tech Stack

*   **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
*   **Backend**: FastAPI (Python), LangChain
*   **AI Engine**: OpenAI GPT-4o
*   **Database**: MongoDB

## 📦 Getting Started

### Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Set up environment variables (`.env`):
    ```env
    OPENAI_API_KEY=your_key_here
    MONGODB_URL=your_db_url
    ```
4.  Run the server:
    ```bash
    uvicorn main:app --reload
    ```

### Frontend Setup
1.  Navigate to the web directory:
    ```bash
    cd web
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```

---
*Note: This application provides educational health information and is not a substitute for professional medical advice.*
