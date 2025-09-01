# 🎨 Palette Generator - Figma Plugin

A Figma plugin that automates the creation of systematic color palettes from moodboards and image collections, significantly reducing the time-consuming manual process of color abstraction and palette generation.

## ✨ Features

- **Automated Color Extraction**: Uses median cut algorithm with size-based weighting
- **Systematic Color Scales**: Generates Material Design-inspired 000-900 scales
- **Color Harmonies**: Auto-generates complementary, analogous, triadic, and split-complementary palettes
- **Accessibility Support**: Optional WCAG contrast checking
- **Professional Output**: Organized frames with auto-spacing and clear naming
- **Configurable**: Adjustable scale steps (5-13) and harmony types

## 🚀 Quick Start

### Prerequisites

- **Figma Desktop App**: Latest version required
- **Node.js**: Version 18+ 
- **npm**: Package manager

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "Figma Plugins/Palette Generator"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the plugin**:
   ```bash
   npm run build
   ```

4. **Set up in Figma**:
   - Open Figma Desktop App
   - Go to Plugins > Development > New Plugin
   - Choose "Import plugin from manifest"
   - Select the `manifest.json` file from this directory

## 🛠️ Development

### Project Structure

```
Palette Generator/
├── src/
│   └── code.ts          # Main plugin logic
├── ui.html              # Plugin interface
├── manifest.json        # Plugin configuration
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
├── .eslintrc.js         # Linting rules
└── README.md            # This file
```

### Available Scripts

- **`npm run build`**: Compile TypeScript to JavaScript
- **`npm run watch`**: Watch for changes and recompile
- **`npm run lint`**: Run ESLint for code quality
- **`npm run lint:fix`**: Fix auto-fixable linting issues

### Development Workflow

1. **Make changes** to `src/code.ts` or `ui.html`
2. **Build the plugin** with `npm run build`
3. **Reload the plugin** in Figma (right-click > Reload)
4. **Test your changes**

## 🎯 How It Works

### 1. Image Analysis
- Select a frame containing bitmap images
- Plugin analyzes all images with size-based weighting
- Larger images have more influence on the final palette

### 2. Color Extraction
- Uses median cut algorithm for efficient color quantization
- Extracts dominant colors representing primary, secondary, and tertiary
- Processes up to 10 images for optimal performance

### 3. Scale Generation
- Creates systematic color scales (000-900) for each primary color
- Uses HSL color space for predictable tint/shade generation
- Configurable scale granularity (5, 9, or 13 steps)

### 4. Harmony Creation
- Generates multiple color harmony types
- Side-by-side comparisons for immediate visual feedback
- Includes analogous, complementary, triadic, and split-complementary

### 5. Canvas Output
- Creates organized frames with auto-spacing
- Applies consistent naming convention
- Integrates with Figma's color styles panel

## 🔧 Configuration

### Plugin Settings

- **Color Scale Steps**: Choose between 5, 9, or 13 steps
- **WCAG Accessibility**: Toggle contrast checking on/off
- **Harmony Types**: Select which harmony combinations to generate

### Performance Targets

- **Image Analysis**: < 30 seconds for 10 images
- **Color Generation**: < 10 seconds
- **Canvas Output**: < 15 seconds
- **Total Workflow**: < 2 minutes

## 🎨 Output Structure

### Generated Layout

```
[Primary Scale] [Secondary Scale] [Tertiary Scale]
[Monotone Scale]

[Analogous Harmony] [Complementary Harmony]
[Triadic Harmony] [Split-Complementary Harmony]
```

### Naming Convention

- **Frames**: "Primary Color Scale", "Secondary Color Scale", etc.
- **Color Styles**: "Primary-500", "Primary-300", "Secondary-700", etc.
- **Clear, descriptive names** for easy navigation

## 🚧 Current Status

**Phase**: Development Environment Setup ✅
**Next**: Core Algorithm Implementation

### Completed
- ✅ Project structure and configuration
- ✅ TypeScript setup with Figma types
- ✅ ESLint configuration
- ✅ Basic plugin framework
- ✅ User interface design

### In Progress
- 🔄 Median cut algorithm implementation
- 🔄 Color scale generation system
- 🔄 Harmony calculation algorithms

### Planned
- [ ] Canvas output generation
- [ ] Frame organization and spacing
- [ ] Color style integration
- [ ] Accessibility features
- [ ] Testing and optimization

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Figma Plugin API** for the development platform
- **Material Design** for color scale inspiration
- **Color theory** principles for harmony generation
- **Open source community** for development tools and libraries

## 📞 Support

For questions, issues, or contributions:
- Create an issue in the repository
- Check the documentation
- Review the code examples

---

**Built with ❤️ for designers who value efficiency and creativity**
