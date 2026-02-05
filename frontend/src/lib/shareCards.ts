/**
 * Shareable Cards — Canvas-based image generation + share utilities
 *
 * Generates 1080x1920 PNG images (Instagram Stories format) for sharing.
 * 4 card types: Recruit Sellers, Recruit Ambassadors, Seller Listing, Ambassador Promotes Listing.
 */

// Brand colors
const ROOTS_PRIMARY = '#EB6851';
const ROOTS_SECONDARY = '#3EBFAC';
const ROOTS_CREAM = '#F5F0EE';
const ROOTS_GRAY = '#818181';

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

// ─── Card Data Types ──────────────────────────────────────────

export type ShareCardType = 'recruit-sellers' | 'recruit-ambassadors' | 'seller-listing' | 'ambassador-listing';

export interface RecruitSellersData {
  type: 'recruit-sellers';
  ambassadorName: string;
  ambassadorId: string;
}

export interface RecruitAmbassadorsData {
  type: 'recruit-ambassadors';
  ambassadorName: string;
  ambassadorId: string;
}

export interface SellerListingData {
  type: 'seller-listing';
  produceName: string;
  price: string;
  sellerName: string;
  neighborhood: string;
  imageUrl?: string;
}

export interface AmbassadorListingData {
  type: 'ambassador-listing';
  produceName: string;
  neighborhood: string;
  imageUrl?: string;
}

export type ShareCardData = RecruitSellersData | RecruitAmbassadorsData | SellerListingData | AmbassadorListingData;

// ─── Canvas Helpers ───────────────────────────────────────────

function drawGradientBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  gradient.addColorStop(0, ROOTS_PRIMARY);
  gradient.addColorStop(0.5, '#D45A45');
  gradient.addColorStop(1, ROOTS_SECONDARY);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

function drawBranding(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = ROOTS_CREAM;
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LOCAL ROOTS', CARD_WIDTH / 2, 140);

  // Subtle line under branding
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH / 2 - 120, 170);
  ctx.lineTo(CARD_WIDTH / 2 + 120, 170);
  ctx.stroke();
}

function drawCtaPill(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
  const metrics = ctx.measureText(text);
  const pillWidth = metrics.width + 100;
  const pillHeight = 80;
  const x = (CARD_WIDTH - pillWidth) / 2;

  // White rounded pill
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(x, y, pillWidth, pillHeight, 40);
  ctx.fill();

  // Dark text
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.fillText(text, CARD_WIDTH / 2, y + 54);
}

function drawDomainFooter(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '32px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('localroots.love', CARD_WIDTH / 2, CARD_HEIGHT - 80);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Timeout after 5s
    setTimeout(() => resolve(null), 5000);
    img.src = url;
  });
}

function getProduceEmoji(produceName: string): string {
  const name = produceName.toLowerCase();
  const emojiMap: Record<string, string> = {
    tomato: '\u{1F345}', tomatoes: '\u{1F345}',
    corn: '\u{1F33D}',
    pepper: '\u{1F336}\u{FE0F}', peppers: '\u{1F336}\u{FE0F}',
    carrot: '\u{1F955}', carrots: '\u{1F955}',
    broccoli: '\u{1F966}',
    lettuce: '\u{1F96C}', greens: '\u{1F96C}', kale: '\u{1F96C}', spinach: '\u{1F96C}',
    apple: '\u{1F34E}', apples: '\u{1F34E}',
    peach: '\u{1F351}', peaches: '\u{1F351}',
    strawberry: '\u{1F353}', strawberries: '\u{1F353}', berry: '\u{1F353}', berries: '\u{1F353}',
    blueberry: '\u{1FAD0}', blueberries: '\u{1FAD0}',
    watermelon: '\u{1F349}',
    cucumber: '\u{1F952}', cucumbers: '\u{1F952}',
    avocado: '\u{1F951}',
    potato: '\u{1F954}', potatoes: '\u{1F954}',
    onion: '\u{1F9C5}', onions: '\u{1F9C5}',
    garlic: '\u{1F9C4}',
    eggplant: '\u{1F346}',
    mushroom: '\u{1F344}', mushrooms: '\u{1F344}',
    herbs: '\u{1F33F}', basil: '\u{1F33F}', mint: '\u{1F33F}', cilantro: '\u{1F33F}',
    squash: '\u{1F33D}', zucchini: '\u{1F33D}',
    bean: '\u{1FAD8}', beans: '\u{1FAD8}', peas: '\u{1FAD8}',
    lemon: '\u{1F34B}', lemons: '\u{1F34B}',
    orange: '\u{1F34A}', oranges: '\u{1F34A}',
    melon: '\u{1F348}',
    grape: '\u{1F347}', grapes: '\u{1F347}',
    pear: '\u{1F350}', pears: '\u{1F350}',
    cherry: '\u{1F352}', cherries: '\u{1F352}',
    fig: '\u{1F95D}', figs: '\u{1F95D}',
    honey: '\u{1F36F}',
    egg: '\u{1F95A}', eggs: '\u{1F95A}',
    flower: '\u{1F33B}', flowers: '\u{1F33B}', sunflower: '\u{1F33B}',
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (name.includes(key)) return emoji;
  }
  return '\u{1F33E}'; // sheaf of rice fallback
}

