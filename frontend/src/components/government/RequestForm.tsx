'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadImage, uploadMetadata } from '@/lib/pinata';

interface RequestFormProps {
  onSuccess?: () => void;
}

const JURISDICTIONS = [
  'Federal',
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
];

const REQUEST_TYPES = [
  { value: 'food_safety', label: 'Food Safety Investigation' },
  { value: 'other', label: 'Other' },
];

export function RequestForm({ onSuccess }: RequestFormProps) {
  const [agencyName, setAgencyName] = useState('');
  const [agencyEmail, setAgencyEmail] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [requestType, setRequestType] = useState('');
  const [justification, setJustification] = useState('');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [credentialsFile, setCredentialsFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Only accept PDFs
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be under 10MB');
        return;
      }
      setCredentialsFile(file);
      setError(null);
    }
  };

  const validateForm = () => {
    if (!agencyName.trim()) return 'Agency name is required';
    if (!agencyEmail.trim()) return 'Agency email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agencyEmail)) return 'Invalid email format';
    if (!jurisdiction) return 'Jurisdiction is required';
    if (!requestType) return 'Request type is required';
    if (!justification.trim()) return 'Justification is required';
    if (justification.trim().length < 100)
      return 'Justification must be at least 100 characters';
    if (!credentialsFile) return 'Supporting documentation is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload credentials file to IPFS
      const credentialsResult = await uploadImage(credentialsFile!);
      const credentialsIpfs = credentialsResult.ipfsHash;

      // Note: This form is informational only. Government agencies would need
      // to submit the request directly to the blockchain with their own wallet.
      // For now, we store the request metadata for manual processing.

      const requestData = {
        agencyName: agencyName.trim(),
        agencyEmail: agencyEmail.trim(),
        jurisdiction,
        requestType,
        justification: justification.trim(),
        callbackPhone: callbackPhone.trim(),
        credentialsIpfs,
        submittedAt: new Date().toISOString(),
      };

      // Upload request metadata to IPFS for reference
      await uploadMetadata(requestData, `gov-request-${Date.now()}`);

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error('[RequestForm] Error:', err);
      setError('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-bold mb-2">Request Submitted</h3>
          <p className="text-roots-gray mb-4">
            Your request has been received and will be reviewed by our ambassador community.
            We will contact you at {agencyEmail} within 5-7 business days.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSuccess(false);
              setAgencyName('');
              setAgencyEmail('');
              setJurisdiction('');
              setRequestType('');
              setJustification('');
              setCallbackPhone('');
              setCredentialsFile(null);
            }}
          >
            Submit Another Request
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a Data Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Agency Name */}
          <div className="space-y-2">
            <Label htmlFor="agencyName">Agency Name *</Label>
            <Input
              id="agencyName"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="e.g., FDA, State Health Department"
              disabled={isSubmitting}
            />
          </div>

          {/* Official Email */}
          <div className="space-y-2">
            <Label htmlFor="agencyEmail">Official Email *</Label>
            <Input
              id="agencyEmail"
              type="email"
              value={agencyEmail}
              onChange={(e) => setAgencyEmail(e.target.value)}
              placeholder="official@agency.gov"
              disabled={isSubmitting}
            />
            <p className="text-xs text-roots-gray">
              Must be a valid government email address
            </p>
          </div>

          {/* Jurisdiction */}
          <div className="space-y-2">
            <Label htmlFor="jurisdiction">Jurisdiction *</Label>
            <select
              id="jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={isSubmitting}
            >
              <option value="">Select jurisdiction...</option>
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          {/* Request Type */}
          <div className="space-y-2">
            <Label htmlFor="requestType">Request Type *</Label>
            <select
              id="requestType"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={isSubmitting}
            >
              <option value="">Select type...</option>
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Justification */}
          <div className="space-y-2">
            <Label htmlFor="justification">Justification *</Label>
            <textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why this data is needed, what investigation is underway, and how the data will be used..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y"
              disabled={isSubmitting}
            />
            <p className="text-xs text-roots-gray">
              Minimum 100 characters. Currently: {justification.length}
            </p>
          </div>

          {/* Callback Phone */}
          <div className="space-y-2">
            <Label htmlFor="callbackPhone">Callback Phone (optional)</Label>
            <Input
              id="callbackPhone"
              type="tel"
              value={callbackPhone}
              onChange={(e) => setCallbackPhone(e.target.value)}
              placeholder="(555) 555-5555"
              disabled={isSubmitting}
            />
          </div>

          {/* Supporting Documentation */}
          <div className="space-y-2">
            <Label>Supporting Documentation *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={isSubmitting}
            />

            {credentialsFile ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-2xl">📄</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{credentialsFile.name}</p>
                  <p className="text-xs text-roots-gray">
                    {(credentialsFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCredentialsFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  disabled={isSubmitting}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-roots-primary hover:text-roots-primary transition-colors"
                disabled={isSubmitting}
              >
                <span className="text-2xl mb-1">📎</span>
                <span className="text-sm">Upload PDF (agency credentials, warrant, etc.)</span>
              </button>
            )}
            <p className="text-xs text-roots-gray">PDF only, max 10MB</p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-roots-primary hover:bg-roots-primary/90"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>

          <p className="text-xs text-roots-gray text-center">
            By submitting this request, you acknowledge that your agency's credentials
            will be publicly viewable by our ambassador community for verification.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
