import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Interview system prompt
// ---------------------------------------------------------------------------

const INTERVIEW_SYSTEM_PROMPT = `You are a brand strategist helping a user define their brand profile through friendly conversation. Your goal is to naturally extract these fields:

- Brand name (required)
- Brand voice/tone description
- Market positioning (what makes them different)
- Target demographics (age, gender, location, income)
- Audience interests
- Customer pain points
- Mission statement

Guidelines:
- Ask one focused question at a time
- Be conversational, encouraging, and concise
- After each response, extract any profile fields you can identify
- After 3-5 exchanges, summarize what you've gathered and ask if anything needs correction
- If the user seems done, indicate high completeness

You MUST respond with valid JSON in this exact format (no markdown, no code fences):
{
  "message": "Your conversational response here",
  "extractedFields": {
    "name": null,
    "brandVoice": null,
    "positioning": null,
    "demographics": [],
    "interests": [],
    "painPoints": [],
    "missionStatement": null
  },
  "completeness": 0.0
}

Rules for extractedFields:
- Set string fields to null if not yet mentioned, or the extracted value as a string
- Set array fields to [] if not yet mentioned, or an array of short strings
- Only include information the user has actually shared
- completeness is a number from 0.0 to 1.0 based on how many fields have been filled`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InterviewMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedFields {
  name: string | null;
  brandVoice: string | null;
  positioning: string | null;
  demographics: string[];
  interests: string[];
  painPoints: string[];
  missionStatement: string | null;
}

interface InterviewResponse {
  message: string;
  extractedFields: ExtractedFields;
  completeness: number;
}

// ---------------------------------------------------------------------------
// POST /api/brand-profiles/interview
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { messages?: InterviewMessage[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required and must be non-empty' },
        { status: 400 }
      );
    }

    // Map messages to Anthropic format
    const anthropicMessages = body.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: INTERVIEW_SYSTEM_PROMPT,
      messages: anthropicMessages,
    });

    // Extract text content
    const textBlock = response.content.find((b) => b.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse JSON response
    let parsed: InterviewResponse;
    try {
      parsed = JSON.parse(responseText) as InterviewResponse;

      // Ensure arrays are arrays (defensive)
      if (!Array.isArray(parsed.extractedFields?.demographics)) {
        parsed.extractedFields.demographics = [];
      }
      if (!Array.isArray(parsed.extractedFields?.interests)) {
        parsed.extractedFields.interests = [];
      }
      if (!Array.isArray(parsed.extractedFields?.painPoints)) {
        parsed.extractedFields.painPoints = [];
      }
    } catch {
      // Fallback if JSON parsing fails
      parsed = {
        message: responseText,
        extractedFields: {
          name: null,
          brandVoice: null,
          positioning: null,
          demographics: [],
          interests: [],
          painPoints: [],
          missionStatement: null,
        },
        completeness: 0,
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[brand-profiles/interview] POST error:', error);
    return NextResponse.json(
      { error: 'Interview request failed' },
      { status: 500 }
    );
  }
}
