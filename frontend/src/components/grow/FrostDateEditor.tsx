'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGrowingProfile } from '@/contexts/GrowingProfileContext';

interface FrostDateEditorProps {
  lastSpringFrost: Date;
  firstFallFrost: Date;
  onClose: () => void;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function FrostDateEditor({ lastSpringFrost, firstFallFrost, onClose }: FrostDateEditorProps) {
  const { setManualFrostDates, clearOverrides } = useGrowingProfile();
  const [springDate, setSpringDate] = useState(formatDateForInput(lastSpringFrost));
  const [fallDate, setFallDate] = useState(formatDateForInput(firstFallFrost));

  const handleSave = () => {
    const spring = new Date(springDate);
    const fall = new Date(fallDate);

    if (spring >= fall) {
      alert('Spring frost date must be before fall frost date');
      return;
    }

    setManualFrostDates(spring, fall);
    onClose();
  };

  const handleReset = () => {
    clearOverrides();
    onClose();
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <div>
        <Label className="text-sm font-medium">Adjust Frost Dates</Label>
        <p className="text-xs text-roots-gray mb-3">
          Fine-tune based on your local microclimate or experience
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="springFrost" className="text-xs">Last Spring Frost</Label>
            <Input
              id="springFrost"
              type="date"
              value={springDate}
              onChange={(e) => setSpringDate(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-roots-gray mt-1">
              Safe to plant tender crops after this
            </p>
          </div>
          <div>
            <Label htmlFor="fallFrost" className="text-xs">First Fall Frost</Label>
            <Input
              id="fallFrost"
              type="date"
              value={fallDate}
              onChange={(e) => setFallDate(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-roots-gray mt-1">
              Protect or harvest tender crops before this
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} className="bg-roots-primary">
          Save Dates
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset to Auto
        </Button>
      </div>
    </div>
  );
}
