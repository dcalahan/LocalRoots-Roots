'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TechniqueGuideCard, GardenAIChat } from '@/components/grow';
import guidesData from '@/data/technique-guides.json';

interface Guide {
  title: string;
  slug: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeToComplete: string;
  tags: string[];
}

const guides = Object.values(guidesData.guides) as Guide[];

// Group guides by difficulty
const beginnerGuides = guides.filter(g => g.difficulty === 'beginner');
const intermediateGuides = guides.filter(g => g.difficulty === 'intermediate');

export default function GuidesPage() {
  return (
    <>
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/grow"
          className="text-sm text-roots-primary hover:underline"
        >
          ← Back to Growing Guides
        </Link>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Technique Guides</h1>
        <p className="text-roots-gray max-w-xl mx-auto">
          Master essential gardening skills to grow better produce and increase
          your harvest for LocalRoots sales.
        </p>
      </div>

      {/* Featured Guide */}
      <Card className="mb-8 border-roots-primary/30 bg-gradient-to-r from-roots-pale to-green-50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="text-7xl">🌱</div>
            <div className="flex-1 text-center md:text-left">
              <span className="text-xs font-medium text-roots-primary uppercase tracking-wide">
                Start Here
              </span>
              <h2 className="text-xl font-heading font-bold mt-1 mb-2">
                New to Gardening?
              </h2>
              <p className="text-roots-gray text-sm mb-4">
                Begin with our beginner guides on raised beds and seed starting to
                build a solid foundation for your growing journey.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <Link
                  href="/grow/guides/raised-beds"
                  className="px-4 py-2 bg-roots-primary text-white rounded-lg text-sm font-medium hover:bg-roots-primary/90 transition-colors"
                >
                  Raised Beds Guide
                </Link>
                <Link
                  href="/grow/guides/starting-seeds-indoors"
                  className="px-4 py-2 bg-white border border-roots-primary text-roots-primary rounded-lg text-sm font-medium hover:bg-roots-pale transition-colors"
                >
                  Seed Starting Guide
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Beginner Guides */}
      <section className="mb-8">
        <h2 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
          <span className="text-2xl">🌱</span> Beginner Guides
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {beginnerGuides.map(guide => (
            <TechniqueGuideCard
              key={guide.slug}
              slug={guide.slug}
              title={guide.title}
              description={guide.description}
              difficulty={guide.difficulty}
              timeToComplete={guide.timeToComplete}
              tags={guide.tags}
            />
          ))}
        </div>
      </section>

      {/* Intermediate Guides */}
      {intermediateGuides.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🌿</span> Intermediate Guides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intermediateGuides.map(guide => (
              <TechniqueGuideCard
                key={guide.slug}
                slug={guide.slug}
                title={guide.title}
                description={guide.description}
                difficulty={guide.difficulty}
                timeToComplete={guide.timeToComplete}
                tags={guide.tags}
              />
            ))}
          </div>
        </section>
      )}

      {/* Quick Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Quick Growing Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💧</span>
              <div>
                <h4 className="font-medium text-sm">Water in the Morning</h4>
                <p className="text-xs text-roots-gray">
                  Reduces disease risk and gives plants time to dry before evening.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🌞</span>
              <div>
                <h4 className="font-medium text-sm">Know Your Sun</h4>
                <p className="text-xs text-roots-gray">
                  Most vegetables need 6+ hours of direct sunlight daily.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <h4 className="font-medium text-sm">Label Everything</h4>
                <p className="text-xs text-roots-gray">
                  You will not remember what you planted where. Trust us.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">✂️</span>
              <div>
                <h4 className="font-medium text-sm">Harvest Often</h4>
                <p className="text-xs text-roots-gray">
                  Regular picking encourages plants to produce more.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    <GardenAIChat />
    </>
  );
}
