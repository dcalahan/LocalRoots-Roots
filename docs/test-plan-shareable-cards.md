# Shareable Cards — Manual Test Plan

Test on www.localroots.love after deploy. All tests on mobile (primary) and desktop (fallback).

---

## 1. Neighborhood Resolution

**Setup:** Need a registered seller with a geohash on-chain.

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1.1 | Open ShareCardModal for a seller listing (Card 3) | Modal shows loading spinner briefly, then card with neighborhood name (e.g., "Haynes Manor, Atlanta") | |
| 1.2 | Seller in a well-known neighborhood (e.g., 30305 area) | Displays neighborhood like "Haynes Manor" or "Buckhead", NOT just "Atlanta, GA" | |
| 1.3 | Seller in an area without Nominatim neighborhood data | Falls back gracefully to "City, ST" format (e.g., "Atlanta, GA") | |
| 1.4 | Open same card twice quickly | Second open uses cache, no extra Nominatim request (check Network tab) | |

---

## 2. Card Generation (Canvas)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 2.1 | Card 1 (Recruit Sellers) — open from ambassador dashboard | 1080x1920 image with brand gradient, sprout emoji, ambassador name, "Got a garden?", white CTA pill "Start selling!" | |
| 2.2 | Card 2 (Recruit Ambassadors) — open from ambassador dashboard | Star emoji, ambassador name, "Earn 25% from every sale", CTA "Become an Ambassador" | |
| 2.3 | Card 3 (Seller Listing) — open after creating a listing | Produce photo (or emoji fallback), produce name + price, "Grown by {name}", neighborhood, CTA "Shop local!" | |
| 2.4 | Card 3 with no produce photo uploaded | Emoji fallback renders cleanly instead of broken image | |
| 2.5 | Card 4 (Ambassador Promotes Listing) — open from RecruitedFarmersWidget | "Fresh {produce} from my neighbor", "in {neighborhood}", CTA "Shop now!" | |
| 2.6 | Long produce name or long seller name | Text wraps or truncates cleanly, doesn't overflow card | |
| 2.7 | Card preview in modal | Image renders at correct aspect ratio in the preview area | |

---

## 3. Share Flow — Mobile (iOS Safari / Android Chrome)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 3.1 | Tap "Share" button on any card | Native share sheet appears with the card image as an attachment | |
| 3.2 | Share to Instagram Stories from share sheet | Card opens in Instagram Stories editor at correct 1080x1920 | |
| 3.3 | Share to iMessage from share sheet | Image attaches to message correctly | |
| 3.4 | If `navigator.canShare({files})` returns false | Falls back to text-only share (link + pre-written text) | |

---

## 4. Share Flow — Desktop (Chrome / Safari / Firefox)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 4.1 | Click "Share" button on any card (if Web Share API supported) | Native share dialog OR download fallback | |
| 4.2 | Click "Download Image" | PNG downloads with descriptive filename | |
| 4.3 | Click "Copy Link" | Link copied to clipboard, button shows "Copied!" briefly | |

---

## 5. Channel Buttons

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 5.1 | SMS button — Card 1 | Opens SMS compose with pre-written text + seller referral link | |
| 5.2 | SMS button — Card 3 | Opens SMS compose with produce name, price, and /buy link | |
| 5.3 | Facebook button — any card | Opens Facebook share dialog with link | |
| 5.4 | Email button — any card | Opens mailto: with subject line and pre-written body | |
| 5.5 | Copy Link — any card | Copies correct URL to clipboard, shows "Copied!" feedback | |

---

## 6. NextDoor Flow

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 6.1 | NextDoor button visible on Card 1 (Recruit Sellers) | Button appears in channel list | |
| 6.2 | NextDoor button NOT visible on Card 2 (Recruit Ambassadors) | Button is absent | |
| 6.3 | NextDoor button visible on Card 3 (Seller Listing) | Button appears | |
| 6.4 | NextDoor button visible on Card 4 (Ambassador Promotes Listing) | Button appears | |
| 6.5 | Click NextDoor button on Card 1 | Text copied to clipboard + new tab opens to nextdoor.com/post/ + toast says "Text copied! Paste it into your NextDoor post." | |
| 6.6 | NextDoor text for Card 1 | Includes "Hi neighbors!", mentions Local Roots, includes seller referral URL | |
| 6.7 | NextDoor text for Card 3 | Includes produce name, price, /buy URL | |
| 6.8 | NextDoor text for Card 4 | Includes produce name, neighborhood, /buy URL | |

---

## 7. Auto-Popup — New Ambassador Registration

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 7.1 | Register as a new ambassador → redirected to dashboard | Share modal auto-opens with Card 1 (Recruit Sellers) data | |
| 7.2 | Dismiss the auto-popup, reload dashboard | Modal does NOT auto-open again (sessionStorage flag cleared) | |
| 7.3 | Existing ambassador visits dashboard normally | No auto-popup | |

---

## 8. Share Later — Dashboard Buttons

### Ambassador Dashboard

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 8.1 | "Share" button next to Farmer Referral Link copy button | Opens ShareCardModal with Card 1 data | |
| 8.2 | "Share" button next to Ambassador Referral Link copy button | Opens ShareCardModal with Card 2 data | |
| 8.3 | "Share" button per order in RecruitedFarmersWidget | Opens ShareCardModal with Card 4 data for that listing | |

### Seller Dashboard

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 8.4 | "Share" button per listing in My Listings tab | Opens ShareCardModal with Card 3 data (produce name, price, image from listing metadata) | |

### Create Listing Form — Success State

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 8.5 | After creating a listing, success screen shows "Share Listing" button | Button present, styled `bg-roots-secondary` | |
| 8.6 | Click "Share Listing" on success screen | Opens ShareCardModal with Card 3 data from the just-created listing | |
| 8.7 | "Tell your neighbors about it!" prompt text visible | Text appears above or near the share button | |

---

## 9. Edge Cases

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 9.1 | Ambassador with no profile name set | Card uses fallback (e.g., "A Local Roots Ambassador") | |
| 9.2 | Seller with no profile name set | Card uses fallback (e.g., "A Local Roots Seller") | |
| 9.3 | Listing with $0.00 price or missing price | Card still renders, shows available info | |
| 9.4 | Very slow network / Nominatim timeout | Modal shows loading state, eventually falls back to city-level or coordinates | |
| 9.5 | Popup blocker blocks NextDoor tab | Toast still fires, text still copied — user can manually navigate | |
| 9.6 | Browser without clipboard API | Graceful fallback (show text to copy manually, or skip copy step) | |

---

## 10. Visual / Brand Compliance

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 10.1 | Card gradient uses brand palette | `roots-primary` (#EB6851) and `roots-secondary` (#3EBFAC) — no generic greens/blues | |
| 10.2 | CTA pill is white with dark text | Clean, readable on gradient background | |
| 10.3 | "LOCAL ROOTS" branding at top of each card | Present and legible | |
| 10.4 | Cards look good on Instagram Stories preview | Proper 9:16 aspect ratio, text not cut off | |
| 10.5 | Modal uses brand colors | Buttons, text, loading spinner all use roots-primary/secondary/cream/gray | |
