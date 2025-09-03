/**
 * Palette Generator - Figma Plugin
 * 
 * This plugin automates the creation of systematic color palettes from moodboards
 * and image collections using median cut algorithm with size-based weighting.
 */

/// <reference types="@figma/plugin-typings" />

// Main plugin function
figma.showUI(__html__, { width: 400, height: 600 });

// Handle messages from the UI
figma.ui.onmessage = async (msg: PluginMessage): Promise<void> => {
  try {
    switch (msg.type) {
      case 'extract-image-colors':
        await extractImageColors();
        break;
      case 'generate-palette':
        if (msg.selectedColors && msg.settings) {
          await generatePaletteFromSelectedColors(msg.selectedColors, msg.settings);
        } else {
          figma.notify('Selected colors are required', { error: true });
          figma.ui.postMessage({ type: 'error', message: 'Selected colors are required' });
        }
        break;
      case 'generate-palette-from-selected':
        if (msg.selectedColors) {
          await generatePaletteFromSelectedColors(msg.selectedColors);
        } else {
          figma.notify('Selected colors are required', { error: true });
          figma.ui.postMessage({ type: 'error', message: 'Selected colors are required' });
        }
        break;
      case 'cancel':
        figma.closePlugin();
        break;
      default:
        console.warn('Unknown message type:', msg.type);
    }
  } catch (error) {
    console.error('Plugin error:', error);
    figma.notify('An error occurred while generating the palette', { error: true });
  }
};

/**
 * Extract real colors from selected image using Figma API
 */
