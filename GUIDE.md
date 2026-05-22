# Owezy — Quick Start for Friends

Five things you need to know. Everything else is obvious.

---

## 1. Sign up

Go to the app URL. Sign in with **Google** (recommended) or email + password.

After sign-in you'll be asked for your name, a photo, and your UPI ID (the `yourname@bankname` handle). The UPI ID is optional — you can add it later in Profile. Without it, UPI deep links won't pre-fill your ID when someone settles with you.

---

## 2. Add a friend

Tap **Friends** → search by name or phone number.

- If they're already on Owezy: send a friend request, they accept, done.
- If they're not on Owezy yet: enter their phone number → an invite link is created. Share it on WhatsApp. When they sign up with that phone number, expenses you added against them get automatically linked to their account.

You can only see shared expenses with a friend — never their full history with other people.

---

## 3. Add an expense

From the home screen, tap **+ Add expense** (or the **+** button from any friend or group page).

Fill in:
- **What** — title, e.g. "Dinner at Social"
- **How much** — full bill amount in ₹
- **Who paid** — defaults to you
- **Split between** — pick who was there. Equal split by default; tap "Custom" to enter per-person amounts

Tap **Save**. The debt appears immediately on both sides.

**Editing:** tap an expense → Edit (only the creator can edit). Any participant can add more people to an existing split.

**Deleting:** swipe left or tap Edit → Delete. The expense is removed from balances but preserved in history (soft delete).

---

## 4. Scan a receipt with AI

On the Add Expense screen, tap **Scan receipt** (camera icon, top right).

1. **Take a photo or upload** — works with printed bills, Swiggy/Zomato screenshots, handwritten chits
2. **Review items** — the AI extracts each line item. Fix any OCR mistakes, delete lines you don't want
3. **Describe the split** — speak or type who had what: *"Yasir had the lime soda and half the chicken, Ayan had only the veg"*. Or tap items and tap people to assign manually. Both work at the same time
4. **AI splits it** — shows per-person breakdown with full item attribution. GST and charges distributed proportionally
5. **Review** — adjust anything before saving. Unattributed items are flagged; assign them before you can confirm
6. **Confirm** — saves as a normal expense

**Limits:** 20 AI scans per day (shown as a badge). If you hit it, add manually.

**Voice quick-add** (skip the scan): tap the mic icon next to the title field and say *"Chai for 4, 80 rupees, I paid"* — the form fills in automatically.

---

## 5. Settle up

When you owe someone:

1. Go to **Home** → tap their row → tap **Settle up**
2. Enter the amount (defaults to what you owe)
3. Tap the UPI button — this opens GPay / PhonePe / Paytm with the amount and UPI ID pre-filled. Complete payment there
4. Tap **Mark as paid** in Owezy — this creates a pending settlement
5. The other person gets a notification → they tap **Confirm** to close the debt

The debt disappears from both balances once confirmed. If there's a dispute, tap **Dispute** and the settlement goes back to pending.

**Note:** Owezy doesn't verify the actual UPI transfer. It trusts that you paid when you mark it. The confirmation step from the recipient is the safety net.

---

## Trips

Create a **Trip** for time-bounded group expenses (Goa trip, weekend trek, etc.). Trip expenses are tracked separately from regular friend splits, with a per-day view and a shareable recap card at the end.

---

## Reminders

If someone owes you and hasn't settled in 3 days, Owezy sends them a notification. Another one at 7 days, then silence. You can also nudge them manually from the friend detail page → **Remind**.

---

## Privacy

- You only see expenses you're part of — nothing else
- Friends cannot see your other friends or other expenses
- All data is stored in Supabase (India region) and only accessible to the people in each expense

---

*Questions or bugs → tell Sahid directly.*
