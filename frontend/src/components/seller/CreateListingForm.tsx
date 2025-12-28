'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProduceSelector } from './ProduceSelector';
import { ImageUploader } from './ImageUploader';
import { useToast } from '@/hooks/use-toast';
import { getAllUnits } from '@/lib/produce';
import type { ProduceItem } from '@/lib/produce';

export function CreateListingForm() {
  const router = useRouter();
  const { toast } = useToast();

  const units = getAllUnits();

  // Form state
  const [selectedProduce, setSelectedProduce] = useState<ProduceItem | null>(null);
  const [description, setDescription] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitId, setUnitId] = useState('lb');
  const [organic, setOrganic] = useState(false);
  const [growingPractices, setGrowingPractices] = useState('');
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isFormValid =
    selectedProduce !== null &&
    pricePerUnit.trim().length > 0 &&
    parseFloat(pricePerUnit) > 0 &&
    quantity > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid || !selectedProduce) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedUnit = units.find((u) => u.id === unitId);

      // For MVP, just store locally (simulate save)
      // In production, this will upload to IPFS and create on-chain
      const listingData = {
        produceId: selectedProduce.id,
        produceName: selectedProduce.name,
        category: selectedProduce.category,
        description: description || undefined,
        unitId,
        unitName: selectedUnit?.name || unitId,
        images: imageHash ? [imageHash] : [],
        organic,
        growingPractices: growingPractices || undefined,
        pricePerUnit: parseFloat(pricePerUnit),
        quantity,
        createdAt: new Date().toISOString(),
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('Listing saved (MVP):', listingData);

      setIsSuccess(true);
      toast({
        title: 'Listing saved!',
        description: 'Your produce has been added to your listings.',
      });
    } catch (err) {
      console.error('Create listing error:', err);
      toast({
        title: 'Failed to create listing',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProduce(null);
    setDescription('');
    setPricePerUnit('');
    setQuantity(1);
    setUnitId('lb');
    setOrganic(false);
    setGrowingPractices('');
    setImageHash(null);
    setIsSuccess(false);
  };

  // Handle successful listing creation
  if (isSuccess) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 bg-roots-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-roots-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-xl font-heading font-bold mb-2">
            Listing Saved!
          </h3>
          <p className="text-roots-gray mb-4">
            Your {selectedProduce?.name} listing has been added. You can add more produce or view your dashboard.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={resetForm}
            >
              Add Another
            </Button>
            <Button onClick={() => router.push('/sell/dashboard')} className="bg-roots-primary">
              View Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Add Produce Listing</CardTitle>
          <CardDescription>
            What are you growing? Add it to your store.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Produce Selection */}
          <div>
            <Label className="mb-3 block">What are you selling? *</Label>
            <ProduceSelector
              onSelect={setSelectedProduce}
              selectedId={selectedProduce?.id}
            />
          </div>

          {/* Listing Details */}
          {selectedProduce && (
            <>
              <div className="pt-4 border-t">
                <Label htmlFor="description">Tell buyers about it (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Picked fresh this morning, great for salads..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              <ImageUploader
                onUpload={setImageHash}
                currentHash={imageHash || undefined}
                label="Add a Photo"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="unit">Per</Label>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="quantity">How many do you have? *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="mt-1 w-32"
                  required
                />
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Naturally Grown</p>
                    <p className="text-sm text-roots-gray">
                      No synthetic pesticides or fertilizers
                    </p>
                  </div>
                  <Switch checked={organic} onCheckedChange={setOrganic} />
                </div>

                {organic && (
                  <div>
                    <Label htmlFor="practices">Growing practices (optional)</Label>
                    <Input
                      id="practices"
                      value={growingPractices}
                      onChange={(e) => setGrowingPractices(e.target.value)}
                      placeholder="e.g., No-till, companion planting, hand-weeded..."
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-roots-primary hover:bg-roots-primary/90"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              'Save Listing'
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
