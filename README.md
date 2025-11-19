# Formatic - AI-Powered Assessment Platform

**Formatic** is a modern, aesthetic web application designed for creating, sharing, and analyzing forms and quizzes. Built with React, Supabase, and powered by Google's Gemini 3.0 AI, it bridges the gap between document content and interactive assessment.

![Formatic Banner](https://via.placeholder.com/1200x600/0f0c29/6366f1?text=Formatic+AI+Platform)

## 🚀 Key Features

### 🤖 AI-Powered Form Generation
*   **PDF to Quiz**: Upload any PDF document, and the integrated Gemini 3.0 AI analyzes the content to generate structured quizzes automatically.
*   **Smart Fallback**: Uses a robust multi-model fallback system (Gemini 2.5 Flash, Pro, etc.) to ensure high availability.

### 🛡️ Role-Based Access Control
*   **Moderators**: Have full control to create forms, edit questions, set timers, and view detailed analytics.
*   **Viewers**: Can access forms via unique 6-digit codes, take timed assessments, and receive instant feedback.

### 📊 Real-Time Analytics
*   **Visual Data**: Interactive charts showing response distribution.
*   **Scoring**: Automatic grading with "Smart Match" logic (e.g., handling "8" vs "Eight").
*   **Insights**: View pass rates, average scores, and question-level breakdowns.

### ⚡ Advanced Form Tools
*   **Timer Integration**: Enforce time limits on assessments with auto-submission.
*   **Question Types**: Support for Multiple Choice, Short Answer, and Checkboxes.
*   **Undo/Redo**: Full history state management in the Form Builder.
*   **Preview Mode**: Test forms exactly as a viewer would see them before publishing.

### 🔐 Security & Performance
*   **Supabase Auth**: Secure email/password authentication with session management.
*   **Row Level Security (RLS)**: Data access is strictly controlled at the database level.
*   **Session Tracking**: Unique session IDs generated for every login for security auditing.

## 🛠️ Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS (Glassmorphism UI)
*   **Backend / DB**: Supabase (PostgreSQL, Auth, Realtime)
*   **AI**: Google Gemini API (@google/genai)
*   **PDF Processing**: PDF.js

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/formatic.git
    cd formatic
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file based on your Supabase and Google AI credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_API_KEY=your_gemini_api_key
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

## 📜 License

Developed by **Mon Torneado**.
Powered by **Gemini 3.0** & **Supabase**.
