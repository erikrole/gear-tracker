# Trade Board Open Work Hardening Plan

Date: 2026-06-30

## Goal

Make the Trade Board trustworthy and easy to understand across web and iOS, starting with the canonical web Open Work surface, then hardening trade/open-work APIs, then adding parity contracts and native iOS support.

## Slice 1: Canonical Web Open Work Clarity

- [x] Group web rows by user decision state instead of backend type.
- [x] Clarify instant claim, staff approval, request pending, staff review, my post, and resolved states.
- [x] Keep existing filters, actions, permissions, and shared Schedule title formatting.
- [x] Add source-contract coverage for grouping and consequence copy.
- [x] Update task/docs review notes.
- [x] Verify with focused source tests, whitespace check, docs check, and app build.

## Slice 2: Trade/Open-Work API Hardening

- [x] Audit effective call-window checks across trade claim, trade approval, open-shift pickup, and list visibility.
- [x] Align stale/race error copy and response shapes without changing permissions.
- [x] Add focused route/service tests for effective-window conflicts and race outcomes.

## Slice 3: Web/iOS Parity Contracts

- [x] Add source contracts for shared Open Work concepts, states, mutation outcomes, and row naming.
- [x] Ensure native models can decode open shifts, pickup requests, trade posts, and staff review states.

## Slice 4: Native iOS Trade Board

- [x] Update native Trade Board to consume Open Work plus trade posts.
- [x] Match canonical web state grouping and action consequence copy with native SwiftUI patterns.
- [x] Verify with iOS source contracts and Xcode build.
