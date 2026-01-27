import { NextResponse } from 'next/server';

// Notion database ID for feedback
const NOTION_DATABASE_ID = '24e5d527-8100-42ea-baf8-261a87600025';

interface FeedbackRequest {
  type: 'Feature Request' | 'Bug Report' | 'General Feedback' | 'Question';
  message: string;
  email: string | null;
}

export async function POST(request: Request) {
  try {
    const body: FeedbackRequest = await request.json();

    if (!body.message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
      console.error('NOTION_API_KEY not configured');
      return NextResponse.json(
        { error: 'Feedback service not configured' },
        { status: 500 }
      );
    }

    // Create page in Notion database
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: {
          database_id: NOTION_DATABASE_ID,
        },
        properties: {
          Feedback: {
            title: [
              {
                text: {
                  content: body.message.trim().slice(0, 2000), // Notion limit
                },
              },
            ],
          },
          Type: {
            select: {
              name: body.type,
            },
          },
          Status: {
            select: {
              name: 'New',
            },
          },
          ...(body.email && {
            Email: {
              email: body.email,
            },
          }),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Notion API error:', error);
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
