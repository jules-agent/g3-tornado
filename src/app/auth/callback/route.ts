import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // If this is a recovery (password reset), redirect to reset page
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
      }
      // Otherwise redirect to the next page or home
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', requestUrl.origin));
}
