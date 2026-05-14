# Trip App Context

## Overview

Family Trip Expense & List App is a shared trip workspace for a family. It tracks current-trip spending, uncategorized review items, shopping and packing lists, and shared history.

## Canonical Terms

### Trip

A single family trip record with its own members, expense history, and lists.

### Family Group

A reusable invitation group that can be copied into a new trip.

### Primary Admin

The only role that can hard delete trip data.

### Trip Admin

A user who can manage trip data and permissions, but cannot hard delete.

### Trip Member

An authenticated family member who belongs to a trip.

### Expense

A trip spend record. Expenses can be imported from bank email or entered manually.

### Imported Expense

An expense created from bank or FASTag email parsing.

### Manual Cash Expense

A manually entered expense, used when money changes hands offline.

### Needs Review Queue

The global queue of uncategorized trip expenses.

### Category

A classification for an expense. Categories can be fixed or custom.

### Parent Category

The top-level category, such as Food, Fuel, or Toll.

### Subcategory

An optional child category, such as Lunch under Food.

### Shopping List

The shared list for purchase items on the trip.

### Packing List

The shared list for packing items on the trip.

### List Item

A single checkbox item inside Shopping or Packing.

### Failed Log

A raw webhook record plus parsing failure reason when an email cannot be read.

### Activity Log

The visible history of edits, categorization, deletions, and list changes.

### Edit Lock

A temporary lock on a record while someone is editing it.

## Relationships

- A Family Group can be reused to create multiple Trips.
- A Trip copies the current members from the selected Family Group at creation time.
- A Trip has one current active trip view at a time.
- A Trip has many Trip Members.
- A Trip can have multiple Trip Admins.
- A Trip has exactly one Primary Admin.
- A Trip has one shared Needs Review Queue.
- Any Trip Member can categorize or uncategorize expenses.
- Imported Expense amounts, merchants, and timestamps stay locked.
- A user may cross-check imported expense category and amount before final import.
- A Trip has one shared ledger.
- A Trip has one shared family list surface, split into Shopping and Packing tabs.
- Shopping and Packing items may be suggested from the full family history.
- All Trip Members can see the Activity Log.
- Edit Locks expire automatically after 30 seconds if not released manually.

## Flagged Decisions

- Trip budgeting is intentionally out of scope for v1.
- Multi-currency is out of scope for v1.
- Media attachments and receipt inboxes are out of scope for v1.
- Google OAuth is the only login method in v1.
