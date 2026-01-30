import { NextResponse } from 'next/server';

const NOTION_DATABASE_ID = 'f551c505-36e0-409e-9451-1f0c7184f570';

interface SignupRequest {
  email: string;
  name?: string;
}

export async function POST(request: Request) {
  try {
    const body: SignupRequest = await request.json();

    if (!body.email?.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
      console.error('NOTION_API_KEY not configured');
      return NextResponse.json(
        { error: 'Sign-up service not configured' },
        { status: 500 }
      );
    }

    const today = new Date().toISOString().split('T')[0];

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
          Name: {
            title: [
              {
                text: {
                  content: body.name?.trim() || body.email.trim(),
                },
              },
            ],
          },
          Email: {
            email: body.email.trim(),
          },
          Source: {
            select: {
              name: 'Coming Soon Page',
            },
          },
          'Signed Up': {
            date: {
              start: today,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notion API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to save sign-up' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sign-up submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit sign-up' },
      { status: 500 }
    );
  }
}