// ─── Card Generators ──────────────────────────────────────────

export async function generateRecruitSellerCard(data: RecruitSellersData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  drawGradientBackground(ctx);
  drawBranding(ctx);

  // Sprout emoji area
  ctx.font = '180px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('\u{1F331}', CARD_WIDTH / 2, 480);

  // Ambassador name
  ctx.fillStyle = ROOTS_CREAM;
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const displayName = data.ambassadorName || 'A Local Roots Ambassador';
  wrapText(ctx, displayName, CARD_WIDTH / 2, 620, CARD_WIDTH - 160, 64);

  // Main message
  ctx.font = '44px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  wrapText(ctx, "I'm helping neighbors sell homegrown produce", CARD_WIDTH / 2, 760, CARD_WIDTH - 160, 56);

  // Big question
  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Got a garden?', CARD_WIDTH / 2, 1050);

  // Sub-text
  ctx.font = '38px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  wrapText(ctx, 'No fees. All local. Sell what you grow to your neighbors.', CARD_WIDTH / 2, 1160, CARD_WIDTH - 160, 50);

  // CTA pill
  drawCtaPill(ctx, 'Start selling!', 1380);

  drawDomainFooter(ctx);

  return canvas.toDataURL('image/png');
}

export async function generateRecruitAmbassadorCard(data: RecruitAmbassadorsData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  drawGradientBackground(ctx);
  drawBranding(ctx);

  // Star emoji
  ctx.font = '180px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('\u{2B50}', CARD_WIDTH / 2, 480);

  // Ambassador name
  ctx.fillStyle = ROOTS_CREAM;
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  const displayName = data.ambassadorName || 'A Local Roots Ambassador';
  wrapText(ctx, displayName, CARD_WIDTH / 2, 620, CARD_WIDTH - 160, 64);

  // Main message
  ctx.font = '44px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  wrapText(ctx, 'Help your neighbors grow and sell food', CARD_WIDTH / 2, 760, CARD_WIDTH - 160, 56);

  // Earn highlight
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  wrapText(ctx, 'Earn 25% from every sale in your network', CARD_WIDTH / 2, 960, CARD_WIDTH - 140, 70);

  // Sub-text
  ctx.font = '38px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  wrapText(ctx, 'Support local food. Build community. Earn rewards.', CARD_WIDTH / 2, 1180, CARD_WIDTH - 160, 50);

  // CTA pill
  drawCtaPill(ctx, 'Become an Ambassador', 1380);

  drawDomainFooter(ctx);

  return canvas.toDataURL('image/png');
}

