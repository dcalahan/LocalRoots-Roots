'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useGrowingProfile } from '@/contexts/GrowingProfileContext';
import { getAllZones } from '@/lib/growingZones';

interface ZoneSelectorProps {
  currentZone: string;
  onClose: () => void;
}

export function ZoneSelector({ currentZone, onClose }: ZoneSelectorProps) {
  const { setManualZone, clearOverrides } = useGrowingProfile();
  const [selectedZone, setSelectedZone] = useState(currentZone);
  const zones = getAllZones();

  const handleSave = () => {
    setManualZone(selectedZone);
    onClose();
  };

  const handleReset = () => {
    clearOverrides();
    onClose();
  };

  // Group zones by number
  const zoneGroups: Record<string, typeof zones> = {};
  zones.forEach(z => {
    const num = z.zone.replace(/[ab]$/, '');
    if (!zoneGroups[num]) zoneGroups[num] = [];
    zoneGroups[num].push(z);
  });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Select Your Zone</Label>
        <p className="text-xs text-roots-gray mb-3">
          USDA Hardiness Zones help determine what grows best in your area
        </p>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-gray-50">
          {zones.map(z => (
            <button
              key={z.zone}
              type="button"
              onClick={() => setSelectedZone(z.zone)}
              className={`px-2 py-1.5 text-sm rounded border transition-colors ${
                selectedZone === z.zone
                  ? 'bg-roots-primary text-white border-roots-primary'
                  : 'bg-white border-gray-200 hover:border-roots-primary'
              }`}
            >
              {z.zone}
            </button>
          ))}
        </div>

        {selectedZone && (
          <p className="text-sm text-roots-gray mt-2">
            {zones.find(z => z.zone === selectedZone)?.description}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} className="bg-roots-primary">
          Save Zone
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset to Auto
        </Button>
      </div>
    </div>
  );
}
