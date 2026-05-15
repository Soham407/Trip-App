# ADR 0001: Family Trip Prototype Architecture

## Status

Accepted

## Context

The app is a family trip workspace, not a finance product. The first version needs to make the core collaboration model tangible before production hardening.

The product decisions already resolved are:

- Multi-trip reuse
- Invite-only access
- Reusable family groups
- Shared trip members copied into each trip
- No budget system in v1
- INR only in v1
- Fixed and custom categories
- Parent categories with optional subcategories
- Global review queue
- Shared Shopping and Packing lists
- Manual cash expenses allowed
- Full trip-wide history
- Temporary edit locks with conflict prompts

## Decision

Use the following stack and product architecture for the current prototype:

- React Native with Expo
- Expo Router for navigation
- NativeWind for styling
- Repository-backed local store over browser storage / in-memory state for prototype local data
- Supabase for authentication, persistence, and sync API
- Supabase Edge Functions for webhook handling
- Browser speech recognition for web dictation in the prototype
- Google OAuth only through Supabase

The prototype should model:

- A current trip dashboard
- A global needs-review queue
- Shopping and Packing list tabs
- A chronological ledger
- A manual cash entry path
- A visible failed log surface

## Consequences

- The app can be prototyped with mocked data first, then wired to sync later
- The UI can stay focused on trip workflows instead of budget math
- Shared edits need explicit conflict handling
- Imported expense fields must remain locked
- Offline writes should show pending status instead of pretending they are synced

## Notes

This ADR now reflects the implementation of the current prototype. If the app later moves to WatermelonDB, Groq-backed transcription, or a different offline sync model, add a follow-up ADR rather than silently drifting the docs again.
