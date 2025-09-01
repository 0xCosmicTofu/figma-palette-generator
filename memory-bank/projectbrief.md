# Figma Palette Generator - Project Brief

## Project Overview
A Figma plugin that automates the creation of systematic color palettes from moodboards and image collections, significantly reducing the time-consuming manual process of color abstraction and palette generation.

## Core Problem
Designers currently spend significant time manually:
- Abstracting colors from moodboards/images to hex values
- Mentally translating visual inspiration to systematic color systems
- Creating brand hierarchy (primary, secondary, tertiary colors)
- Generating monotone scales for UI elements
- Adapting colors for light/dark modes
- Finding complementary color combinations

## Solution
An intelligent plugin that:
1. Analyzes selected frames containing bitmap images
2. Uses median cut algorithm with size-based weighting for color extraction
3. Generates systematic color scales (000-900) inspired by Material Design
4. Creates organized, named frames with auto-spacing
5. Generates harmony palettes for immediate visual comparison
6. Outputs directly to Figma canvas as organized color styles

## Key Requirements
- **Input**: Selected frame containing bitmap images (max 10 recommended)
- **Processing**: Median cut algorithm with size-based weighting
- **Output**: Structured color scales and harmony palettes on Figma canvas
- **Accessibility**: WCAG contrast checking as toggleable feature
- **User Experience**: Plain language naming, auto-spacing, immediate visual feedback

## Success Criteria
- Reduces palette creation time from hours to minutes
- Generates professional, organized color systems
- Maintains design quality and accessibility standards
- Integrates seamlessly with existing Figma workflows
- Provides immediate visual comparison of color harmonies

## Target Users
- UI/UX designers
- Brand designers
- Design system creators
- Product teams requiring consistent color palettes
