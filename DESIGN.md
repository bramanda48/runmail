---
name: Webmail SaaS Inbox
description: Clean, Material Design 3 inspired email client focusing on productivity and tonal elevation.
colors:
  primary: "#C2E7FF"
  accent: "#0B57D0"
  background: "#F6F8FC"
  surface: "#FFFFFF"
  surface-hover: "#F3F4F6"
  text-primary: "#1F1F1F"
  text-secondary: "#444746"
  border: "#E5E7EB"
  success: "#146C2E"
  warning: "#E27200"
typography:
  body-bold:
    fontFamily: "Roboto, Inter, sans-serif"
    fontSize: 0.875rem
    fontWeight: 700
    lineHeight: 1.5
  body-regular:
    fontFamily: "Roboto, Inter, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: "Roboto, Inter, sans-serif"
    fontSize: 0.75rem
    fontWeight: 500
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-compose:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.accent}"
    rounded: "{rounded.full}"
  surface-container:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
---

## Overview

Webmail SaaS interface designed for professional productivity. The design relies heavily on Google's Material Design 3 language, utilizing tonal elevation, rounded shapes, and clear hierarchy to make scanning dense information (emails) effortless.

## Colors

The palette uses a soft gray-blue (`#F6F8FC`) as the foundational canvas, elevating the main content area in pure white (`#FFFFFF`). The primary CTA and active states use a soft light blue (`#C2E7FF`), paired with a deep blue (`#0B57D0`) for text/icons to maintain excellent WCAG AAA contrast ratios.

## Typography

Relies on a clean geometric/humanist sans-serif (Roboto or Inter). Hierarchy in the email list is established purely by font-weight (700 for unread, 400 for read) and color (near-black vs dark gray).

## Spacing & Layout

A complex multi-panel dashboard. The layout creates visual separation through negative space and a distinct 16px radius on the main content container, rather than using rigid borders everywhere.

## Shapes

Pill shapes (`rounded-full`) are the signature element of this UI, used exclusively for high-interaction elements: the search bar, the Compose button, and active sidebar items.

## Elevation & Depth

Strictly **Tonal Elevation**. The UI avoids traditional drop shadows, creating a modern, flat, yet layered look by stacking `#FFFFFF` surfaces on top of `#F6F8FC` backgrounds.

## Rules to Never Break

- **No heavy drop shadows.** Depth must come from background color differences.
- **Strict typography hierarchy.** Unread emails must be visually distinct via bold text.
- **Maintain pill shapes** for core navigation and primary actions to retain the specific design language.
