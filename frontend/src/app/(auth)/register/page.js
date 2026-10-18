'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 max-w-md mx-auto flex flex-col justify-center">
      <Card className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-white">Register / नया खाता</h1>
        <p className="text-sm text-slate-400">
          {/* TODO Phase 1: Worker/Contractor role selection, phone registration & profile setup */}
          TODO Phase 1: User registration, role selection & profile setup
        </p>
        <div className="pt-4">
          <Link href="/">
            <Button variant="secondary" className="w-full">
              Back to Home / मुख्य पृष्ठ
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