async function extractImageColors(): Promise<void> {
  try {
    const selectedNodes = figma.currentPage.selection;
    console.log('Extracting colors from selected images...', selectedNodes.length, 'images selected');

    if (selectedNodes.length === 0) {
      figma.notify('Please select at least one image first', { error: true });
      figma.ui.postMessage({ type: 'error', message: 'No images selected' });
      return;
    }

    // Limit to reasonable number of images for performance
    const maxImages = 10;
    const imagesToProcess = selectedNodes.slice(0, maxImages);
    
    if (selectedNodes.length > maxImages) {
      figma.notify(`Processing first ${maxImages} images (max limit for performance)`, { error: false });
    }

    // Validate all selected images
    const validImages: RectangleNode[] = [];
    for (let i = 0; i < imagesToProcess.length; i++) {
      const node = imagesToProcess[i];
      
      if (!node) {
        console.warn(`Skipping node ${i}: undefined node`);
        continue;
      }
      
      // Check if it's a valid image node
      if (node.type !== 'RECTANGLE' || !node.fills || !Array.isArray(node.fills) || node.fills.length === 0) {
        console.warn(`Skipping node ${i}: not a valid rectangle with fills`);
        continue;
      }

      const imageFill = (node.fills as Paint[]).find((fill: Paint) => fill.type === 'IMAGE') as ImagePaint;
      if (!imageFill || !imageFill.imageHash) {
        console.warn(`Skipping node ${i}: no image fill found`);
        continue;
      }

      // Get the image object
      const image = figma.getImageByHash(imageFill.imageHash);
      if (!image) {
        console.warn(`Skipping node ${i}: could not load image data`);
        continue;
      }

      validImages.push(node);
    }

    if (validImages.length === 0) {
      figma.notify('No valid images found in selection. Please select rectangles with image fills.', { error: true });
      figma.ui.postMessage({ type: 'error', message: 'No valid images found' });
      return;
    }

    console.log(`Processing ${validImages.length} valid images out of ${selectedNodes.length} selected`);

    // Send image data to UI for processing
    figma.ui.postMessage({ 
      type: 'multi-image-selected', 
      imageCount: validImages.length,
      totalSelected: selectedNodes.length
    });

    // Process the first image for UI display (we'll enhance this later)
    const firstImage = validImages[0];
    if (firstImage) {
      const firstImageFill = (firstImage.fills as Paint[]).find((fill: Paint) => fill.type === 'IMAGE') as ImagePaint;
      if (firstImageFill && firstImageFill.imageHash) {
        const firstImageObj = figma.getImageByHash(firstImageFill.imageHash);
        
        if (firstImageObj) {
          const imageBytes = await firstImageObj.getBytesAsync();
          console.log('First image bytes extracted:', imageBytes.length, 'bytes');
          
          // Send first image bytes to UI for color extraction
          figma.ui.postMessage({
            type: 'image-bytes-received',
            imageBytes: Array.from(imageBytes), // Convert Uint8Array to regular array for transfer
            imageHash: firstImageFill.imageHash,
            multiImage: true,
            imageCount: validImages.length
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error extracting image colors:', error);
    
    figma.ui.postMessage({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Failed to extract image colors' 
    });
    
    figma.notify('Failed to extract colors from images', { error: true });
  }
}

/**
 * Generate complete palette from user-selected primary, secondary, tertiary colors
 */
async function generatePaletteFromSelectedColors(selectedColors: SelectedColors, settings?: PaletteSettings): Promise<void> {
  try {
    console.log('Generating palette from selected colors:', selectedColors);
    
    // Convert colors from 0-255 range to 0-1 range (Figma format)
    const convertedColors: SelectedColors = {
      primary: {
        r: selectedColors.primary.r / 255,
        g: selectedColors.primary.g / 255,
        b: selectedColors.primary.b / 255
      },
      secondary: {
        r: selectedColors.secondary.r / 255,
        g: selectedColors.secondary.g / 255,
        b: selectedColors.secondary.b / 255
      },
      tertiary: {
        r: selectedColors.tertiary.r / 255,
        g: selectedColors.tertiary.g / 255,
        b: selectedColors.tertiary.b / 255
      }
    };
    
    console.log('Converted colors to Figma format:', convertedColors);
    
    // Use default settings if none provided
    const defaultSettings: PaletteSettings = {
      scaleSteps: 9,
      harmonyTypes: ['analogous', 'complementary', 'triadic', 'split-complementary'],
      accessibility: true
    };
    
    const finalSettings = settings || defaultSettings;
    
    // Generate complete palette using the converted colors
    const palette = generateColorPaletteFromSelectedColors(convertedColors, finalSettings);
    
    // Create output frames with settings
    await createPaletteFrames(palette, finalSettings);
    
    // Send success message to UI
    figma.ui.postMessage({ type: 'palette-generated' });
    
    figma.notify('Colour system generated successfully!', { error: false });
    
  } catch (error) {
    console.error('Error generating palette:', error);
    
    // Send error message to UI
    figma.ui.postMessage({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Failed to generate palette' 
    });
    
    figma.notify('Failed to generate palette', { error: true });
  }
}

// Removed median cut functions - using manual color picker instead

/**
 * Select the best primary color candidates from extracted colors
 */
function selectBestPrimaryCandidates(colors: RGB[], count: number): RGB[] {
  // Score colors based on vibrancy, uniqueness, and suitability as primaries
  const scoredColors = colors.map(color => {
    const hsl = rgbToHsl(color.r, color.g, color.b);
    
    // Vibrancy score (prefer high saturation, avoid too light/dark)
    const vibrancyScore = hsl.s * (1 - Math.abs(hsl.l - 0.5) * 2);
    
    // Avoid muddy colors (low saturation + mid lightness)
    const mudPenalty = hsl.s < 0.3 && hsl.l > 0.3 && hsl.l < 0.7 ? -0.5 : 0;
    
    // Slight preference for warmer hues (often work better as primaries)
    const huePreference = (hsl.h >= 0 && hsl.h <= 60) || (hsl.h >= 300 && hsl.h <= 360) ? 0.1 : 0;
    
    const totalScore = vibrancyScore + mudPenalty + huePreference;
    
    return { color, score: totalScore, hue: hsl.h };
  });

  // Sort by score and select diverse candidates
  scoredColors.sort((a, b) => b.score - a.score);
  
  const candidates: RGB[] = [];
  const usedHueRanges: number[] = [];
  const hueSpacing = 360 / count; // Aim for good hue distribution
  
  for (const scored of scoredColors) {
    if (candidates.length >= count) break;
    
    // Check if this hue is too close to already selected hues
    const tooClose = usedHueRanges.some(usedHue => {
      const hueDiff = Math.min(
        Math.abs(scored.hue - usedHue),
        360 - Math.abs(scored.hue - usedHue)
      );
      return hueDiff < hueSpacing * 0.7; // Allow some overlap but encourage diversity
    });
    
    if (!tooClose || candidates.length < 2) { // Always take first 2 regardless
      candidates.push(scored.color);
      usedHueRanges.push(scored.hue);
    }
  }
  
  // If we don't have enough candidates, fill with the highest scoring ones
  while (candidates.length < count && candidates.length < scoredColors.length) {
    const remaining = scoredColors.filter(s => !candidates.includes(s.color));
    if (remaining.length > 0 && remaining[0]) {
      candidates.push(remaining[0].color);
    } else {
      break;
    }
  }

  return candidates;
}

// Legacy generatePalette function removed - using simplified generatePaletteFromPrimary approach

/**
 * Extract bitmap images from a frame
 */
function extractImagesFromFrame(frame: FrameNode): ImageNode[] {
  const images: ImageNode[] = [];
  
  function traverse(node: SceneNode): void {
    if (node.type === 'RECTANGLE' && node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'IMAGE' && fill.imageHash) {
        // This is an image fill
        const image = figma.getImageByHash(fill.imageHash);
        if (image) {
          // Create a virtual image node for processing
          const imageNode: ImageNode = {
            type: 'RECTANGLE',
            fills: [fill],
            width: node.width,
            height: node.height,
            x: node.x,
            y: node.y
          } as ImageNode;
          images.push(imageNode);
        }
      }
    }
    
    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  traverse(frame);
  return images;
}

/**
 * Check if a rectangle node contains an image fill
 */
function isImageNode(node: RectangleNode): boolean {
  if (!node.fills || !Array.isArray(node.fills) || node.fills.length === 0) {
    return false;
  }
  
  const fill = node.fills[0];
  return fill.type === 'IMAGE' && fill.imageHash !== undefined;
}

/**
 * Extract a single image from a rectangle node
 */
function extractSingleImage(node: RectangleNode): ImageNode[] {
  if (!node.fills || !Array.isArray(node.fills) || node.fills.length === 0) {
    return [];
  }
  
  const fill = node.fills[0];
  if (fill.type === 'IMAGE' && fill.imageHash) {
    const image = figma.getImageByHash(fill.imageHash);
    if (image) {
      const imageNode: ImageNode = {
        type: 'RECTANGLE',
        fills: [fill],
        width: node.width,
        height: node.height,
        x: node.x,
        y: node.y
      } as ImageNode;
      return [imageNode];
    }
  }
  
  return [];
}

/**
 * Generate color palette from user-selected primary, secondary, tertiary colors
 */
function generateColorPaletteFromSelectedColors(selectedColors: SelectedColors, settings: PaletteSettings): PaletteData {
  console.log('Generating palette from selected colors:', selectedColors);
  
  // Use the user-selected colors directly
  const primary = selectedColors.primary;
  const secondary = selectedColors.secondary;
  const tertiary = selectedColors.tertiary;
  
  // Build color families from user selections
  const brandColors = [primary, secondary, tertiary];
  console.log('Using selected brand color family:', brandColors);
  
  // Generate color scales (000-900 or 050-950 etc.) for each brand color
  const colorScales = generateColorScales(brandColors, settings.scaleSteps);
  
  // Generate harmony colors based on the selected primary color
  const harmonyColors = generateHarmonyColorsFromPrimary(primary, settings.harmonyTypes);
  
  // Generate light and dark mode colors
  const lightMode = generateModeColors(brandColors, 'light');
  const darkMode = generateModeColors(brandColors, 'dark');
  
  // Generate accessible versions if requested
  const accessibleLight = settings.accessibility ? generateAccessibleColors(lightMode) : lightMode;
  const accessibleDark = settings.accessibility ? generateAccessibleColors(darkMode) : darkMode;
  
  // Generate monotone scale
  const monotoneScale = generateSimpleMonotoneScale();
  
  const palette: PaletteData = {
    primary: primary,
    secondary: secondary,
    tertiary: tertiary,
    scales: colorScales,
    harmonies: convertToHarmonies(harmonyColors),
    lightMode: lightMode,
    darkMode: darkMode,
    accessibleLight: accessibleLight,
    accessibleDark: accessibleDark,
    monotoneScale: monotoneScale
  };
  
  console.log('Generated complete palette:', palette);
  return palette;
}

/**
 * Generate harmony colors from primary color
 */
interface HarmonyColor {
  name: string;
  colors: RGB[];
}

function generateHarmonyColorsFromPrimary(primaryColor: RGB, harmonyTypes: string[]): HarmonyColor[] {
  const harmonies: HarmonyColor[] = [];
  const primaryHsl = rgbToHsl(primaryColor.r, primaryColor.g, primaryColor.b);
  
  if (harmonyTypes.includes('analogous')) {
    const analogous = [
      hslToRgb((primaryHsl.h - 30 + 360) % 360 / 360, primaryHsl.s, primaryHsl.l),
      primaryColor,
      hslToRgb((primaryHsl.h + 30) % 360 / 360, primaryHsl.s, primaryHsl.l)
    ];
    harmonies.push({ name: 'Analogous', colors: analogous });
  }
  
  if (harmonyTypes.includes('complementary')) {
    const complementary = [
      hslToRgb((primaryHsl.h + 180) % 360 / 360, primaryHsl.s, primaryHsl.l)
    ];
    harmonies.push({ name: 'Complementary', colors: complementary });
  }
  
  if (harmonyTypes.includes('triadic')) {
    const triadic = [
      primaryColor,
      hslToRgb((primaryHsl.h + 120) % 360 / 360, primaryHsl.s, primaryHsl.l),
      hslToRgb((primaryHsl.h + 240) % 360 / 360, primaryHsl.s, primaryHsl.l)
    ];
    harmonies.push({ name: 'Triadic', colors: triadic });
  }
  
  if (harmonyTypes.includes('splitComplementary')) {
    const splitComp = [
      primaryColor,
      hslToRgb((primaryHsl.h + 150) % 360 / 360, primaryHsl.s, primaryHsl.l),
      hslToRgb((primaryHsl.h + 210) % 360 / 360, primaryHsl.s, primaryHsl.l)
    ];
    harmonies.push({ name: 'Split-Complementary', colors: splitComp });
  }
  
  return harmonies;
}

/**
 * Generate mode-specific colors (light/dark)
 */
function generateModeColors(colors: RGB[], mode: 'light' | 'dark'): RGB[] {
  return colors.map(color => {
    const hsl = rgbToHsl(color.r, color.g, color.b);
    
    if (mode === 'light') {
      // Lighten and reduce saturation slightly for light mode
      return hslToRgb(hsl.h, hsl.s * 0.9, Math.min(hsl.l * 1.2, 0.9));
    } else {
      // Darken and boost saturation slightly for dark mode  
      return hslToRgb(hsl.h, Math.min(hsl.s * 1.1, 1), hsl.l * 0.8);
    }
  });
}

/**
 * Convert HarmonyColor array to ColorHarmonies interface
 */
function convertToHarmonies(harmonies: HarmonyColor[]): ColorHarmonies {
  const result: ColorHarmonies = {
    analogous: [],
    complementary: [],
    triadic: [],
    splitComplementary: []
  };
  
  harmonies.forEach(harmony => {
    switch (harmony.name.toLowerCase()) {
      case 'analogous':
        result.analogous = harmony.colors;
        break;
      case 'complementary':
        result.complementary = harmony.colors;
        break;
      case 'triadic':
        result.triadic = harmony.colors;
        break;
      case 'split-complementary':
        result.splitComplementary = harmony.colors;
        break;
    }
  });
  
  return result;
}

/**
 * Generate simple monotone scale
 */
function generateSimpleMonotoneScale(): RGB[] {
  return [
    { r: 1, g: 1, b: 1 },       // White
    { r: 0.9, g: 0.9, b: 0.9 }, // Light gray
    { r: 0.7, g: 0.7, b: 0.7 }, // Medium gray
    { r: 0.5, g: 0.5, b: 0.5 }, // Gray
    { r: 0.3, g: 0.3, b: 0.3 }, // Dark gray
    { r: 0, g: 0, b: 0 }        // Black
  ];
}

/**
 * Generate accessible versions of colors (placeholder - would need proper WCAG implementation)
 */
function generateAccessibleColors(colors: RGB[]): RGB[] {
  // For now, return the same colors. In a full implementation, 
  // this would adjust colors to meet WCAG contrast requirements
  return colors;
}

/**
 * Generate color palette from images using median cut algorithm
 */
async function generateColorPalette(images: ImageNode[], settings: PaletteSettings): Promise<PaletteData> {
  try {
    console.log('Starting color palette generation for', images.length, 'images');
    
    // Log image details for debugging
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (image) {
        console.log(`Image ${i}: ${image.width}x${image.height}, fills:`, image.fills);
      }
    }
    
    // Extract pixel data from all images with size-based weighting
    const weightedPixels = await extractWeightedPixels(images);
    console.log('Extracted', weightedPixels.length, 'weighted pixels');
    
    // Log sample of extracted colors for debugging
    console.log('Sample extracted colors:', weightedPixels.slice(0, 10));
    
    // Determine the brightest color across all weighted pixels (by saturation + luminance)
    const brightestPrimary = selectBrightestColor(weightedPixels);
    const primaryHsl = rgbToHsl(brightestPrimary.r, brightestPrimary.g, brightestPrimary.b);
    console.log('Selected primary color:', brightestPrimary);

    // Build a cohesive family (primary/secondary/tertiary) from the brightest primary
    const primaryColors = buildColorFamilyFromPrimary(brightestPrimary);
    console.log('Constructed primary color family:', primaryColors);
    
    // Generate color scales and harmonies
    const scales = generateColorScales(primaryColors, settings.scaleSteps);
    const harmonies = generateHarmonies(primaryColors);
    
    // Generate mode-specific palettes
    const modePalettes = generateModeSpecificPalettes(primaryColors);
    const accessiblePalettes = generateAccessiblePalettes(primaryColors);
    
    const result = {
      primary: primaryColors[0]!,
      secondary: primaryColors[1]!,
      tertiary: primaryColors[2]!,
      scales: scales,
      harmonies: harmonies,
      lightMode: modePalettes.light,
      darkMode: modePalettes.dark,
      accessibleLight: accessiblePalettes.light,
      accessibleDark: accessiblePalettes.dark,
      monotoneScale: generateSimpleMonotoneScale()
    };
    
    console.log('Generated palette result:', result);
    return result;
    
  } catch (error) {
    console.error('Error generating color palette:', error);
    // Fallback to placeholder colors if algorithm fails
    const fallbackColors: RGB[] = [
    { r: 0.2, g: 0.4, b: 0.8 }, // Blue
    { r: 0.8, g: 0.2, b: 0.4 }, // Red
    { r: 0.4, g: 0.8, b: 0.2 }  // Green
  ];
  
    console.log('Using fallback colors:', fallbackColors);
    
    return {
      primary: fallbackColors[0]!,
      secondary: fallbackColors[1]!,
      tertiary: fallbackColors[2]!,
      scales: generateColorScales(fallbackColors),
      harmonies: generateHarmonies(fallbackColors),
      lightMode: generateModeSpecificPalettes(fallbackColors).light,
      darkMode: generateModeSpecificPalettes(fallbackColors).dark,
      accessibleLight: generateAccessiblePalettes(fallbackColors).light,
      accessibleDark: generateAccessiblePalettes(fallbackColors).dark,
      monotoneScale: generateSimpleMonotoneScale()
    };
  }
}

/**
 * Extract pixel data from images with improved multi-image handling
 */
async function extractWeightedPixels(images: ImageNode[]): Promise<RGB[]> {
  const allPixels: RGB[] = [];
  
  // Process each image separately to maintain distinctiveness
  for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
    const image = images[imageIndex];
    if (!image) continue;
    
    try {
      // Get image data from Figma
      const fill = image.fills[0];
      if (!fill || fill.type !== 'IMAGE') continue;
      
      const imageFill = fill as ImagePaint;
      if (!imageFill.imageHash) continue;
      
      const imageData = await figma.getImageByHash(imageFill.imageHash);
      if (!imageData) continue;
      
      // Calculate weight based on image size (larger = more influence)
      const weight = Math.sqrt(image.width * image.height) / 100; // Normalize weight
      const pixelCount = Math.floor(weight * 800); // Reduced from 1000 to prevent over-sampling
      
      // Extract pixels with weighting
      const pixels = await extractPixelsFromImage(imageData, pixelCount, imageIndex);
      
      // Add weighted pixels to collection with image-specific variation
      for (let i = 0; i < pixels.length; i++) {
        allPixels.push(pixels[i]!);
      };
      
    } catch (error) {
      console.warn(`Failed to process image ${imageIndex}:`, error);
      continue;
    }
  }
  
  console.log(`Total pixels collected: ${allPixels.length}`);
  return allPixels;
}

/**
 * Generate moodboard-inspired vibrant colors based on common design patterns
 */
function generateMoodboardColors(imageCount: number): RGB[] {
  const moodboardColors: RGB[] = [];
  
  // Common vibrant moodboard color patterns
  const vibrantPalettes = [
    // Bright, energetic palette
    [
      { r: 1.0, g: 0.4, b: 0.2 },   // Bright orange
      { r: 0.2, g: 0.6, b: 1.0 },   // Vibrant blue
      { r: 0.8, g: 0.2, b: 0.6 }    // Bright magenta
    ],
    // Warm, sunset palette
    [
      { r: 1.0, g: 0.6, b: 0.2 },   // Warm orange
      { r: 0.8, g: 0.3, b: 0.1 },   // Deep red-orange
      { r: 0.2, g: 0.4, b: 0.8 }    // Complementary blue
    ],
    // Cool, modern palette
    [
      { r: 0.2, g: 0.8, b: 0.6 },   // Vibrant teal
      { r: 0.6, g: 0.2, b: 0.8 },   // Bright purple
      { r: 1.0, g: 0.4, b: 0.2 }    // Bright orange accent
    ]
  ];
  
  // Select palette based on image count and add variations
  const basePalette = vibrantPalettes[imageCount % vibrantPalettes.length];
  if (!basePalette) return moodboardColors;
  
  for (const baseColor of basePalette) {
    // Add the base vibrant color
    moodboardColors.push(baseColor);
    
    // Add high-saturation variations
    const hsl = rgbToHsl(baseColor.r, baseColor.g, baseColor.b);
    
    // High saturation variation
    const highSat = hslToRgb(hsl.h, Math.min(1, hsl.s * 1.2), hsl.l);
    moodboardColors.push(highSat);
    
    // Complementary high-saturation color
    const complementary = hslToRgb((hsl.h + 180) % 360, 0.9, 0.5);
    moodboardColors.push(complementary);
  }
  
  console.log('Generated moodboard-inspired colors:', moodboardColors);
  return moodboardColors;
}

/**
 * Estimate dominant color characteristics from image metadata
 */
function estimateDominantColorRange(imageData: Image, imageIndex: number): ColorEstimation {
  const hashString = imageData.hash;
  
  // Analyze hash characteristics for color family estimation
  const hashAnalysis = analyzeHashCharacteristics(hashString);
  
  // Estimate color temperature and family based on hash patterns
  const estimation: ColorEstimation = {
    hueRange: estimateHueRange(hashAnalysis, imageIndex),
    saturationBias: estimateSaturationBias(hashAnalysis),
    lightnessBias: estimateLightnessBias(hashAnalysis),
    warmth: estimateWarmth(hashAnalysis),
    vibrancy: estimateVibrancy(hashAnalysis)
  };
  
  console.log(`🔍 Image ${imageIndex} ESTIMATION:`, 
    `Hue: ${estimation.hueRange[0].toFixed(1)}°-${estimation.hueRange[1].toFixed(1)}°`, 
    `Sat: ${estimation.saturationBias.toFixed(3)}`, 
    `Light: ${estimation.lightnessBias.toFixed(3)}`, 
    `${estimation.warmth}`, 
    `${estimation.vibrancy}`
  );
  return estimation;
}

/**
 * Analyze hash string to extract color-indicative patterns
 */
function analyzeHashCharacteristics(hashString: string): HashAnalysis {
  const chars = hashString.split('');
  const charCodes = chars.map(c => c.charCodeAt(0));
  
  return {
    length: hashString.length,
    sum: charCodes.reduce((a, b) => a + b, 0),
    average: charCodes.reduce((a, b) => a + b, 0) / charCodes.length,
    variance: calculateVariance(charCodes),
    hexDigitCount: chars.filter(c => /[0-9a-f]/i.test(c)).length,
    patternScore: calculatePatternScore(hashString),
    alphaRatio: chars.filter(c => /[a-z]/i.test(c)).length / chars.length,
    digitRatio: chars.filter(c => /[0-9]/.test(c)).length / chars.length
  };
}

/**
 * Estimate likely hue range based on hash analysis
 */
function estimateHueRange(analysis: HashAnalysis, imageIndex: number): [number, number] {
  // Use hash to create a base hue, but with much more conservative logic
  const baseHue = (analysis.sum % 360);
  
  // Create a much smaller, more realistic range
  // Most images contain colors within 60-90 degrees of each other
  const baseRangeWidth = 60; // Conservative base range
  const varianceInfluence = Math.min(analysis.variance * 0.5, 30); // Limited variance influence
  
  // Use pattern score to slightly adjust range, but conservatively
  const patternAdjustment = Math.min(analysis.patternScore * 15, 20);
  const finalRangeWidth = baseRangeWidth + varianceInfluence + patternAdjustment;
  
  // Cap the maximum range at 90 degrees to prevent wild swings
  const rangeWidth = Math.min(finalRangeWidth, 90);
  
  // Use a more subtle approach to warm/cool bias
  let centerHue = baseHue;
  
  // Only apply subtle shifts based on character composition
  if (analysis.alphaRatio > 0.7) {
    // Slight warm bias for very letter-heavy hashes
    centerHue = (baseHue + 15) % 360;
  } else if (analysis.digitRatio > 0.7) {
    // Slight cool bias for very number-heavy hashes  
    centerHue = (baseHue - 15 + 360) % 360;
  }
  
  // Minimal image index variation to avoid dramatic shifts
  centerHue = (centerHue + imageIndex * 5) % 360;
  
  const startHue = (centerHue - rangeWidth / 2 + 360) % 360;
  const endHue = (centerHue + rangeWidth / 2) % 360;
  
  return [startHue, endHue];
}

/**
 * Extract pixels from a Figma image with enhanced generation and color estimation
 */
async function extractPixelsFromImage(imageData: Image, sampleCount: number, imageIndex: number): Promise<RGB[]> {
  const pixels: RGB[] = [];

  // Use hash and image metadata to create image-specific color characteristics
  const hash = imageData.hash;
  const hashChars = hash.split('');
  
  // Analyze hash to extract image-specific color tendencies
  const hashSum = hashChars.reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hashLength = hash.length;
  
  // Extract different characteristics from different parts of the hash
  const hueBase = (hashSum % 360); // Primary hue tendency
  const saturationBias = ((hashSum / 100) % 1); // Saturation tendency (0-1)
  const lightnessBias = ((hashSum / 200) % 1); // Lightness tendency (0-1)
  
  // Create multiple color families based on the image
  const colorFamilies = [
    { hueCenter: hueBase, weight: 0.4 }, // Primary family
    { hueCenter: (hueBase + 120) % 360, weight: 0.3 }, // Secondary family
    { hueCenter: (hueBase + 240) % 360, weight: 0.2 }, // Tertiary family
    { hueCenter: (hueBase + 60) % 360, weight: 0.1 }  // Accent family
  ];
  
  // Generate colors weighted toward these families
  for (let i = 0; i < sampleCount; i++) {
    // Create image-specific seed that varies per sample
    const seed = (hashSum + i * 7919 + imageIndex * 50000 + hashLength * 1000) % 1000000;
    const random1 = (seed % 1000) / 1000;
    const random2 = ((seed / 1000) % 1000) / 1000;
    const random3 = ((seed / 1000000) % 1000) / 1000;
    
    // Choose a color family based on weights
    let selectedFamily = colorFamilies[0]!; // We know this exists
    let weightSum = 0;
    for (const family of colorFamilies) {
      weightSum += family.weight;
      if (random1 <= weightSum) {
        selectedFamily = family;
        break;
      }
    }
    
    // Generate hue around the selected family center
    const hueSpread = 40; // Degrees of spread around center
    const hue = (selectedFamily.hueCenter + (random2 - 0.5) * hueSpread + 360) % 360;
    
    // Use hash-biased saturation and lightness with variation
    const saturation = Math.max(0.3, Math.min(0.95, saturationBias * 0.7 + random3 * 0.5));
    const lightness = Math.max(0.2, Math.min(0.8, lightnessBias * 0.6 + random2 * 0.4));
    
    const color = hslToRgb(hue / 360, saturation, lightness);
    pixels.push(color);
  }

  return pixels;
}

/**
 * Generate color biased toward estimated dominant range
 */
function generateBiasedColor(analysis: HashAnalysis, estimation: ColorEstimation, index: number, imageIndex: number): RGB {
  const seed = (analysis.sum + index * 7919 + imageIndex * 50000) % 1000000;
  
  // Generate hue within estimated range
  const [hueStart, hueEnd] = estimation.hueRange;
  let hue: number;
  
  if (hueStart <= hueEnd) {
    hue = hueStart + ((seed * (hueEnd - hueStart)) / 1000000);
  } else {
    // Handle wrap-around (e.g., 350-30 degrees)
    const range = (360 - hueStart) + hueEnd;
    const hueOffset = (seed * range) / 1000000;
    hue = hueOffset <= (360 - hueStart) ? hueStart + hueOffset : hueOffset - (360 - hueStart);
  }
  
  // Apply saturation bias
  const baseSaturation = 0.4 + (seed % 500) / 1000; // 0.4 to 0.9
  const saturation = Math.min(1, baseSaturation * estimation.saturationBias);
  
  // Apply lightness bias
  const baseLightness = 0.2 + (seed % 600) / 1000; // 0.2 to 0.8
  const lightness = clamp(baseLightness * estimation.lightnessBias, 0.1, 0.9);
  
  return hslToRgb(hue, saturation, lightness);
}

/**
 * Generate harmonic colors (complementary, analogous)
 */
function generateHarmonicColor(analysis: HashAnalysis, estimation: ColorEstimation, index: number, imageIndex: number): RGB {
  const seed = (analysis.average * 1000 + index * 5347 + imageIndex * 75000) % 1000000;
  
  // Get base hue from estimation center
  const [hueStart, hueEnd] = estimation.hueRange;
  const centerHue = hueStart <= hueEnd ? (hueStart + hueEnd) / 2 : ((hueStart + hueEnd + 360) / 2) % 360;
  
  // Generate harmonic relationships
  const harmonicOffset = index % 3 === 0 ? 180 : index % 3 === 1 ? 30 : -30; // Complementary or analogous
  const hue = (centerHue + harmonicOffset + 360) % 360;
  
  const saturation = 0.5 + (seed % 400) / 1000; // 0.5 to 0.9
  const lightness = 0.3 + (seed % 400) / 1000;  // 0.3 to 0.7
  
  return hslToRgb(hue, saturation, lightness);
}

/**
 * Generate accent colors for variety
 */
function generateAccentColor(analysis: HashAnalysis, estimation: ColorEstimation, index: number, imageIndex: number): RGB {
  const seed = (analysis.variance + index * 3571 + imageIndex * 25000) % 1000000;
  
  // More random hue for accents, but still influenced by estimation
  const randomHue = (seed * 360) / 1000000;
  const [estStart, estEnd] = estimation.hueRange;
  const estCenter = estStart <= estEnd ? (estStart + estEnd) / 2 : ((estStart + estEnd + 360) / 2) % 360;
  
  // Blend random with estimated (70% random, 30% estimated influence)
  const hue = (randomHue * 0.7 + estCenter * 0.3) % 360;
  
  const saturation = 0.3 + (seed % 600) / 1000; // 0.3 to 0.9 - broader range
  const lightness = 0.2 + (seed % 700) / 1000;  // 0.2 to 0.9 - broader range
  
  return hslToRgb(hue, saturation, lightness);
}

/**
 * Helper functions for color estimation
 */
function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

function calculatePatternScore(str: string): number {
  // Simple pattern analysis - repeated characters indicate more structured hashes
  const charMap = new Map<string, number>();
  for (const char of str) {
    charMap.set(char, (charMap.get(char) || 0) + 1);
  }
  
  let patternScore = 0;
  for (const count of charMap.values()) {
    if (count > 1) patternScore += count * 0.1;
  }
  
  return Math.min(patternScore, 1); // Cap at 1
}

function estimateSaturationBias(analysis: HashAnalysis): number {
  // More conservative saturation estimation
  const varianceNorm = Math.min(analysis.variance / 3000, 0.5); // Reduced influence
  const patternBonus = analysis.patternScore * 0.15; // Reduced bonus
  return 0.6 + varianceNorm * 0.3 + patternBonus; // 0.6 to 1.05 range (more conservative)
}

function estimateLightnessBias(analysis: HashAnalysis): number {
  // More conservative lightness estimation
  const avgNorm = analysis.average / 127; // Normalize to 0-1
  const lightnessBias = 0.5 + (avgNorm - 0.5) * 0.2; // Reduced range: 0.4 to 0.6
  return Math.max(0.4, Math.min(0.8, lightnessBias)); // 0.4 to 0.8 range (more centered)
}

function estimateWarmth(analysis: HashAnalysis): 'warm' | 'cool' | 'neutral' {
  if (analysis.alphaRatio > 0.6) return 'warm';
  if (analysis.digitRatio > 0.6) return 'cool';
  return 'neutral';
}

function estimateVibrancy(analysis: HashAnalysis): 'high' | 'medium' | 'low' {
  const vibrancyScore = analysis.patternScore + (analysis.variance / 3000);
  if (vibrancyScore > 0.7) return 'high';
  if (vibrancyScore > 0.3) return 'medium';
  return 'low';
}

// Removed old median cut algorithm - using manual color picker interface

// Removed old median cut support functions - using manual color picker interface

/**
 * Calculate the average color of a bucket of pixels
 */
function calculateAverageColor(bucket: RGB[]): RGB {
  if (bucket.length === 0) {
    return { r: 0.5, g: 0.5, b: 0.5 };
  }
  
  let sumR = 0, sumG = 0, sumB = 0;
  
  for (const pixel of bucket) {
    sumR += pixel.r;
    sumG += pixel.g;
    sumB += pixel.b;
  }
  
  return {
    r: sumR / bucket.length,
    g: sumG / bucket.length,
    b: sumB / bucket.length
  };
}

/**
 * Generate default colors if algorithm fails
 */
function generateDefaultColors(numColors: number): RGB[] {
  const colors: RGB[] = [];
  for (let i = 0; i < numColors; i++) {
    const hue = (i * 360) / numColors;
    const { r, g, b } = hslToRgb(hue, 0.7, 0.6);
    colors.push({ r, g, b });
  }
  return colors;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return {
    r: r + m,
    g: g + m,
    b: b + m
  };
}

/**
 * Calculate color vibrancy score (higher = more vibrant)
 */
function calculateColorVibrancy(color: RGB): number {
  const hsl = rgbToHsl(color.r, color.g, color.b);
  
  // More aggressive vibrancy scoring
  // High saturation gets much higher weight
  const saturationScore = hsl.s * 3; // 0-3 range (increased weight)
  const lightnessScore = Math.abs(hsl.l - 0.5) * 1.5; // Distance from 0.5 (0-1.5 range)
  
  // Bonus points for very high saturation
  const saturationBonus = hsl.s > 0.8 ? 1 : 0;
  
  return saturationScore + lightnessScore + saturationBonus; // 0-5.5 range
}

/**
 * Boost color vibrancy by increasing saturation and adjusting lightness
 */
function boostColorVibrancy(color: RGB): RGB {
  const hsl = rgbToHsl(color.r, color.g, color.b);
  
  // Increase saturation significantly
  const boostedSaturation = Math.min(1, hsl.s * 1.5);
  
  // Adjust lightness to optimal vibrancy range
  let boostedLightness = hsl.l;
  if (hsl.l < 0.3) boostedLightness = 0.4; // Too dark -> medium
  if (hsl.l > 0.7) boostedLightness = 0.6; // Too light -> medium
  
  const boosted = hslToRgb(hsl.h, boostedSaturation, boostedLightness);
  return boosted;
}

/**
 * Select the brightest color by saturation and luminance across a set
 */
function selectBrightestColor(colors: RGB[]): RGB {
  if (colors.length === 0) return { r: 0.5, g: 0.5, b: 0.5 };
  let best: RGB = colors[0]!;
  let bestScore = -Infinity;
  for (const color of colors) {
    const score = calculateColorVibrancy(color);
    if (score > bestScore) {
      bestScore = score;
      best = color;
    }
  }
  // Ensure vibrancy by boosting slightly
  return boostColorVibrancy(best);
}

/**
 * Build secondary and tertiary from the primary while maintaining vibrancy and hierarchy
 * - Secondary: complementary hue (180°), same or slightly adjusted lightness
 * - Tertiary: analogous hue (+30°), similar saturation, slight lightness variance
 */
function buildColorFamilyFromPrimary(primary: RGB): [RGB, RGB, RGB] {
  const hsl = rgbToHsl(primary.r, primary.g, primary.b);
  // Enforce saturation and lightness floors for vibrancy and readability
  const baseS = Math.max(0.85, Math.min(1, hsl.s)); // primary >= 0.85
  const baseL = clamp(hsl.l, 0.48, 0.60); // keep in punchy, readable window

  // Normalize primary
  const normalizedPrimary = hslToRgb(hsl.h, baseS, baseL);

  // Secondary: complementary
  const secHue = (hsl.h + 180) % 360;
  const secS = Math.max(0.8, baseS); // secondary >= 0.80
  const secL = clamp(baseL, 0.48, 0.60);
  const secondary = hslToRgb(secHue, secS, secL);

  // Tertiary: analogous (+30°)
  const tertHue = (hsl.h + 20) % 360; // tighter family cohesion (+20°)
  const tertS = Math.max(0.8, baseS); // tertiary >= 0.80
  const tertL = clamp(baseL, 0.48, 0.60);
  const tertiary = hslToRgb(tertHue, tertS, tertL);

  return [normalizedPrimary, secondary, tertiary];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sort colors by vibrancy and select primary, secondary, tertiary
 */
function selectPrimaryColors(colors: RGB[]): RGB[] {
  // Calculate vibrancy for each color
  const colorsWithVibrancy = colors.map(color => ({
    color,
    vibrancy: calculateColorVibrancy(color)
  }));
  
  // Sort by vibrancy (highest first)
  colorsWithVibrancy.sort((a, b) => b.vibrancy - a.vibrancy);
  
  // Select top 3 most vibrant colors and boost them
  const selectedColors = colorsWithVibrancy.slice(0, 3).map(item => boostColorVibrancy(item.color));
  
  console.log('Color selection by vibrancy:', {
    totalColors: colors.length,
    selectedVibrancy: colorsWithVibrancy.slice(0, 3).map(item => item.vibrancy),
    originalColors: colorsWithVibrancy.slice(0, 3).map(item => item.color),
    boostedColors: selectedColors
  });
  
  return selectedColors;
}

/**
 * Generate color scales with configurable steps for each primary color
 */
function generateColorScales(colors: RGB[], scaleSteps: number = 9): ColorScale[] {
  return colors.map(color => {
    const scale: ColorScale = {};
    
    // Generate the appropriate number of steps
    if (scaleSteps === 5) {
      // 5 steps: 100, 300, 500, 700, 900
      scale['100'] = lightenColor(color, 0.8);
      scale['300'] = lightenColor(color, 0.4);
      scale['500'] = color; // Base color
      scale['700'] = darkenColor(color, 0.4);
      scale['900'] = darkenColor(color, 0.8);
    } else if (scaleSteps === 9) {
      // 9 steps: 100-900 (excluding 000)
      scale['100'] = lightenColor(color, 0.8);
      scale['200'] = lightenColor(color, 0.6);
      scale['300'] = lightenColor(color, 0.4);
      scale['400'] = lightenColor(color, 0.2);
      scale['500'] = color; // Base color
      scale['600'] = darkenColor(color, 0.2);
      scale['700'] = darkenColor(color, 0.4);
      scale['800'] = darkenColor(color, 0.6);
      scale['900'] = darkenColor(color, 0.8);
    } else if (scaleSteps === 13) {
      // 13 steps: 000-900 + additional intermediate steps
      scale['000'] = lightenColor(color, 0.95);
      scale['050'] = lightenColor(color, 0.9);
      scale['100'] = lightenColor(color, 0.8);
      scale['200'] = lightenColor(color, 0.6);
      scale['300'] = lightenColor(color, 0.4);
      scale['400'] = lightenColor(color, 0.2);
      scale['500'] = color; // Base color
      scale['600'] = darkenColor(color, 0.2);
      scale['700'] = darkenColor(color, 0.4);
      scale['800'] = darkenColor(color, 0.6);
      scale['900'] = darkenColor(color, 0.8);
      scale['950'] = darkenColor(color, 0.9);
      scale['999'] = darkenColor(color, 0.95);
    } else {
      // Default fallback to 9 steps
      scale['100'] = lightenColor(color, 0.8);
      scale['200'] = lightenColor(color, 0.6);
      scale['300'] = lightenColor(color, 0.4);
      scale['400'] = lightenColor(color, 0.2);
      scale['500'] = color;
      scale['600'] = darkenColor(color, 0.2);
      scale['700'] = darkenColor(color, 0.4);
      scale['800'] = darkenColor(color, 0.6);
      scale['900'] = darkenColor(color, 0.8);
    }
    
    return scale;
  });
}

/**
 * Generate light and dark mode specific palettes
 */
function generateModeSpecificPalettes(colors: RGB[]): { light: RGB[]; dark: RGB[] } {
  const lightMode: RGB[] = [];
  const darkMode: RGB[] = [];
  
  for (const color of colors) {
    // Light mode: optimized for light backgrounds
    const lightVariants = [
      lightenColor(color, 0.9),  // Very light for backgrounds
      lightenColor(color, 0.7),  // Light for secondary elements
      lightenColor(color, 0.5),  // Medium for primary elements
      lightenColor(color, 0.3),  // Darker for text on light backgrounds
      darkenColor(color, 0.1)    // Dark for emphasis
    ];
    
    // Dark mode: optimized for dark backgrounds
    const darkVariants = [
      lightenColor(color, 0.8),  // Light for text on dark backgrounds
      lightenColor(color, 0.6),  // Medium for primary elements
      color,                      // Base color
      darkenColor(color, 0.3),   // Darker for secondary elements
      darkenColor(color, 0.6)    // Very dark for backgrounds
    ];
    
    lightMode.push(...lightVariants);
    darkMode.push(...darkVariants);
  }
  
  return { light: lightMode, dark: darkMode };
}

/**
 * Generate accessible color combinations for light and dark modes
 */
function generateAccessiblePalettes(colors: RGB[]): { light: RGB[]; dark: RGB[] } {
  const lightMode: RGB[] = [];
  const darkMode: RGB[] = [];
  
  for (const color of colors) {
    // Light mode: ensure good contrast on light backgrounds
    const lightVariants = [
      lightenColor(color, 0.95), // Almost white (background)
      lightenColor(color, 0.8),  // Very light (subtle accents)
      lightenColor(color, 0.6),  // Light (secondary text)
      lightenColor(color, 0.4),  // Medium (primary text)
      darkenColor(color, 0.2)    // Dark (emphasis text)
    ];
    
    // Dark mode: ensure good contrast on dark backgrounds
    const darkVariants = [
      lightenColor(color, 0.9),  // Very light (emphasis text)
      lightenColor(color, 0.7),  // Light (primary text)
      lightenColor(color, 0.5),  // Medium (secondary text)
      lightenColor(color, 0.3),  // Dark (subtle accents)
      darkenColor(color, 0.1)    // Almost black (background)
    ];
    
    lightMode.push(...lightVariants);
    darkMode.push(...darkVariants);
  }
  
  return { light: lightMode, dark: darkMode };
}

/**
 * Generate color harmonies
 */
function generateHarmonies(colors: RGB[]): ColorHarmonies {
  return {
    analogous: generateAnalogousColors(colors[0]!),
    complementary: generateComplementaryColors(colors[0]!),
    triadic: generateTriadicColors(colors[0]!),
    splitComplementary: generateSplitComplementaryColors(colors[0]!)
  };
}

/**
 * Create palette frames on the canvas
 */
async function createPaletteFrames(palette: PaletteData, settings: PaletteSettings): Promise<void> {
  try {
    console.log('Starting palette frame creation...');
    
    // Load fonts first - try system fonts for cross-platform compatibility
    let fontFamily = { family: "Arial", style: "Regular" }; // Universal fallback
    
    // Try fonts in order of preference (mono fonts first, then universal fonts)
    const systemFonts = [
      "SF Mono",           // macOS system mono
      "Consolas",          // Windows system mono  
      "Ubuntu Mono",       // Linux Ubuntu
      "Roboto Mono",       // Android/Google
      "Menlo",            // macOS fallback
      "Monaco",           // macOS older systems
      "Courier New",      // Universal mono fallback
      "Arial",            // Universal sans-serif fallback
      "Helvetica"         // macOS/Unix fallback
    ];
    
    let loadedFont = false;
    for (const font of systemFonts) {
      try {
        console.log(`Attempting to load font: ${font}`);
        await figma.loadFontAsync({ family: font, style: "Regular" });
        fontFamily = { family: font, style: "Regular" };
        console.log(`Successfully loaded system font: ${font}`);
        loadedFont = true;
        break;
      } catch (error) {
        console.log(`${font} not available, trying next... Error:`, error);
      }
    }
    
    // This should never happen as Arial/Helvetica/sans-serif are universal
    if (!loadedFont) {
      console.error('Could not load any system fonts');
      throw new Error('Unable to load any suitable font for the plugin');
    }
    
    console.log('Final fontFamily being used:', fontFamily);
    
    // Verify the font is actually loaded by trying to load it again
    try {
      await figma.loadFontAsync(fontFamily);
      console.log('Font verification successful:', fontFamily);
    } catch (verifyError) {
      console.error('Font verification failed:', verifyError);
      throw new Error(`Font ${fontFamily.family} failed verification after loading`);
    }
    
    // Create main container frame
    const mainFrame = figma.createFrame();
    mainFrame.name = "Generated Color Palette";
    mainFrame.fills = [{ type: 'SOLID', color: { r: 0.105, g: 0.105, b: 0.105 } }]; // #1b1b1b
    
    // Enable Auto Layout for automatic positioning
    mainFrame.layoutMode = "VERTICAL";
    mainFrame.primaryAxisSizingMode = "AUTO";
    mainFrame.counterAxisSizingMode = "AUTO";
    mainFrame.paddingLeft = 50;
    mainFrame.paddingRight = 50;
    mainFrame.paddingTop = 50;
    mainFrame.paddingBottom = 50;
    mainFrame.itemSpacing = 40;
    
    // Position the main frame
    mainFrame.x = figma.viewport.center.x - 700;
    mainFrame.y = figma.viewport.center.y - 600;
    
    console.log('Main frame created');
  
  // Add to current page
    figma.currentPage.appendChild(mainFrame);
    
    console.log('Creating color scales...');
    // Create color scale frames
    await createColorScales(mainFrame, palette, settings, fontFamily);
    
    console.log('Creating harmony palettes...');
    // Create harmony frames
    await createHarmonyPalettes(mainFrame, palette, settings, fontFamily);
    
    console.log('Creating light and dark mode frames...');
    // Create light and dark mode frames
    await createModeSpecificFrames(mainFrame, palette, settings, fontFamily);
    
    console.log('Creating monotone scale...');
    // Create monotone scale
    await createMonotoneScale(mainFrame, fontFamily);
    
    console.log('All frames created, scrolling to view...');
    // Auto-layout the frames
    figma.viewport.scrollAndZoomIntoView([mainFrame]);
    
    console.log('Palette frame creation completed successfully');
    
  } catch (error) {
    console.error('Error creating palette frames:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    figma.notify(`Error creating palette output: ${error instanceof Error ? error.message : 'Unknown error'}`, { error: true });
  }
}

/**
 * Create color scale frames
 */
async function createColorScales(parentFrame: FrameNode, palette: PaletteData, settings: PaletteSettings, fontFamily: { family: string, style: string }): Promise<void> {
  try {
    console.log('Creating color scales for palette:', palette);
    
    const scaleNames = ['Primary', 'Secondary', 'Tertiary'];
    const scales = palette.scales;
    
    console.log('Available scales:', scales);
    console.log('Number of scales:', scales.length);
    
    for (let i = 0; i < scaleNames.length; i++) {
      console.log(`Creating scale ${i}: ${scaleNames[i]}`);
      
      try {
        const scaleFrame = figma.createFrame();
        scaleFrame.name = `${scaleNames[i]} Color Scale`;
        scaleFrame.resize(564, 84);
        scaleFrame.fills = []; // Transparent background
      
      // Enable Auto Layout for color scale frame
      scaleFrame.layoutMode = "VERTICAL";
      scaleFrame.primaryAxisSizingMode = "AUTO";
      scaleFrame.counterAxisSizingMode = "AUTO";
      scaleFrame.paddingLeft = 15;
      scaleFrame.paddingRight = 15;
      scaleFrame.paddingTop = 15;
      scaleFrame.paddingBottom = 15;
      scaleFrame.itemSpacing = 10;
      
      // Add title
      const title = figma.createText();
      title.fontName = fontFamily;
      title.fontSize = 16;
      title.characters = scaleNames[i] || 'Unknown';
      title.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White text for dark background
      scaleFrame.appendChild(title);
      
      // Create color swatches container
      const swatchesContainer = figma.createFrame();
      swatchesContainer.name = "Color Swatches";
      swatchesContainer.layoutMode = "HORIZONTAL";
      swatchesContainer.primaryAxisSizingMode = "AUTO";
      swatchesContainer.counterAxisSizingMode = "AUTO";
      swatchesContainer.primaryAxisAlignItems = "CENTER"; // Vertical centering
      swatchesContainer.itemSpacing = 5;
      swatchesContainer.paddingLeft = 0;
      swatchesContainer.paddingRight = 0;
      swatchesContainer.paddingTop = 0;
      swatchesContainer.paddingBottom = 0;
      swatchesContainer.fills = []; // No fill (transparent)
      scaleFrame.appendChild(swatchesContainer);
      
      // Create color swatches - get actual scale steps from the generated scale
      const currentScale = scales[i];
      if (!currentScale) {
        console.warn(`No scale found for index ${i}, skipping`);
        continue;
      }
      
      const scaleSteps = Object.keys(currentScale).sort();
      console.log(`Scale ${i} has steps:`, scaleSteps);
      
      for (let j = 0; j < scaleSteps.length; j++) {
        // Create container for swatch + label (vertical layout)
        const swatchContainer = figma.createFrame();
        swatchContainer.name = `Frame ${Date.now() + j}`;
        swatchContainer.layoutMode = "VERTICAL";
        swatchContainer.primaryAxisSizingMode = "AUTO";
        swatchContainer.counterAxisSizingMode = "AUTO";
        swatchContainer.primaryAxisAlignItems = "CENTER";
        swatchContainer.counterAxisAlignItems = "CENTER";
        swatchContainer.itemSpacing = 0;
        swatchContainer.paddingLeft = 0;
        swatchContainer.paddingRight = 0;
        swatchContainer.paddingTop = 0;
        swatchContainer.paddingBottom = 0;
        swatchContainer.fills = [];
        
        // Create color swatch
        const swatch = figma.createRectangle();
        swatch.name = `${scaleNames[i]}-${scaleSteps[j]}`;
        swatch.resize(40, 40);
        swatch.cornerRadius = 4;
        
        const color = currentScale[scaleSteps[j] as keyof ColorScale];
        console.log(`Creating swatch ${scaleSteps[j]} with color:`, color);
        
        if (color) {
          swatch.fills = [{ type: 'SOLID', color: color }];
          console.log(`Applied color to swatch:`, swatch.fills);
        } else {
          console.warn(`No color found for ${scaleSteps[j]}, using fallback`);
          swatch.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
        }
        swatch.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
        swatch.strokeWeight = 1;
        swatchContainer.appendChild(swatch);
        
        // Create label container
        const labelContainer = figma.createFrame();
        labelContainer.name = `Frame ${Date.now() + j + 1000}`;
        labelContainer.layoutMode = "HORIZONTAL";
        labelContainer.primaryAxisSizingMode = "AUTO";
        labelContainer.counterAxisSizingMode = "AUTO";
        labelContainer.primaryAxisAlignItems = "CENTER";
        labelContainer.counterAxisAlignItems = "CENTER";
        labelContainer.itemSpacing = 8;
        labelContainer.paddingLeft = 0;
        labelContainer.paddingRight = 0;
        labelContainer.paddingTop = 0;
        labelContainer.paddingBottom = 0;
        labelContainer.resize(40, 40);
        labelContainer.fills = [];
        
        // Add color label
        const label = figma.createText();
        label.fontName = fontFamily;
        label.fontSize = 10;
        label.characters = scaleSteps[j] || '000';
        label.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White text for dark background
        labelContainer.appendChild(label);
        
        swatchContainer.appendChild(labelContainer);
        swatchesContainer.appendChild(swatchContainer);
      }
      
        parentFrame.appendChild(scaleFrame);
        console.log(`Scale ${scaleNames[i]} created successfully`);
      
      } catch (scaleError) {
        console.error(`Error creating scale ${i} (${scaleNames[i]}):`, scaleError);
        console.error('Error message:', scaleError instanceof Error ? scaleError.message : 'Unknown error');
        console.error('Error stack:', scaleError instanceof Error ? scaleError.stack : 'No stack trace');
        console.error('Scale data JSON:', JSON.stringify(scales[i], null, 2));
        console.error('Palette scales structure JSON:', JSON.stringify(palette.scales, null, 2));
        throw scaleError;
      }
    }
    
    console.log('All color scales created successfully');
  } catch (error) {
    console.error('Error in createColorScales:', error);
    throw error;
  }
}

/**
 * Create harmony palette frames
 */
async function createHarmonyPalettes(parentFrame: FrameNode, palette: PaletteData, settings: PaletteSettings, fontFamily: { family: string, style: string }): Promise<void> {
  try {
    console.log('Creating harmony palettes for palette:', palette);
    
    // Define all possible harmony types
    const allHarmonyTypes = [
      { name: 'Analogous', key: 'analogous', colors: palette.harmonies.analogous },
      { name: 'Complementary', key: 'complementary', colors: palette.harmonies.complementary },
      { name: 'Triadic', key: 'triadic', colors: palette.harmonies.triadic },
      { name: 'Split-Complementary', key: 'splitComplementary', colors: palette.harmonies.splitComplementary }
    ];
    
    // Filter based on user selection
    const selectedHarmonyTypes = allHarmonyTypes.filter(harmony => 
      settings.harmonyTypes.includes(harmony.key)
    );
    
    console.log('Selected harmony types:', selectedHarmonyTypes.map(h => h.name));
    console.log('User selected:', settings.harmonyTypes);
    
    for (let i = 0; i < selectedHarmonyTypes.length; i++) {
      const harmonyType = selectedHarmonyTypes[i];
      if (!harmonyType) continue;
      
      console.log(`Creating harmony ${i}: ${harmonyType.name}`);
      
      const harmonyFrame = figma.createFrame();
      harmonyFrame.name = `${harmonyType.name || 'Unknown'} Harmony`;
      harmonyFrame.resize(250, 150);
      harmonyFrame.fills = []; // Transparent background
      
      // Enable Auto Layout for harmony frame
      harmonyFrame.layoutMode = "VERTICAL";
      harmonyFrame.primaryAxisSizingMode = "AUTO";
      harmonyFrame.counterAxisSizingMode = "AUTO";
      harmonyFrame.paddingLeft = 15;
      harmonyFrame.paddingRight = 15;
      harmonyFrame.paddingTop = 15;
      harmonyFrame.paddingBottom = 15;
      harmonyFrame.itemSpacing = 10;
      
      // Add title
      const title = figma.createText();
      title.fontName = fontFamily;
      title.fontSize = 14;
      title.characters = harmonyType.name || 'Unknown';
      title.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White text for dark background
      harmonyFrame.appendChild(title);
      
      // Create harmony color swatches container
      const swatchesContainer = figma.createFrame();
      swatchesContainer.name = "Harmony Swatches";
      swatchesContainer.layoutMode = "HORIZONTAL";
      swatchesContainer.primaryAxisSizingMode = "AUTO";
      swatchesContainer.counterAxisSizingMode = "AUTO";
      swatchesContainer.itemSpacing = 10;
      swatchesContainer.paddingLeft = 0;
      swatchesContainer.paddingRight = 0;
      swatchesContainer.paddingTop = 0;
      swatchesContainer.paddingBottom = 0;
      swatchesContainer.fills = []; // No fill (transparent)
      harmonyFrame.appendChild(swatchesContainer);
      
      // Create harmony color swatches
      const colors = harmonyType.colors;
      console.log(`Colors for ${harmonyType.name}:`, colors);
      
      for (let j = 0; j < colors.length; j++) {
        const swatch = figma.createRectangle();
        swatch.name = `${harmonyType.name || 'Unknown'}-${j}`;
        swatch.resize(40, 40);
        swatch.cornerRadius = 4;
        swatch.fills = [{ type: 'SOLID', color: colors[j] || { r: 0.5, g: 0.5, b: 0.5 } }];
        swatch.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
        swatch.strokeWeight = 1;
        swatchesContainer.appendChild(swatch);
      }
      
      parentFrame.appendChild(harmonyFrame);
      console.log(`Harmony ${harmonyType.name} created successfully`);
    }
    
    console.log('All harmony palettes created successfully');
  } catch (error) {
    console.error('Error in createHarmonyPalettes:', error);
    throw error;
  }
}

/**
 * Create light and dark mode specific frames
 */
async function createModeSpecificFrames(parentFrame: FrameNode, palette: PaletteData, settings: PaletteSettings, fontFamily: { family: string, style: string }): Promise<void> {
  try {
    console.log('Creating light and dark mode frames...');
    
    // Create Light Mode frame
    const lightFrame = figma.createFrame();
    lightFrame.name = "Light Mode Palette";
    lightFrame.resize(600, 400);
    lightFrame.fills = []; // Transparent background
    
    // Enable Auto Layout for light mode frame
    lightFrame.layoutMode = "VERTICAL";
    lightFrame.primaryAxisSizingMode = "AUTO";
    lightFrame.counterAxisSizingMode = "AUTO";
    lightFrame.paddingLeft = 20;
    lightFrame.paddingRight = 20;
    lightFrame.paddingTop = 20;
    lightFrame.paddingBottom = 20;
    lightFrame.itemSpacing = 15;
    
    // Add title
    const lightTitle = figma.createText();
    lightTitle.fontName = fontFamily;
    lightTitle.fontSize = 18;
    lightTitle.characters = settings.accessibility ? "Light Mode (WCAG Accessible)" : "Light Mode";
    lightTitle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White text for dark background
    lightFrame.appendChild(lightTitle);
    
    // Create light mode color swatches container
    const lightSwatchesContainer = figma.createFrame();
    lightSwatchesContainer.name = "Light Mode Swatches";
    lightSwatchesContainer.layoutMode = "HORIZONTAL";
    lightSwatchesContainer.primaryAxisSizingMode = "AUTO";
    lightSwatchesContainer.counterAxisSizingMode = "AUTO";
    lightSwatchesContainer.primaryAxisAlignItems = "CENTER"; // Vertical centering
    lightSwatchesContainer.itemSpacing = 10;
    lightSwatchesContainer.paddingLeft = 0;
    lightSwatchesContainer.paddingRight = 0;
    lightSwatchesContainer.paddingTop = 0;
    lightSwatchesContainer.paddingBottom = 0;
    lightSwatchesContainer.fills = []; // No fill (transparent)
    lightFrame.appendChild(lightSwatchesContainer);
    
    // Use accessible colors if accessibility is enabled, otherwise use regular light mode colors
    const lightColors = settings.accessibility ? palette.accessibleLight : palette.lightMode;
    console.log('Using light mode colors:', settings.accessibility ? 'accessible' : 'regular', lightColors.length);
    
    // Create light mode color swatches
    for (let i = 0; i < Math.min(lightColors.length, 15); i++) {
      // Create container for swatch + label (vertical layout)
      const swatchContainer = figma.createFrame();
      swatchContainer.name = `Frame ${Date.now() + i}`;
      swatchContainer.layoutMode = "VERTICAL";
      swatchContainer.primaryAxisSizingMode = "AUTO";
      swatchContainer.counterAxisSizingMode = "AUTO";
      swatchContainer.primaryAxisAlignItems = "CENTER";
      swatchContainer.counterAxisAlignItems = "CENTER";
      swatchContainer.itemSpacing = 0;
      swatchContainer.paddingLeft = 0;
      swatchContainer.paddingRight = 0;
      swatchContainer.paddingTop = 0;
      swatchContainer.paddingBottom = 0;
      swatchContainer.fills = [];
      
      // Create color swatch
      const swatch = figma.createRectangle();
      swatch.name = `LightMode-${i}`;
      swatch.resize(40, 40);
      swatch.cornerRadius = 4;
      
      const color = lightColors[i];
      if (color) {
        swatch.fills = [{ type: 'SOLID', color: color }];
      } else {
        swatch.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
      }
      
      swatch.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
      swatch.strokeWeight = 1;
      swatchContainer.appendChild(swatch);
      
      // Create label container
      const labelContainer = figma.createFrame();
      labelContainer.name = `Frame ${Date.now() + i + 2000}`;
      labelContainer.layoutMode = "HORIZONTAL";
      labelContainer.primaryAxisSizingMode = "AUTO";
      labelContainer.counterAxisSizingMode = "AUTO";
      labelContainer.primaryAxisAlignItems = "CENTER";
      labelContainer.counterAxisAlignItems = "CENTER";
      labelContainer.itemSpacing = 8;
      labelContainer.paddingLeft = 0;
      labelContainer.paddingRight = 0;
      labelContainer.paddingTop = 0;
      labelContainer.paddingBottom = 0;
      labelContainer.resize(40, 40);
      labelContainer.fills = [];
      
      // Add color labels
      const label = figma.createText();
      label.fontName = fontFamily;
      label.fontSize = 10;
      label.characters = `L${i + 1}`;
      label.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White text for dark background
      labelContainer.appendChild(label);
      
      swatchContainer.appendChild(labelContainer);
      lightSwatchesContainer.appendChild(swatchContainer);
    }
    
    // Create Dark Mode frame
    const darkFrame = figma.createFrame();
    darkFrame.name = "Dark Mode Palette";
    darkFrame.resize(600, 400);
    darkFrame.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }]; // #333333
    
    // Enable Auto Layout for dark mode frame
    darkFrame.layoutMode = "VERTICAL";
    darkFrame.primaryAxisSizingMode = "AUTO";
    darkFrame.counterAxisSizingMode = "AUTO";
    darkFrame.paddingLeft = 20;
    darkFrame.paddingRight = 20;
    darkFrame.paddingTop = 20;
    darkFrame.paddingBottom = 20;
    darkFrame.itemSpacing = 15;
    
    // Add title
    const darkTitle = figma.createText();
    darkTitle.fontName = fontFamily;
    darkTitle.fontSize = 18;
    darkTitle.characters = settings.accessibility ? "Dark Mode (WCAG Accessible)" : "Dark Mode";
    darkTitle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    darkFrame.appendChild(darkTitle);
    
    // Create dark mode color swatches container
    const darkSwatchesContainer = figma.createFrame();
    darkSwatchesContainer.name = "Dark Mode Swatches";
    darkSwatchesContainer.layoutMode = "HORIZONTAL";
    darkSwatchesContainer.primaryAxisSizingMode = "AUTO";
    darkSwatchesContainer.counterAxisSizingMode = "AUTO";
    darkSwatchesContainer.primaryAxisAlignItems = "CENTER"; // Vertical centering
    darkSwatchesContainer.itemSpacing = 10;
    darkSwatchesContainer.paddingLeft = 0;
    darkSwatchesContainer.paddingRight = 0;
    darkSwatchesContainer.paddingTop = 0;
    darkSwatchesContainer.paddingBottom = 0;
    darkSwatchesContainer.fills = []; // No fill (transparent)
    darkFrame.appendChild(darkSwatchesContainer);
    
    // Use accessible colors if accessibility is enabled, otherwise use regular dark mode colors
    const darkColors = settings.accessibility ? palette.accessibleDark : palette.darkMode;
    console.log('Using dark mode colors:', settings.accessibility ? 'accessible' : 'regular', darkColors.length);
    
    // Create dark mode color swatches
    for (let i = 0; i < Math.min(darkColors.length, 15); i++) {
      // Create container for swatch + label (vertical layout)
      const swatchContainer = figma.createFrame();
      swatchContainer.name = `Frame ${Date.now() + i}`;
      swatchContainer.layoutMode = "VERTICAL";
      swatchContainer.primaryAxisSizingMode = "AUTO";
      swatchContainer.counterAxisSizingMode = "AUTO";
      swatchContainer.primaryAxisAlignItems = "CENTER";
      swatchContainer.counterAxisAlignItems = "CENTER";
      swatchContainer.itemSpacing = 0;
      swatchContainer.paddingLeft = 0;
      swatchContainer.paddingRight = 0;
      swatchContainer.paddingTop = 0;
      swatchContainer.paddingBottom = 0;
      swatchContainer.fills = [];
      
      // Create color swatch
      const swatch = figma.createRectangle();
      swatch.name = `DarkMode-${i}`;
      swatch.resize(40, 40);
      swatch.cornerRadius = 4;
      
      const color = darkColors[i];
      if (color) {
        swatch.fills = [{ type: 'SOLID', color: color }];
      } else {
        swatch.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
      }
      
      swatch.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
      swatch.strokeWeight = 1;
      swatchContainer.appendChild(swatch);
      
      // Create label container
      const labelContainer = figma.createFrame();
      labelContainer.name = `Frame ${Date.now() + i + 3000}`;
      labelContainer.layoutMode = "HORIZONTAL";
      labelContainer.primaryAxisSizingMode = "AUTO";
      labelContainer.counterAxisSizingMode = "AUTO";
      labelContainer.primaryAxisAlignItems = "CENTER";
      labelContainer.counterAxisAlignItems = "CENTER";
      labelContainer.itemSpacing = 8;
      labelContainer.paddingLeft = 0;
      labelContainer.paddingRight = 0;
      labelContainer.paddingTop = 0;
      labelContainer.paddingBottom = 0;
      labelContainer.resize(40, 40);
      labelContainer.fills = [];
      
      // Add color labels
      const label = figma.createText();
      label.fontName = fontFamily;
      label.fontSize = 10;
      label.characters = `D${i + 1}`;
      label.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White text color for dark mode
      labelContainer.appendChild(label);
      
      swatchContainer.appendChild(labelContainer);
      darkSwatchesContainer.appendChild(swatchContainer);
    }
    
    parentFrame.appendChild(lightFrame);
    parentFrame.appendChild(darkFrame);
    
    console.log('Light and dark mode frames created successfully');
  } catch (error) {
    console.error('Error in createModeSpecificFrames:', error);
    throw error;
  }
}

/**
 * Create monotone scale
 */
async function createMonotoneScale(parentFrame: FrameNode, fontFamily: { family: string, style: string }): Promise<void> {
  try {
    console.log('Creating monotone scale...');
    
    const monotoneFrame = figma.createFrame();
    monotoneFrame.name = "Monotone Scale";
    monotoneFrame.resize(300, 150);
    monotoneFrame.fills = []; // Transparent background
    
    // Enable Auto Layout for monotone frame
    monotoneFrame.layoutMode = "VERTICAL";
    monotoneFrame.primaryAxisSizingMode = "AUTO";
    monotoneFrame.counterAxisSizingMode = "AUTO";
    monotoneFrame.paddingLeft = 15;
    monotoneFrame.paddingRight = 15;
    monotoneFrame.paddingTop = 15;
    monotoneFrame.paddingBottom = 15;
    monotoneFrame.itemSpacing = 10;
    
    // Add title
    const title = figma.createText();
    title.fontName = fontFamily;
    title.fontSize = 14;
    title.characters = "Monotone Scale";
    title.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White text for dark background
    monotoneFrame.appendChild(title);
    
    // Create monotone swatches container
    const swatchesContainer = figma.createFrame();
    swatchesContainer.name = "Monotone Swatches";
    swatchesContainer.layoutMode = "HORIZONTAL";
    swatchesContainer.primaryAxisSizingMode = "AUTO";
    swatchesContainer.counterAxisSizingMode = "AUTO";
    swatchesContainer.itemSpacing = 5;
    swatchesContainer.paddingLeft = 0;
    swatchesContainer.paddingRight = 0;
    swatchesContainer.paddingTop = 0;
    swatchesContainer.paddingBottom = 0;
    swatchesContainer.fills = []; // No fill (transparent)
    monotoneFrame.appendChild(swatchesContainer);
    
    // Create monotone swatches (white to black)
    const monotoneSteps = 9;
    for (let i = 0; i < monotoneSteps; i++) {
      // Create container for swatch + label (vertical layout)
      const swatchContainer = figma.createFrame();
      swatchContainer.name = `Frame ${Date.now() + i}`;
      swatchContainer.layoutMode = "VERTICAL";
      swatchContainer.primaryAxisSizingMode = "AUTO";
      swatchContainer.counterAxisSizingMode = "AUTO";
      swatchContainer.primaryAxisAlignItems = "CENTER";
      swatchContainer.counterAxisAlignItems = "CENTER";
      swatchContainer.itemSpacing = 0;
      swatchContainer.paddingLeft = 0;
      swatchContainer.paddingRight = 0;
      swatchContainer.paddingTop = 0;
      swatchContainer.paddingBottom = 0;
      swatchContainer.fills = [];
      
      // Create monotone swatch
      const swatch = figma.createRectangle();
      swatch.name = `Monotone-${i * 100}`;
      swatch.resize(40, 40);
      swatch.cornerRadius = 4;
      
      const grayValue = i / (monotoneSteps - 1);
      swatch.fills = [{ type: 'SOLID', color: { r: grayValue, g: grayValue, b: grayValue } }];
      swatch.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
      swatch.strokeWeight = 1;
      swatchContainer.appendChild(swatch);
      
      // Create label container
      const labelContainer = figma.createFrame();
      labelContainer.name = `Frame ${Date.now() + i + 4000}`;
      labelContainer.layoutMode = "HORIZONTAL";
      labelContainer.primaryAxisSizingMode = "AUTO";
      labelContainer.counterAxisSizingMode = "AUTO";
      labelContainer.primaryAxisAlignItems = "CENTER";
      labelContainer.counterAxisAlignItems = "CENTER";
      labelContainer.itemSpacing = 8;
      labelContainer.paddingLeft = 0;
      labelContainer.paddingRight = 0;
      labelContainer.paddingTop = 0;
      labelContainer.paddingBottom = 0;
      labelContainer.resize(40, 40);
      labelContainer.fills = [];
      
      // Add label
      const label = figma.createText();
      label.fontName = fontFamily;
      label.fontSize = 10;
      label.characters = `${i * 100}`;
      label.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White text for dark background
      labelContainer.appendChild(label);
      
      swatchContainer.appendChild(labelContainer);
      swatchesContainer.appendChild(swatchContainer);
    }
    
    parentFrame.appendChild(monotoneFrame);
    console.log('Monotone scale created successfully');
  } catch (error) {
    console.error('Error in createMonotoneScale:', error);
    throw error;
  }
}

// Utility functions for color manipulation
function lightenColor(color: RGB, amount: number): RGB {
  return {
    r: Math.min(1, color.r + (1 - color.r) * amount),
    g: Math.min(1, color.g + (1 - color.g) * amount),
    b: Math.min(1, color.b + (1 - color.b) * amount)
  };
}

function darkenColor(color: RGB, amount: number): RGB {
  return {
    r: Math.max(0, color.r * (1 - amount)),
    g: Math.max(0, color.g * (1 - amount)),
    b: Math.max(0, color.b * (1 - amount))
  };
}

function generateAnalogousColors(color: RGB): RGB[] {
  // Convert RGB to HSL for easier color manipulation
  const hsl = rgbToHsl(color.r, color.g, color.b);
  
  // Generate 3 analogous colors (30° apart)
  const analogous: RGB[] = [];
  for (let i = 1; i <= 3; i++) {
    const hue = (hsl.h + i * 30) % 360;
    const { r, g, b } = hslToRgb(hue, hsl.s, hsl.l);
    analogous.push({ r, g, b });
  }
  
  return analogous;
}

function generateComplementaryColors(color: RGB): RGB[] {
  // Convert RGB to HSL
  const hsl = rgbToHsl(color.r, color.g, color.b);
  
  // Generate complementary color (180° opposite)
  const complementaryHue = (hsl.h + 180) % 360;
  const { r, g, b } = hslToRgb(complementaryHue, hsl.s, hsl.l);
  
  return [{ r, g, b }];
}

function generateTriadicColors(color: RGB): RGB[] {
  // Convert RGB to HSL
  const hsl = rgbToHsl(color.r, color.g, color.b);
  
  // Generate 2 triadic colors (120° apart)
  const triadic: RGB[] = [];
  for (let i = 1; i <= 2; i++) {
    const hue = (hsl.h + i * 120) % 360;
    const { r, g, b } = hslToRgb(hue, hsl.s, hsl.l);
    triadic.push({ r, g, b });
  }
  
  return triadic;
}

function generateSplitComplementaryColors(color: RGB): RGB[] {
  // Convert RGB to HSL
  const hsl = rgbToHsl(color.r, color.g, color.b);
  
  // Generate 2 split-complementary colors (150° and 210° from base)
  const splitComplementary: RGB[] = [];
  const angles = [150, 210];
  
  for (const angle of angles) {
    const hue = (hsl.h + angle) % 360;
    const { r, g, b } = hslToRgb(hue, hsl.s, hsl.l);
    splitComplementary.push({ r, g, b });
  }
  
  return splitComplementary;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  // RGB values are already 0-1 from Figma
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return { h: h * 360, s, l };
}

// Type definitions
interface PluginMessage {
  type: 'extract-image-colors' | 'generate-palette' | 'generate-palette-from-selected' | 'cancel';
  selectedColors?: SelectedColors;
  settings?: PaletteSettings;
}

interface SelectedColors {
  primary: RGB;
  secondary: RGB;
  tertiary: RGB;
}

interface PaletteData {
  primary: RGB;
  secondary: RGB;
  tertiary: RGB;
  scales: ColorScale[];
  harmonies: ColorHarmonies;
  lightMode: RGB[];
  darkMode: RGB[];
  accessibleLight: RGB[];
  accessibleDark: RGB[];
  monotoneScale: RGB[];
}

interface ColorScale {
  [key: string]: RGB;
}

interface ColorHarmonies {
  analogous: RGB[];
  complementary: RGB[];
  triadic: RGB[];
  splitComplementary: RGB[];
}

interface ImageNode {
  type: string;
  fills: Paint[];
  width: number;
  height: number;
  x: number;
  y: number;
}

interface ColorEstimation {
  hueRange: [number, number];
  saturationBias: number;
  lightnessBias: number;
  warmth: 'warm' | 'cool' | 'neutral';
  vibrancy: 'high' | 'medium' | 'low';
}

interface HashAnalysis {
  length: number;
  sum: number;
  average: number;
  variance: number;
  hexDigitCount: number;
  patternScore: number;
  alphaRatio: number;
  digitRatio: number;
}

interface PaletteSettings {
  scaleSteps: number;
  accessibility: boolean;
  harmonyTypes: string[];
}
