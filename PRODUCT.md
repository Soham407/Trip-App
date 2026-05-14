# Family Trip Expense & List App

## Register

product

## Product Purpose

Give a family one shared app for a trip, with fast expense capture, a global review queue, shared shopping and packing lists, and simple trip reuse across future vacations.

The app is not a budgeting tool first. It tracks what was spent on the current trip and makes shared decisions easy.

## Users

- Family members traveling together
- A primary admin who can hard delete trip data
- Other trip admins who can manage the trip but cannot hard delete

## Core Outcomes

- Capture imported bank and FASTag expenses into a global trip queue
- Let any trip member categorize or uncategorize an expense
- Keep a shared ledger of all trip spending
- Support shared Shopping and Packing lists
- Allow reusable family groups so the same people can be invited again for future trips

## Product Decisions From the Grill

- Multi-trip from day one
- Invite-only access
- Reusable family groups that spawn a new trip membership copy each time
- Copy current members into each new trip
- Duplicate a previous trip as the fastest creation path, with editable fields
- No budget system in v1
- INR only in v1
- Fixed categories plus user-defined custom categories
- Parent categories with optional subcategories
- Global review queue for uncategorized expenses
- Visible failed logs when parsing fails
- One shared family list per trip, split into Shopping and Packing tabs
- Manual cash entries allowed
- All trip members can categorize and uncategorize expenses
- Full change history visible to all trip members
- Prompt the user to resolve conflicts, with temporary edit locks that auto-expire after 30 seconds
- Online-first UX, with bounded pending states for writes that need sync
- Google OAuth only

## Scope Boundaries

### In scope

- Trip setup and reuse
- Expense review and categorization
- Shared list management
- Voice dictation for lists
- Manual cash expense entry
- Activity history

### Out of scope for v1

- Expense splitting math
- Budgets
- Receipt or photo inbox
- Media attachments
- Multi-currency

## First Prototype Goal

The prototype should help the family understand the workflow, not simulate every backend integration. It should make the current trip, the review queue, the lists, and the ledger feel real enough to validate the product shape.
