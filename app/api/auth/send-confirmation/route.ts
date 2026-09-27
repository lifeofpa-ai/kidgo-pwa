import { NextRequest, NextResponse } from 'next/server';
import { sendConfirmationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email, confirmLink, confirmCode } = await request.json();

    if (!email || !confirmLink) {
      return NextResponse.json(
        { error: 'Missing required fields: email, confirmLink' },
        { status: 400 }
      );
    }

    // Send confirmation email
    const result = await sendConfirmationEmail(email, confirmLink, confirmCode);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send confirmation email', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Confirmation email sent successfully',
        messageId: result.messageId
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
