'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RequestForm } from '@/components/government/RequestForm';

export default function GovernmentRequestPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/government"
          className="inline-flex items-center gap-1 text-sm text-roots-gray hover:text-roots-primary mb-6"
        >
          ← Back to Government Portal
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold">Submit a Data Request</h1>
          <p className="text-roots-gray mt-1">
            Request access to LocalRoots transaction data for legitimate government
            investigations.
          </p>
        </div>

        {/* Important notice */}
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-medium text-yellow-800 mb-1">Important Information</p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>
                    • All requests are reviewed and voted on by our ambassador community
                  </li>
                  <li>• The voting period is 5 days from submission</li>
                  <li>
                    • Your agency credentials will be publicly visible for verification
                  </li>
                  <li>
                    • Requests require a minimum of 10 votes to be approved
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <RequestForm />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-roots-gray">
          <p>
            Need help?{' '}
            <a
              href="mailto:government@localroots.love"
              className="text-roots-primary hover:underline"
            >
              Contact our government relations team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
