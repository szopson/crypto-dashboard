# Cold Outreach Playbook - NexOperandi

> Target: Real Estate Companies, Agents, Property Sellers
> Offer: Lead-to-Appointment Automation (€750 setup + €250/month)

---

## Overview

**Goal:** Book 15+ sales calls via cold email outreach
**Math:** 3,000 emails × 0.5% booking rate = 15 calls

---

## The 7-Step Process

### Step 1: Industry Selection

**Criteria for ideal targets:**
- Local service businesses
- Have online presence (Google Business Profile)
- Pain point: Need consistent lead flow
- Can afford €250/month (established, not startups)

**Current Target: Real Estate**
- Real estate agencies
- Independent agents
- Property management companies
- Real estate investors/flippers

**Previous attempts:**
- Dental clinics
- Aesthetic medicine/med spas

**Why Real Estate works for automation offer:**
- High transaction values = budget for tools
- Time-sensitive leads = need for speed
- Competitive market = need differentiation
- Often miss calls/leads = clear pain point

---

### Step 2: Lead Scraping

**Source:** Google Maps

**Tool Options:**
- Outscraper (paid, reliable)
- Apify Google Maps Scraper
- PhantomBuster
- Custom Python script (google-maps-scraper)

**Search queries for Real Estate:**
```
"real estate agency" + [city]
"real estate agent" + [city]
"property management" + [city]
"immobilien" + [city] (German markets)
"nieruchomości" + [city] (Polish markets)
"makelaar" + [city] (Dutch markets)
```

**Filter criteria:**
- Minimum 5 Google reviews (signals established business)
- Has website
- Has email or contact form
- Active (recent reviews)

**Data to capture:**
| Field | Required | Notes |
|-------|----------|-------|
| Business name | Yes | |
| Owner/contact name | Yes | For personalization |
| Email | Yes | Primary or from website |
| Phone | Optional | For follow-up |
| Website | Yes | For video personalization |
| Address/City | Yes | For geo-targeting |
| Google rating | Yes | Quality filter |
| Review count | Yes | Min 5 |
| Categories | Yes | Verify industry fit |

---

### Step 3: Email Verification

**Why verify:**
- Protect sender reputation
- Avoid bounces (>2% = domain damage)
- Save Smartlead credits

**Tool Options:**
- ZeroBounce
- NeverBounce
- Hunter.io
- MillionVerifier (budget option)
- Reoon (budget option)

**Verification levels:**
1. **Valid** - Safe to send
2. **Catch-all** - Risky, send with caution
3. **Invalid** - Do not send
4. **Unknown** - Test in small batches

**Target:** Only send to Valid + selective Catch-all

---

### Step 4: Email Copy

**Framework:** Problem → Solution → Soft CTA

**Template for Real Estate:**

```
Subject: Quick question about [Company Name]

Hey {firstname},

Just reaching out to see if you're currently handling lead follow-up manually?

We help real estate agencies automatically respond to property inquiries within 60 seconds - even at 2am or on weekends when most agents miss calls.

Typically this means 3-5 extra appointments per month that would have otherwise gone to competitors.

Open to a quick chat to see if this would work for your agency?

Best,
[Your name]
```

**Key principles:**
- Short (under 100 words)
- One clear question/CTA
- Specific benefit (60 seconds, 3-5 appointments)
- No attachments or links in first email
- Personalization: {firstname}, [Company Name]

**Follow-up sequence (Smartlead):**
- Email 1: Day 0 - Initial outreach
- Email 2: Day 3 - "Did you see my last email?"
- Email 3: Day 7 - Value add / case study
- Email 4: Day 14 - Breakup email

---

### Step 5: Video Personalization

**Tool:** Pitchlane (or Loom, Sendspark, Vidyard)

**Video structure (30-45 seconds):**
1. **Hook (5s):** "Hey [Name], I was just looking at [Company] website..."
2. **Observation (10s):** "I noticed you're doing [X] - that's great because..."
3. **Problem (10s):** "But I'm guessing you're probably missing some leads when..."
4. **Solution (10s):** "We built something that handles this automatically..."
5. **CTA (5s):** "Would love to show you - link below to grab 15 mins"

