'use client';

import AuthForm from '@/components/AuthForm';
import AuthErrorBoundary from '@/components/AuthErrorBoundary';

export default function LoginPage() {
  return (
    <AuthErrorBoundary>
      <AuthForm isSignUp={false} />
    </AuthErrorBoundary>
  );
}