export async function generateSellerListingCard(data: SellerListingData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  drawGradientBackground(ctx);
  drawBranding(ctx);

  // Produce image or emoji
  let imageDrawn = false;
  if (data.imageUrl) {
    const img = await loadImage(data.imageUrl);
    if (img) {
      // Draw circular produce image
      const imgSize = 360;
      const imgX = (CARD_WIDTH - imgSize) / 2;
      const imgY = 260;
      ctx.save();
      ctx.beginPath();
      ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Cover the circle with the image
      const aspect = img.width / img.height;
      let drawW = imgSize, drawH = imgSize;
      if (aspect > 1) { drawW = imgSize * aspect; } else { drawH = imgSize / aspect; }
      ctx.drawImage(img, imgX - (drawW - imgSize) / 2, imgY - (drawH - imgSize) / 2, drawW, drawH);
      ctx.restore();
      // White border
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      imageDrawn = true;
    }
  }

  if (!imageDrawn) {
    const emoji = getProduceEmoji(data.produceName);
    ctx.font = '200px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, CARD_WIDTH / 2, 520);
  }

  const textStartY = imageDrawn ? 720 : 680;

  // Produce name + price
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const nameY = wrapText(ctx, data.produceName, CARD_WIDTH / 2, textStartY, CARD_WIDTH - 160, 76);

  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = ROOTS_CREAM;
  ctx.fillText(data.price, CARD_WIDTH / 2, nameY + 80);

  // Grown by
  ctx.font = '42px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const grownBy = `Grown by ${data.sellerName || 'a local gardener'}`;
  ctx.fillText(grownBy, CARD_WIDTH / 2, nameY + 170);

  // Neighborhood
  if (data.neighborhood) {
    ctx.font = '38px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`\u{1F4CD} ${data.neighborhood}`, CARD_WIDTH / 2, nameY + 240);
  }

  // CTA pill
  drawCtaPill(ctx, 'Shop local!', 1380);

  drawDomainFooter(ctx);

  return canvas.toDataURL('image/png');
}

export async function generateAmbassadorListingCard(data: AmbassadorListingData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  drawGradientBackground(ctx);
  drawBranding(ctx);

  // Produce image or emoji
  let imageDrawn = false;
  if (data.imageUrl) {
    const img = await loadImage(data.imageUrl);
    if (img) {
      const imgSize = 360;
      const imgX = (CARD_WIDTH - imgSize) / 2;
      const imgY = 260;
      ctx.save();
      ctx.beginPath();
      ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const aspect = img.width / img.height;
      let drawW = imgSize, drawH = imgSize;
      if (aspect > 1) { drawW = imgSize * aspect; } else { drawH = imgSize / aspect; }
      ctx.drawImage(img, imgX - (drawW - imgSize) / 2, imgY - (drawH - imgSize) / 2, drawW, drawH);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      imageDrawn = true;
    }
  }

  if (!imageDrawn) {
    const emoji = getProduceEmoji(data.produceName);
    ctx.font = '200px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, CARD_WIDTH / 2, 520);
  }

  const textStartY = imageDrawn ? 720 : 680;

  // Fresh {produce} from my neighbor
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const titleY = wrapText(ctx, `Fresh ${data.produceName} from my neighbor`, CARD_WIDTH / 2, textStartY, CARD_WIDTH - 140, 70);

  // Neighborhood
  if (data.neighborhood) {
    ctx.font = '44px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`in ${data.neighborhood}`, CARD_WIDTH / 2, titleY + 80);
  }

  // Support message
  ctx.font = '42px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const supportY = data.neighborhood ? titleY + 170 : titleY + 100;
  ctx.fillText('Support local growers!', CARD_WIDTH / 2, supportY);

  // CTA pill
  drawCtaPill(ctx, 'Shop now!', 1380);

  drawDomainFooter(ctx);

  return canvas.toDataURL('image/png');
}

// ─── Generate Card (dispatcher) ──────────────────────────────

export async function generateCard(data: ShareCardData): Promise<string> {
  switch (data.type) {
    case 'recruit-sellers':
      return generateRecruitSellerCard(data);
    case 'recruit-ambassadors':
      return generateRecruitAmbassadorCard(data);
    case 'seller-listing':
      return generateSellerListingCard(data);
    case 'ambassador-listing':
      return generateAmbassadorListingCard(data);
  }
}

// ─── Share Utilities ──────────────────────────────────────────

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new File([u8arr], filename, { type: mime });
}

export async function shareCard(dataUrl: string, text: string, url: string): Promise<boolean> {
  const file = dataUrlToFile(dataUrl, 'localroots-card.png');

  // Tier 1: Share with file
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, url });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }

  // Tier 2: Share text only
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }

  // Tier 3: Download + copy
  downloadImage(dataUrl, 'localroots-card.png');
  await copyToClipboard(url);
  return true;
}

export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Intent URL Generators ───────────────────────────────────

