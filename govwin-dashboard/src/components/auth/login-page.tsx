// src/components/auth/login-page.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

export function LoginPage() {
  const { login, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🏛️ GovWin Portal</CardTitle>
          <p className="text-gray-600">Sign in with your Microsoft account</p>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={login} 
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in with Microsoft'
            )}
          </Button>
          
          <p className="text-xs text-gray-500 mt-4 text-center">
            This will open a Microsoft login popup window
          </p>
        </CardContent>
      </Card>
    </div>
  );
}