**Personalization elements:**
- Show their website in browser
- Mention their city/area
- Reference their specialization (residential, commercial, luxury)
- Note something specific from their Google reviews

**Volume approach:**
- Record 100-200 unique videos for high-value prospects
- Use for follow-ups on warm leads (replied but didn't book)
- A/B test: video vs no-video in sequence

---

### Step 6: Email Sending via Smartlead

**Setup requirements:**
- Warmed domains (minimum 2 weeks warmup)
- Multiple sending accounts (50-100 emails/day each)
- For 3,000 emails: Need 3-5 email accounts

**Domain setup:**
- Use secondary domains (not nexoperandi.cloud)
- Example: nexoperandi-outreach.com, nexoperandi.io
- Set up proper DNS (SPF, DKIM, DMARC)

**Smartlead configuration:**
- Daily sending limit: 50-75 per account
- Sending window: 8am-6pm recipient timezone
- Randomize sending times
- Enable auto-warmup

**Campaign structure:**
```
Campaign 1: Real Estate - [City 1]
├── Sequence A (no video)
│   ├── Email 1: Initial
│   ├── Email 2: Follow-up 1
│   ├── Email 3: Follow-up 2
│   └── Email 4: Breakup
└── Sequence B (with video)
    └── Same structure, video in Email 1
```

---

### Step 7: Conversion Expectations

**Benchmarks:**
| Metric | Expected | Notes |
|--------|----------|-------|
| Open rate | 40-60% | Subject line dependent |
| Reply rate | 2-5% | Copy dependent |
| Positive reply | 1-2% | |
| Booking rate | 0.5-1% | From total sent |
| Show rate | 70-80% | Calendar reminder helps |
| Close rate | 20-30% | Of shows |

**Math for 15 calls:**
- Send: 3,000 emails
- Book: 15 calls (0.5%)
- Show: 11 calls (75%)
- Close: 3 deals (25%)
- Revenue: 3 × €750 = €2,250 setup + €750/month recurring

**Scaling:**
- If booking rate < 0.5%: Increase volume to 5,000-6,000
- If booking rate > 1%: Scale down, optimize for quality
- Industry competitiveness affects rates

---

## Tools Stack

| Purpose | Tool | Cost | Status |
|---------|------|------|--------|
| Scraping | Outscraper / Custom | $50-100 | TBD |
| Verification | MillionVerifier | $50 | TBD |
| Email Copy | Manual + AI assist | Free | TBD |
| Video | Pitchlane | $99/mo | TBD |
| Sending | Smartlead | $39/mo | TBD |
| CRM | Smartlead built-in | Included | TBD |
| Booking | Calendly | Free | Active |

---

## Automation Opportunities

**What to automate (build tooling):**
1. [ ] Google Maps scraping script
2. [ ] Email finder from website
3. [ ] Email verification integration
4. [ ] CSV formatting for Smartlead
5. [ ] Response categorization (AI)
6. [ ] CRM sync (positive replies → pipeline)

**What to keep manual:**
- Video recording (personalization quality)
- Email copy iteration
- Call booking (human touch for qualified)
- Sales calls

---

## Campaign Tracking

**Weekly metrics to track:**
- Emails sent
- Open rate
- Reply rate
- Positive replies
- Calls booked
- Shows
- Closes

**Execution Squad Integration:**
```
Execution → Positive Signal → Booked → Show → Close → Cash
   │              │             │        │       │       │
 3000 sent    30 replies    15 calls  11 show  3 close  €3,000
```

---

## Next Steps

1. **Scraping:** Build/configure Google Maps scraper for Real Estate
2. **Domains:** Set up secondary sending domains
3. **Accounts:** Create Smartlead + verification accounts
4. **Warmup:** Start domain warmup (2 weeks)
5. **Copy:** Finalize email sequence
6. **Launch:** First campaign to 500 prospects (test)
7. **Iterate:** Optimize based on results

---

## Lessons from Previous Campaigns

**Dental/Aesthetic Medicine - What didn't work:**
- [ ] Document learnings here
- [ ] What was the booking rate?
- [ ] Why pivot to Real Estate?

---

*Last updated: 2024-03-11*
*NexOperandi - AI automation for serious businesses*
