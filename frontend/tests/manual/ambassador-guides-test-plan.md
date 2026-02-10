# Ambassador Guide Pages Test Plan

Manual tests for the ambassador onboarding guide pages.

## Test Environment
- URL: https://www.localroots.love
- Requires: Ambassador account
- Test on: Desktop and Mobile

---

## 1. Find Local Gardeners Guide

**Route:** `/ambassador/guide/find-gardeners`

### Access
- [ ] Page loads when logged in as ambassador
- [ ] Redirects to `/ambassador` if not logged in
- [ ] Redirects to `/ambassador` if logged in but not an ambassador

### Content
- [ ] Breadcrumb link to dashboard works
- [ ] Header: "Find Local Gardeners" with emoji
- [ ] Quick Actions bar at top with Share and Copy buttons

### Part 1: The Message
- [ ] "Why This Matters" card displays
- [ ] "The LocalRoots Vision" card with checkmarks
- [ ] "Your Message" card with quote boxes

### Part 2: Inspire New Growers
- [ ] "Who Could Start Growing?" list displays
- [ ] "The Inspiration Conversation" quotes display

### Part 3: Connect Existing Gardeners
- [ ] "Find People Already Growing" list
- [ ] "Their Extra Produce Has Value" card

### Part 4: How to Reach People
- [ ] 3-column grid: Local, Remote, Starting Fresh
- [ ] Each column has relevant tips

### Actions
- [ ] "Share Recruitment Card" button opens ShareCardModal
- [ ] "Copy My Referral Link" copies correct URL
- [ ] Bottom CTA buttons work
- [ ] "Next: Help Them Register" link works
- [ ] Back to Dashboard link works

---

## 2. Help Register Guide

**Route:** `/ambassador/guide/help-register`

### Access
- [ ] Page loads for ambassadors
- [ ] Proper redirects for non-ambassadors

### Content
- [ ] Step-by-step walkthrough (5 steps with numbers)
- [ ] Tips for Success card with bullet points
- [ ] Common Issues section with 4 issue cards

### Actions
- [ ] "Copy Registration Link" copies seller referral URL
- [ ] "Share Registration Card" opens ShareCardModal
- [ ] Navigation links work (Find Gardeners, Dashboard, First Listing)

---

## 3. First Listing Support Guide

**Route:** `/ambassador/guide/first-listing`

### Access
- [ ] Page loads for ambassadors
- [ ] Proper redirects for non-ambassadors

### Content
- [ ] "Creating a Great Listing" 5-step walkthrough
- [ ] Photo Tips card with Do/Don't columns
- [ ] Pricing Guidance section
- [ ] "After the Listing" numbered steps
- [ ] Pro Tips bullet list

### Actions
- [ ] Back to Dashboard button works
- [ ] "Start Over: Find Gardeners" link works
- [ ] Navigation links work

---

## 4. Dashboard Quick Actions Integration

**Route:** `/ambassador/dashboard`

### Quick Actions Section
- [ ] Quick Actions card appears AFTER Profile Card (not at bottom)
- [ ] 3 clickable cards in a row
- [ ] Each card has hover effect
- [ ] "Find Local Gardeners" links to `/ambassador/guide/find-gardeners`
- [ ] "Help Them Register" links to `/ambassador/guide/help-register`
- [ ] "First Listing Support" links to `/ambassador/guide/first-listing`

---

## 5. Footer Integration

**All pages**

- [ ] Footer appears at bottom of all pages
- [ ] "Send Feedback" link opens email to feedback@localroots.love
- [ ] "About" link works
- [ ] "Government" link works
- [ ] Testnet note displays

---

## Mobile Responsiveness

Test on mobile viewport (375px width):

- [ ] Guide pages scroll properly
- [ ] Cards stack vertically
- [ ] Text is readable
- [ ] Buttons are tappable
- [ ] Quick Actions cards stack on mobile
- [ ] Footer displays properly

---

## Regression Checks

- [ ] No TypeScript/build errors
- [ ] No console errors on any guide page
- [ ] All links resolve correctly
- [ ] Share functionality works from guide pages
