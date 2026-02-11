'use client';

import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TechniqueGuideCard } from '@/components/grow';
import { getCropGrowingInfo } from '@/lib/plantingCalendar';
import guidesData from '@/data/technique-guides.json';

interface Section {
  title: string;
  content: string;
}

interface Guide {
  title: string;
  slug: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeToComplete: string;
  tags: string[];
  sections: Section[];
  materials: string[];
  relatedCrops: string[];
  relatedGuides: string[];
}

const guides = guidesData.guides as Record<string, Guide>;

const difficultyColors: Record<string, { bg: string; text: string }> = {
  beginner: { bg: 'bg-green-100', text: 'text-green-800' },
  intermediate: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  advanced: { bg: 'bg-red-100', text: 'text-red-800' },
};

function renderContent(content: string) {
  // Simple markdown-like rendering
  return content.split('\n\n').map((paragraph, i) => {
    // Check for headers
    if (paragraph.startsWith('**') && paragraph.endsWith('**:')) {
      return (
        <h4 key={i} className="font-semibold mt-4 mb-2">
          {paragraph.replace(/\*\*/g, '').replace(':', '')}
        </h4>
      );
    }

    // Check for bold headers with content
    if (paragraph.startsWith('**')) {
      const parts = paragraph.split('**');
      return (
        <p key={i} className="mb-3">
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
        </p>
      );
    }

    // Check for list items
    if (paragraph.startsWith('- ')) {
      const items = paragraph.split('\n').filter(line => line.startsWith('- '));
      return (
        <ul key={i} className="list-disc pl-5 mb-3 space-y-1">
          {items.map((item, j) => {
            const text = item.replace(/^- /, '');
            // Handle bold in list items
            if (text.includes('**')) {
              const parts = text.split('**');
              return (
                <li key={j}>
                  {parts.map((part, k) =>
                    k % 2 === 1 ? <strong key={k}>{part}</strong> : part
                  )}
                </li>
              );
            }
            return <li key={j}>{text}</li>;
          })}
        </ul>
      );
    }

    // Check for numbered lists
    if (/^\d+\.\s/.test(paragraph)) {
      const items = paragraph.split('\n').filter(line => /^\d+\.\s/.test(line));
      return (
        <ol key={i} className="list-decimal pl-5 mb-3 space-y-1">
          {items.map((item, j) => {
            const text = item.replace(/^\d+\.\s/, '');
            if (text.includes('**')) {
              const parts = text.split('**');
              return (
                <li key={j}>
                  {parts.map((part, k) =>
                    k % 2 === 1 ? <strong key={k}>{part}</strong> : part
                  )}
                </li>
              );
            }
            return <li key={j}>{text}</li>;
          })}
        </ol>
      );
    }

    // Regular paragraph with potential bold
    if (paragraph.includes('**')) {
      const parts = paragraph.split('**');
      return (
        <p key={i} className="mb-3 text-roots-gray">
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="text-gray-800">{part}</strong> : part
          )}
        </p>
      );
    }

    return (
      <p key={i} className="mb-3 text-roots-gray">
        {paragraph}
      </p>
    );
  });
}

export default function GuidePage() {
  const params = useParams();
  const slug = params.slug as string;

  const guide = guides[slug];

  if (!guide) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/grow/guides" className="text-sm text-roots-primary hover:underline">
            ← Back to Guides
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-heading font-bold mb-2">Guide Not Found</h2>
            <p className="text-roots-gray mb-4">
              We couldn&apos;t find this guide. It may have been moved or removed.
            </p>
            <Link href="/grow/guides">
              <Button>Browse All Guides</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const colors = difficultyColors[guide.difficulty] || difficultyColors.beginner;

  // Get related guides data
  const relatedGuidesData = guide.relatedGuides
    .map(slug => guides[slug])
    .filter(Boolean) as Guide[];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/grow/guides" className="text-sm text-roots-primary hover:underline">
          ← Back to Guides
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
            {guide.difficulty.charAt(0).toUpperCase() + guide.difficulty.slice(1)}
          </span>
          <span className="text-sm text-roots-gray">•</span>
          <span className="text-sm text-roots-gray">{guide.timeToComplete}</span>
        </div>
        <h1 className="text-3xl font-heading font-bold mb-3">{guide.title}</h1>
        <p className="text-lg text-roots-gray">{guide.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {guide.tags.map(tag => (
            <span
              key={tag}
              className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Table of Contents */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="font-heading text-lg">In This Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-1">
            {guide.sections.map((section, i) => (
              <li key={i}>
                <a
                  href={`#section-${i}`}
                  className="text-roots-primary hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Content Sections */}
      <div className="space-y-8 mb-12">
        {guide.sections.map((section, i) => (
          <section key={i} id={`section-${i}`} className="scroll-mt-20">
            <h2 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
              <span className="text-roots-primary">{i + 1}.</span>
              {section.title}
            </h2>
            <div className="prose prose-gray max-w-none">
              {renderContent(section.content)}
            </div>
          </section>
        ))}
      </div>

      {/* Materials List */}
      {guide.materials.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-heading">Materials & Supplies</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {guide.materials.map((material, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-roots-primary">✓</span>
                  <span className="text-sm">{material}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Related Crops */}
      {guide.relatedCrops.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-heading">Related Crops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {guide.relatedCrops.map(cropId => {
                const cropInfo = getCropGrowingInfo(cropId);
                return (
                  <Link
                    key={cropId}
                    href={`/grow/crop/${cropId}`}
                    className="px-3 py-2 bg-green-50 text-green-800 rounded-lg text-sm hover:bg-green-100 transition-colors"
                  >
                    {cropInfo?.name || cropId}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Guides */}
      {relatedGuidesData.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-heading font-bold mb-4">Related Guides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedGuidesData.map(relatedGuide => (
              <TechniqueGuideCard
                key={relatedGuide.slug}
                slug={relatedGuide.slug}
                title={relatedGuide.title}
                description={relatedGuide.description}
                difficulty={relatedGuide.difficulty}
                timeToComplete={relatedGuide.timeToComplete}
                tags={relatedGuide.tags}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="p-6 bg-roots-pale rounded-xl text-center">
        <h3 className="font-heading font-bold text-lg mb-2">
          Ready to put this into practice?
        </h3>
        <p className="text-roots-gray mb-4">
          Check your personalized planting calendar to see what to grow now.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/grow/calendar">
            <Button className="bg-roots-primary">View Calendar</Button>
          </Link>
          <Link href="/grow/guides">
            <Button variant="outline">More Guides</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