export function getSmsShareUrl(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

export function getFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function getEmailShareUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getNextDoorShareUrl(): string {
  return 'https://nextdoor.com/post/';
}

// ─── Share URL per Card Type ─────────────────────────────────

export function getCardShareUrl(data: ShareCardData): string {
  const base = 'https://localroots.love';
  switch (data.type) {
    case 'recruit-sellers':
      return `${base}/sell/register?ref=${data.ambassadorId}`;
    case 'recruit-ambassadors':
      return `${base}/ambassador/register?ref=${data.ambassadorId}`;
    case 'seller-listing':
    case 'ambassador-listing':
      return `${base}/buy`;
  }
}

// ─── Pre-Written Share Text ──────────────────────────────────

export function getShareText(data: ShareCardData, channel: 'sms' | 'facebook' | 'email' | 'nextdoor' | 'generic'): string {
  const url = getCardShareUrl(data);

  switch (data.type) {
    case 'recruit-sellers': {
      if (channel === 'nextdoor') {
        return `Hi neighbors! I'm helping local gardeners sell their homegrown produce through Local Roots. If you have a garden and want to sell what you grow — no fees, all local — sign up here: ${url}`;
      }
      if (channel === 'sms') {
        return `Hey! I'm helping neighbors sell their homegrown produce with Local Roots. Got a garden? Sign up here — no fees: ${url}`;
      }
      if (channel === 'email') {
        return `I wanted to share Local Roots with you — it's a way for gardeners to sell their homegrown produce to neighbors. No fees, all local.\n\nIf you have a garden and want to start selling, sign up here: ${url}\n\nLet me know if you have questions!`;
      }
      return `I'm helping neighbors sell their homegrown produce with Local Roots. Got a garden? Sign up here: ${url}`;
    }

    case 'recruit-ambassadors': {
      if (channel === 'sms') {
        return `Hey! Want to help your neighbors grow and sell food? You can earn 25% from every sale. Check out Local Roots: ${url}`;
      }
      if (channel === 'email') {
        return `I wanted to tell you about Local Roots — we're building a local food network where neighbors sell homegrown produce.\n\nAs an ambassador, you earn 25% from every sale in your network. It's a great way to support local food and earn rewards.\n\nSign up here: ${url}`;
      }
      return `Help your neighbors grow and sell food. Earn 25% from every sale as a Local Roots ambassador: ${url}`;
    }

    case 'seller-listing': {
      const d = data as SellerListingData;
      if (channel === 'nextdoor') {
        return `Fresh ${d.produceName} available from my garden! ${d.price}. Order on Local Roots: ${url}`;
      }
      if (channel === 'sms') {
        return `I just listed ${d.produceName} on Local Roots! ${d.price}. Order here: ${url}`;
      }
      if (channel === 'email') {
        return `I'm selling fresh ${d.produceName} from my garden — ${d.price}.\n\nYou can order on Local Roots: ${url}\n\nEverything is locally grown!`;
      }
      return `Fresh ${d.produceName} from my garden! ${d.price}. Shop on Local Roots: ${url}`;
    }

    case 'ambassador-listing': {
      const d = data as AmbassadorListingData;
      const locationPart = d.neighborhood ? ` from a neighbor in ${d.neighborhood}` : ' from a local grower';
      if (channel === 'nextdoor') {
        return `Fresh ${d.produceName}${locationPart}! Support local growers: ${url}`;
      }
      if (channel === 'sms') {
        return `Check this out — fresh ${d.produceName}${locationPart}. Shop local: ${url}`;
      }
      if (channel === 'email') {
        return `I wanted to share this — fresh ${d.produceName} available${locationPart}.\n\nSupport local growers on Local Roots: ${url}`;
      }
      return `Fresh ${d.produceName}${locationPart}! Support local growers: ${url}`;
    }
  }
}

export function getEmailSubject(data: ShareCardData): string {
  switch (data.type) {
    case 'recruit-sellers':
      return 'Sell your garden produce with Local Roots';
    case 'recruit-ambassadors':
      return 'Become a Local Roots Ambassador — earn 25% from sales';
    case 'seller-listing':
      return `Fresh ${(data as SellerListingData).produceName} available!`;
    case 'ambassador-listing':
      return `Fresh ${(data as AmbassadorListingData).produceName} from a local grower`;
  }
}

/** Whether this card type supports NextDoor sharing */
export function supportsNextDoor(data: ShareCardData): boolean {
  return data.type !== 'recruit-ambassadors';
}
