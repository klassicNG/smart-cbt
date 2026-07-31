import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dns from 'node:dns';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

dns.setDefaultResultOrder('ipv4first');

const customGoogle = createGoogleGenerativeAI({
    headers: { 'Connection': 'close' }
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { concept } = body;

        if (!concept) {
            return new Response(JSON.stringify({ error: "No concept provided." }), { status: 400 });
        }

        const promptText = `You are a dynamic, unconventional computer science tutor. The student is struggling to understand the concept of: "${concept}".
        
Explain this concept by reframing it as a high-stakes, real-world mental model. You MUST use one of the following themes for your analogy:
1. A tactical football strategy (e.g., breaking a high press, role of a central midfielder).
2. A complex chess endgame or midgame tactic.
3. A tense, tactical psychological thriller or heist scenario.

Break it down so it makes perfect sense intuitively.

Return ONLY raw JSON in this exact format:
{
  "title": "Concept: Football/Chess/Thriller Analogy",
  "analogy": "The detailed, engaging explanation connecting the theory to the scenario."
}

Do not include markdown formatting (\`\`\`json) or conversational text.`;

        let parsedJson;

        try {
            const result = await generateText({
                model: customGoogle('models/gemma-4-26b-a4b-it'),
                maxTokens: 1000, // Kept very low for lightning-fast responses
                prompt: promptText,
            });

            let rawResponse = result.text;
            rawResponse = rawResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                rawResponse = jsonMatch[0];
            }
            parsedJson = JSON.parse(rawResponse);

        } catch (apiError) {
            console.warn("Hackathon API overloaded. Deploying Analogy Fallback.");
            
            // THE LIFESAVER: Demo-safe dynamic fallback
            parsedJson = {
                "title": `${concept} as a Tactical Chess Match`,
                "analogy": `Think of ${concept} like a complex chess endgame. You don't just move pieces randomly; every operation (like moving a knight) is dictated by your overarching goal (checkmate). You have specific methods established (like a ladder mate), and your selection rules dictate which method you deploy based on how the opponent's defense reacts. It's about predicting the sequence of moves before they happen.`
            };
        }

        return new Response(JSON.stringify(parsedJson), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to generate analogy" }), { status: 500 });
    }
}