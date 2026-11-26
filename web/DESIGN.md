---
name: UAGP Public Workspace
description: Restrained source-grounded civic collaboration workspace
colors:
  primary: "#5547b8"
  primary-hover: "#4537a4"
  primary-soft: "#eeebfa"
  surface: "#ffffff"
  sidebar: "#f6f7f9"
  ink: "#20232e"
  muted: "#626978"
  border: "#e1e4e9"
  border-strong: "#c9cdd6"
  focus: "#7062cd"
  success: "#24734f"
  draft: "#7861ae"
  review: "#245c9d"
  merged: "#6545b1"
  closed: "#687180"
  caution: "#795410"
  caution-bg: "#fff9ed"
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "29px"
    fontWeight: 620
    lineHeight: 1.28
    letterSpacing: "-.031em"
  title:
    fontSize: "17px"
    fontWeight: 620
    lineHeight: 1.4
    letterSpacing: "-.018em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "14px"
    lineHeight: 1.55
  label:
    fontSize: "12px"
    fontWeight: 560
rounded:
  sm: "6px"
  md: "8px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 13px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 13px"
---
# Design System: UAGP Public Workspace

## Overview

**Creative North Star: "Відкритий журнал спільної роботи"**

User-approved technical direction: a calm, compact workspace inspired by the interaction grammar of Linear and GitHub, with original identity and Ukrainian terminology. Every row leads to a real issue, proposed change, or document. This first implementation is light-mode and uses flat surfaces, semantic status icons, and a quiet indigo accent. Civic participation must feel like a clear task, not a registration funnel.

## Colors

Indigo is for actions, selection and links. Neutral surfaces carry the work; green means open in GitHub, muted violet denotes a draft, and a separate violet denotes merge. Brown distinguishes caution and dated fallback data. Status text accompanies color. Tokens are implemented in app/globals.css.

## Typography

A system UI font stack avoids external font fetching. Page heading 29px, section heading 17px, body 14px, metadata 11–13px. Long document passages have comfortable line height and limited prose measure. Monospace is reserved for branch identifiers and code.

## Layout

Desktop: fixed-width 232px sidebar, 58px top bar, flexible workspace. Main width 1510px maximum. Overview/detail columns collapse as room decreases; on screens up to 800px the sidebar becomes a horizontal navigation strip. Up to 540px catalogue rows stack metadata and retain readable titles. Search fields, form inputs and buttons use native semantics.

## Elevation & Depth

Flat by default. Borders and a second neutral surface provide hierarchy. Search focus uses a local focus ring. No decorative glass, gradients or large shadows.

## Shapes

8px controls and containers, 6px navigation. Thin borders and consistent line icons. The mark is a simple original vector drawing.

## Components

- Primary action: indigo, white text, 36px minimum height. Secondary: white surface and neutral outline.
- Catalogues: bordered group, status tabs, search, native filters, link rows with visible state and timestamp.
- Record rows: issue/PR number, title, editorial navigation category, actual assignment, actual source state.
- Source notices: visible date and data source; a dated snapshot is never presented as a live fetch.
- Document reader: source branch, timestamp, safe Markdown, overflow-safe tables and code.
- Local proposal editor: plain form, explicit local-only behavior, no hidden submission.

## Do's and Don'ts

- Do show true GitHub statuses and explicitly distinguish working branches from main.
- Do preserve focus indicators, visible labels and responsive wrap.
- Do make each action lead to a real destination.
- Don't use badges as a substitute for information or treat merge as a legal decision.
- Don't introduce fake counts, assigned coordinators or pilot partners.
- Don't force AI, sign-in, or data collection for public reading.
