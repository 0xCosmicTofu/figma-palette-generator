# Product Context - Figma Palette Generator

## Why This Project Exists (UPDATED POST-PIVOT)

### Original Hypothesis (Disproven)
The current color palette creation workflow could be automated by extracting colors from moodboard images.

### Critical Discovery
**Figma API Limitation**: No pixel-level access to images means true color extraction is impossible. All attempts resulted in hash-based synthetic generation with poor results.

### Actual Problem We Can Solve
Designers still need faster, more systematic ways to create complete color systems, but the solution is:
- **Generate from chosen primary**: User picks the color, system builds everything else
- **Perfect color theory**: Focus on mathematically sound relationships
- **Complete design systems**: 000-900 scales, light/dark modes, organized output
- **Figma integration**: Direct creation of color styles and organized layouts

## Problems It Actually Solves
1. **Eliminates Manual Scale Creation**: Automatically generates 000-900 tint/shade scales
2. **Provides Color Theory Expertise**: Creates proper secondary/tertiary relationships
3. **Accelerates Design System Setup**: Complete color system in minutes, not hours
4. **Ensures Consistency**: Mathematical approach prevents arbitrary color choices
5. **Improves Organization**: Professional naming and layout in Figma
6. **Enables Rapid Iteration**: Easy to regenerate with different primary colors

## How It Should Work (UPDATED POST-PIVOT)
### New User Workflow
1. **Launch Plugin**: User opens the plugin in Figma
2. **Select Primary**: User chooses primary color via color picker
3. **Configure Options**: User selects scale steps, harmonies, accessibility settings
4. **Generate**: Plugin creates complete color system using color theory
5. **Output**: Generates organized frames with scales, harmonies, light/dark modes
6. **Integration**: Colors automatically added to Figma color styles

### Key Simplifications
- **No image processing**: Eliminates unreliable hash-based generation
- **User-controlled primary**: Designer makes the creative color choice
- **Focus on systematization**: Plugin excels at the mathematical/organizational work

### User Experience Goals
- **Intuitive**: Should feel like a natural extension of Figma
- **Fast**: Complete palette generation in under 2 minutes
- **Professional**: Output should look like it was designed by hand
- **Flexible**: Configurable options without overwhelming the user
- **Educational**: Users should understand the color theory behind suggestions

## User Experience Principles
1. **Respect User Intent**: Don't override existing work or preferences
2. **Provide Immediate Feedback**: Show progress and results in real-time
3. **Maintain Quality**: Generated palettes should meet professional standards
4. **Enable Iteration**: Easy to regenerate or adjust results
5. **Integrate Seamlessly**: Works within existing Figma workflows

## Success Metrics
- **Time Savings**: 80% reduction in palette creation time
- **User Adoption**: High usage among target designer audience
- **Quality Output**: Generated palettes meet professional design standards
- **Workflow Integration**: Seamless fit with existing Figma processes
