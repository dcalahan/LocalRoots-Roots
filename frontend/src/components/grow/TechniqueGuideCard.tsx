'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface TechniqueGuideCardProps {
  slug: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeToComplete: string;
  tags: string[];
  compact?: boolean;
}

const difficultyColors: Record<string, { bg: string; text: string }> = {
  beginner: { bg: 'bg-green-100', text: 'text-green-800' },
  intermediate: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  advanced: { bg: 'bg-red-100', text: 'text-red-800' },
};

const difficultyIcons: Record<string, string> = {
  beginner: '🌱',
  intermediate: '🌿',
  advanced: '🌳',
};

export function TechniqueGuideCard({
  slug,
  title,
  description,
  difficulty,
  timeToComplete,
  tags,
  compact = false,
}: TechniqueGuideCardProps) {
  const colors = difficultyColors[difficulty] || difficultyColors.beginner;

  if (compact) {
    return (
      <Link href={`/grow/guides/${slug}`} className="block">
        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{difficultyIcons[difficulty]}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-semibold text-sm truncate">
                  {title}
                </h3>
                <p className="text-xs text-roots-gray line-clamp-2 mt-1">
                  {description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/grow/guides/${slug}`} className="block">
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h3 className="font-heading font-bold text-lg group-hover:text-roots-primary transition-colors">
              {title}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${colors.bg} ${colors.text}`}>
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </span>
          </div>

          <p className="text-roots-gray text-sm mb-4 line-clamp-3">
            {description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
            <span className="text-xs text-roots-gray flex-shrink-0">
              {timeToComplete}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
