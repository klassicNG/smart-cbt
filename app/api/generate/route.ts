import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { extractText } from 'unpdf';
import dns from 'node:dns';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

dns.setDefaultResultOrder('ipv4first');

const customGoogle = createGoogleGenerativeAI({
    headers: { 'Connection': 'close' }
});

// --- POLYFILLS ---
if (typeof (Math as any).sumPrecise !== 'function') {
    (Math as any).sumPrecise = function (values: Iterable<number>) {
        let sum = 0;
        for (const v of values) sum += v || 0;
        return sum;
    };
}
if (typeof (Promise as any).withResolvers !== 'function') {
    (Promise as any).withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}
// -----------------

export async function POST(req: Request) {
    try {
        const formData = await req.formData();

        const files = formData.getAll('files') as File[];
        const rawNotes = formData.get('notes') as string | null;

        const batchSize = formData.get('batchSize') || '10';
        const chunkIndex = parseInt(formData.get('chunkIndex') as string || '0');

        let extractedText = rawNotes || '';

        if (files && files.length > 0) {
            const extractionPromises = files.map(async (file) => {
                const buffer = await file.arrayBuffer();
                if (file.type === 'application/pdf') {
                    const uint8Array = new Uint8Array(buffer);
                    const parsedPdf: any = await extractText(uint8Array);
                    const rawData = parsedPdf?.text || parsedPdf || '';
                    return Array.isArray(rawData) ? rawData.join(' ') : String(rawData);
                } else {
                    return Buffer.from(buffer).toString('utf-8');
                }
            });

            const extractedTexts = await Promise.all(extractionPromises);
            extractedText += '\n\n' + extractedTexts.join('\n\n--- NEXT DOCUMENT ---\n\n');
        }

        extractedText = String(extractedText).trim();

        if (!extractedText || extractedText.length < 20) {
            return new Response(
                JSON.stringify({ error: "Please provide sufficient course material or notes." }),
                { status: 400 }
            );
        }

        // --- THE TEXT CAROUSEL ---
        const textLength = extractedText.length;
        const chunkStart = (chunkIndex * 3000) % textLength;
        let textChunk = extractedText.slice(chunkStart, chunkStart + 3000);

        if (textChunk.length < 3000) {
            textChunk += " " + extractedText.slice(0, 3000 - textChunk.length);
        }

        // --- AI GENERATION WITH SAFEGUARDS ---
        const result = await generateText({
            model: customGoogle('models/gemma-4-26b-a4b-it'),
            maxRetries: 0,
            maxTokens: 4000,
            system: `You are an expert university examiner. Read the provided course material and generate exactly ${batchSize} high-yield multiple-choice exam questions. Return ONLY raw JSON in this exact format: {"quiz": [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "...", "explanation": "...", "topic": "..."}]}. The "topic" field must be a short, 1-3 word category summarizing the specific concept tested. Do not include markdown formatting or backticks.`,
            prompt: textChunk,
        });

        let rawResponse = result.text;

        rawResponse = rawResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();

        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            rawResponse = jsonMatch[0];
        }

        let parsedJson;
        try {
            parsedJson = JSON.parse(rawResponse);
        } catch (parseError) {
            console.warn("Gemma output malformed JSON. Triggering frontend self-healing retry.");
            return new Response(JSON.stringify({ error: "AI generated malformed JSON. Retrying..." }), { status: 500 });
        }

        return new Response(JSON.stringify(parsedJson), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        // THIS IS THE SECTION YOU MISSED
    } catch (error) {
        console.error("Gemma API Error:", error);
        return new Response(JSON.stringify({ error: "Failed to process document" }), { status: 500 });
    }
}