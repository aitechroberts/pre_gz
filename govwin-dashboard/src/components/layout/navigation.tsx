// src/components/layout/navigation.tsx
'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { LogOut, User, Home, Bookmark } from 'lucide-react';
import Link from 'next/link';

export function Navigation() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-gray-900">🏛️ GovWin Portal</h1>
          
          {/* Navigation Links - only show when authenticated */}
          {isAuthenticated && (
            <div className="flex gap-6">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                <Home size={16} />
                Dashboard
              </Link>
              
              <Link 
                href="/saved" 
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                <Bookmark size={16} />
                Saved Opportunities
              </Link>
              
              {/* Future links: */}
              {/* 
              <Link href="/analytics" className="text-gray-600 hover:text-blue-600">Analytics</Link>
              */}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {/* User Info */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User size={16} />
                <span>{user?.name || user?.username || 'User'}</span>
              </div>
              
              {/* Logout Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="flex items-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </Button>
            </>
          ) : (
            <div className="text-sm text-gray-600">
              Parker Tide Portal
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}