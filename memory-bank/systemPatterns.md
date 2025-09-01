# System Patterns - Figma Palette Generator

## Architecture Overview
The plugin follows a modular, event-driven architecture designed for Figma's plugin ecosystem:

```
[UI Layer] → [Processing Layer] → [Output Layer]
     ↓              ↓                ↓
[Settings] → [Image Analysis] → [Canvas Generation]
[Controls] → [Color Processing] → [Style Management]
```

## Core Design Patterns

### 1. Event-Driven Processing
- **Selection Events**: Respond to frame selection changes
- **Processing Events**: Handle image analysis and color generation
- **Output Events**: Manage canvas updates and style creation

### 2. Pipeline Architecture
```
Input Validation → Image Processing → Color Extraction → Scale Generation → Canvas Output
```

### 3. Modular Color Processing
- **Image Analyzer**: Handles bitmap processing and weighting
- **Color Extractor**: Implements median cut algorithm
- **Scale Generator**: Creates 000-900 variations
- **Harmony Generator**: Calculates color relationships

## Technical Patterns

### Color Processing
- **HSL Color Space**: For predictable tint/shade generation
- **Median Cut Algorithm**: For efficient color quantization
- **Size-Based Weighting**: Larger images have more influence
- **Accessibility Checking**: WCAG contrast ratio calculations

### Canvas Management
- **Frame Organization**: Structured layout with clear naming
- **Auto-Spacing**: Consistent margins and professional appearance
- **Style Integration**: Automatic Figma color style creation
- **Layer Management**: Organized hierarchy for easy navigation

### Performance Patterns
- **Async Processing**: Non-blocking image analysis
- **Batch Operations**: Process multiple images simultaneously
- **Memory Management**: Efficient handling of large images
- **Progress Feedback**: Real-time status updates

## Data Flow Patterns

### Input Processing
1. **Frame Selection**: Validate selected frame contains images
2. **Image Extraction**: Gather all bitmap images from frame
3. **Size Analysis**: Calculate relative weights for each image
4. **Format Validation**: Ensure compatibility with processing pipeline

### Color Generation
1. **Dominant Color Extraction**: Use median cut with weighting
2. **Scale Generation**: Create 000-900 variations for each color
3. **Harmony Calculation**: Generate complementary and analogous palettes
4. **Accessibility Validation**: Check contrast ratios (if enabled)

### Output Generation
1. **Frame Creation**: Generate organized layout structure
2. **Color Application**: Apply colors to frames and shapes
3. **Style Creation**: Add colors to Figma's color styles panel
4. **Naming Convention**: Apply consistent, descriptive names

## Error Handling Patterns
- **Graceful Degradation**: Continue processing even if some images fail
- **User Feedback**: Clear error messages and recovery suggestions
- **Validation**: Input validation before processing begins
- **Recovery**: Ability to retry failed operations

## Configuration Patterns
- **User Preferences**: Remember settings between sessions
- **Default Values**: Sensible defaults for common use cases
- **Validation**: Ensure configuration values are within acceptable ranges
- **Persistence**: Save user preferences locally
