Markdown
# SmartCBT: E-Exam Simulator 🎓

SmartCBT is an AI-powered study companion that helps university students prepare for computer-based tests (CBT). By leveraging Google's Gemma 4 model, it transforms static PDF course materials and notes into dynamic, timed mock exams.

## 🚀 Features

*   **Dynamic Exam Generation:** Upload any course PDF or paste text, and the Gemma engine will instantly extract core concepts and generate rigorous multiple-choice questions.
*   **Timed CBT Interface:** Simulates the pressure of a real exam hall with a built-in countdown timer and a clean, distraction-free testing UI.
*   **Instant Evaluation:** Get immediate feedback on your performance, complete with a breakdown of correct and incorrect answers to target your weak spots.
*   **High Reliability:** Features a built-in fallback question bank to ensure the app remains fully functional and unblocked even during API timeouts or connection drops.

## 🛠️ Tech Stack

*   **Framework:** Next.js (App Router)
*   **Styling:** Tailwind CSS & Lucide Icons
*   **AI SDK:** `@ai-sdk/google` (Gemma-4-26b-a4b-it)
*   **PDF Parsing:** `unpdf`
*   **Deployment:** Vercel

## 🚦 Running Locally

1. Clone the repository:
   ```bash
   git clone [https://github.com/klassicNG/smart-cbt.git](https://github.com/klassicNG/smart-cbt.git)
Install dependencies:

Bash
npm install

2. Set up your environment variables:
Create a .env.local file in the root directory and add your Google Gemini API key:

Code snippet
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

3. Start the development server:

Bash
npm run dev

4. Open http://localhost:3000 in your browser.
