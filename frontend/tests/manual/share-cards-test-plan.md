# Share Cards Manual Test Plan

Canvas-based share cards cannot be automatically tested with contract E2E tests.
Run these manual tests after any changes to `shareCards.ts` or `ShareCardModal.tsx`.

## Test Environment
- URL: https://www.localroots.love
- Requires: Ambassador account (register at `/ambassador/register`)
- Test on: Desktop Chrome, Mobile Safari (iOS), Mobile Chrome (Android)

---

## 1. Recruit Sellers Card

**Trigger:** Ambassador Dashboard → Share Recruitment Card button

### Card Generation
- [ ] Card generates without errors (no console errors)
- [ ] Cream background displays correctly
- [ ] Coral accent bar at top
- [ ] "LOCAL ROOTS" branding visible
- [ ] Produce emoji cluster (tomato, corn, broccoli) renders
- [ ] Headline: "Help feed your neighbors" displays
- [ ] Sub-headline: "Sell your extra produce locally"
- [ ] Benefits with teal checkmarks: No fees, Takes 2 minutes, 100% local
- [ ] Coral CTA button: "Start selling"
- [ ] Footer: sprout + localroots.love

### Share Channels
- [ ] **Share button (mobile):** Opens native share sheet with image attached
- [ ] **Instagram:** Downloads image, toast says "Open Instagram and share from your camera roll"
- [ ] **Facebook:** Downloads image, toast says "Open Facebook and attach the image to your post"
- [ ] **NextDoor:** Opens nextdoor.com, copies text, toast says "Create a post on NextDoor and paste your message"
- [ ] **Copy Link:** Copies `localroots.love/sell/register?ref={id}` to clipboard
- [ ] **SMS:** Opens SMS app with pre-filled text including referral link
- [ ] **Email:** Opens email client with subject and body
- [ ] **Save:** Downloads PNG file

---

## 2. Recruit Ambassadors Card

**Trigger:** Ambassador Dashboard → Ambassador Referral Link → Share button

### Card Generation
- [ ] Card generates without errors
- [ ] Cream background
- [ ] Teal accent bar at top
- [ ] Sprout-handshake-sprout emoji cluster
- [ ] Headline: "Help neighbors grow & sell food"
- [ ] Teal highlight box with "Earn 25%" and "from every sale in your network"
- [ ] Benefits list with checkmarks
- [ ] Teal CTA button: "Become an Ambassador"
- [ ] Footer: sprout + localroots.love

### Share Channels
- [ ] All channels work as described above
- [ ] NextDoor button NOT shown (ambassadors-only card)
- [ ] Referral link points to `/ambassador/register?ref={id}`

---

## 3. Seller Listing Card

**Trigger:** Seller Dashboard → Share button on a listing
**Requires:** Registered seller with at least one active listing

### Card Generation
- [ ] Card generates without errors
- [ ] Cream background
- [ ] Teal accent bar at top
- [ ] Produce image displays in rounded rectangle (if uploaded)
- [ ] OR emoji fallback displays if no image
- [ ] "Fresh from your neighbor" text
- [ ] Produce name (e.g., "Tomatoes")
- [ ] Price in coral (e.g., "$5.00/lb")
- [ ] Seller name: "Grown by [name]"
- [ ] Location with pin emoji (if available)
- [ ] Teal CTA button: "Order now"
- [ ] Footer: sprout + localroots.love

### Share Channels
- [ ] All channels work
- [ ] NextDoor IS shown
- [ ] Link points to `/buy`

---

## 4. Ambassador Listing Card

**Trigger:** Ambassador Dashboard → Recruited Farmers → Share button on a listing
**Requires:** Ambassador with recruited sellers who have listings

### Card Generation
- [ ] Card generates without errors
- [ ] Cream background
- [ ] Coral accent bar at top
- [ ] Produce image in rounded rectangle (or emoji fallback)
- [ ] "My neighbor is selling" text
- [ ] "Fresh [produce name]"
- [ ] Location with pin emoji (if available)
- [ ] "Support local growers!" in teal
- [ ] Coral CTA button: "Shop local"
- [ ] Footer: sprout + localroots.love

### Share Channels
- [ ] All channels work
- [ ] NextDoor IS shown
- [ ] Link points to `/buy`

---

## Cross-Platform Tests

### Desktop (Chrome/Safari/Firefox)
- [ ] Modal opens and displays card preview
- [ ] All buttons are clickable
- [ ] Download saves PNG to Downloads folder
- [ ] Copy Link shows success toast

### Mobile iOS (Safari)
- [ ] Native Share button shows iOS share sheet
- [ ] Share sheet includes image thumbnail
- [ ] Can share to Messages, Mail, etc.
- [ ] Download saves to Photos

### Mobile Android (Chrome)
- [ ] Native Share button shows Android share menu
- [ ] Share menu includes image
- [ ] Can share to various apps
- [ ] Download works

---

## Regression Checks

After any shareCards.ts changes:
- [ ] No TypeScript errors in build
- [ ] No console errors when generating cards
- [ ] All 4 card types render correctly
- [ ] Share modal opens/closes properly
- [ ] Toast notifications display correctly

---

## Known Limitations

1. **Instagram/Facebook** - Cannot directly post; must download and upload manually
2. **NextDoor** - No create-post API; copies text and opens site
3. **SMS/Email** - Text only, cannot attach image via web links
4. **Canvas on SSR** - Cards only generate client-side
