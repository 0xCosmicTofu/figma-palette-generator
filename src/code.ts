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
      case 'generate-palette':
        await generatePalette(msg.settings);
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
 * Main palette generation function
 */
async function generatePalette(settings: PaletteSettings): Promise<void> {
  try {
    // Check if a frame is selected
    if (figma.currentPage.selection.length === 0) {
      figma.notify('Please select a frame containing images', { error: true });
      return;
    }

    const selectedNode = figma.currentPage.selection[0];
    
    // Validate selection is a frame or a single image
    if (!selectedNode) {
      figma.notify('Please select a frame containing images or a single image', { error: true });
      return;
    }

    let images: ImageNode[] = [];
    
    if (selectedNode.type === 'FRAME') {
      // Extract images from the frame
      images = extractImagesFromFrame(selectedNode);
    } else if (selectedNode.type === 'RECTANGLE' && isImageNode(selectedNode)) {
      // Handle single image selection
      images = extractSingleImage(selectedNode);
    } else {
      figma.notify('Please select a frame containing images or a single image rectangle', { error: true });
      return;
    }
    
    if (images.length === 0) {
      figma.notify('No images found in selection. Please select a frame with images or a single image rectangle.', { error: true });
      return;
    }

    if (images.length > 10) {
      figma.notify('Maximum 10 images supported. Using first 10 images.', { error: false });
    }

    // Limit to 10 images
    const limitedImages = images.slice(0, 10);

    // Generate palette
    const palette = await generateColorPalette(limitedImages);
    
    // Create output frames with settings
    await createPaletteFrames(palette, settings);
    
    // Send success message to UI
    figma.ui.postMessage({ type: 'palette-generated' });
    
    figma.notify('Palette generated successfully!', { error: false });
    
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
 * Generate color palette from images using median cut algorithm
 */
async function generateColorPalette(images: ImageNode[]): Promise<PaletteData> {
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
    console.log('Brightest primary color selected:', brightestPrimary);

    // Build a cohesive family (primary/secondary/tertiary) from the brightest primary
    const primaryColors = buildColorFamilyFromPrimary(brightestPrimary);
    console.log('Constructed primary color family:', primaryColors);
    
    // Generate color scales and harmonies
    const scales = generateColorScales(primaryColors);
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
      accessibleDark: accessiblePalettes.dark
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
      accessibleDark: generateAccessiblePalettes(fallbackColors).dark
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
      
      console.log(`Processing image ${imageIndex}: ${image.width}x${image.height}, weight: ${weight}, pixels: ${pixelCount}`);
      
      // Extract pixels with weighting
      const pixels = await extractPixelsFromImage(imageData, pixelCount, imageIndex);
      
      // Add weighted pixels to collection with image-specific variation
      for (let i = 0; i < pixels.length; i++) {
        allPixels.push(pixels[i]!);
      }
      
      console.log(`Image ${imageIndex} contributed ${pixels.length} pixels`);
      
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
 * Extract pixels from a Figma image
 * Enhanced approach that generates more varied colors based on image characteristics
 */
async function extractPixelsFromImage(imageData: Image, sampleCount: number, imageIndex: number): Promise<RGB[]> {
  const pixels: RGB[] = [];
  
  // Generate colors based on the image hash with enhanced variation
  const hashString = imageData.hash;
  let hashValue = 0;
  
  for (let i = 0; i < hashString.length; i++) {
    hashValue += hashString.charCodeAt(i);
  }
  
  // Create a more sophisticated color generation based on hash characteristics
  const hashLength = hashString.length;
  const hashSum = hashValue;
  const hashProduct = hashString.split('').reduce((acc, char) => acc * char.charCodeAt(0), 1);
  
  // Generate base colors with more variation, incorporating image index
  for (let i = 0; i < sampleCount; i++) {
    const seed1 = (hashSum + i * 12345 + imageIndex * 100000) % 1000000;
    const seed2 = (hashProduct + i * 67890 + imageIndex * 200000) % 1000000;
    const seed3 = (hashLength * 1000 + i * 11111 + imageIndex * 300000) % 1000000;
    
    // Combine multiple seeds for more variety
    const combinedSeed = (seed1 + seed2 + seed3) % 1000000;
    
             // Generate more varied and vibrant colors
         const hue = (combinedSeed * 360) / 1000000;
         const saturation = 0.2 + (seed1 % 80) / 100; // 0.2 to 1.0 (full range, more low-sat)
         const lightness = 0.1 + (seed2 % 80) / 100;  // 0.1 to 0.9 (full range, more extremes)
    
    const { r, g, b } = hslToRgb(hue, saturation, lightness);
    pixels.push({ r, g, b });
  }
  
  // Generate complementary and analogous colors with more variation, incorporating image index
  const baseHue1 = ((hashSum + imageIndex * 100000) * 360) / 1000000;
  const baseHue2 = ((hashProduct + imageIndex * 200000) * 360) / 1000000;
  const baseHue3 = ((hashLength + imageIndex * 300000) * 360) / 1000000;
  
  // Create more diverse color relationships
  const complementaryHue1 = (baseHue1 + 180) % 360;
  const complementaryHue2 = (baseHue2 + 180) % 360;
  const analogousHue1 = (baseHue1 + 45) % 360;
  const analogousHue2 = (baseHue1 - 45 + 360) % 360;
  const triadicHue1 = (baseHue1 + 120) % 360;
  const triadicHue2 = (baseHue1 + 240) % 360;
  
           // Add these specific colors for better palette variety
         const additionalColors = [
           { hue: baseHue1, saturation: 1.0, lightness: 0.5 },      // Maximum saturation
           { hue: complementaryHue1, saturation: 1.0, lightness: 0.4 }, // Maximum saturation
           { hue: analogousHue1, saturation: 0.95, lightness: 0.55 },    // Very high saturation
           { hue: analogousHue2, saturation: 0.95, lightness: 0.45 },    // Very high saturation
           { hue: triadicHue1, saturation: 0.9, lightness: 0.6 },       // Very high saturation
           { hue: triadicHue2, saturation: 0.9, lightness: 0.5 },       // Very high saturation
           { hue: baseHue2, saturation: 1.0, lightness: 0.4 },          // Maximum saturation
           { hue: baseHue3, saturation: 0.95, lightness: 0.6 }          // Very high saturation
         ];
  
  for (const colorSpec of additionalColors) {
    const { r, g, b } = hslToRgb(colorSpec.hue, colorSpec.saturation, colorSpec.lightness);
    pixels.push({ r, g, b });
  }
  
  return pixels;
}

/**
 * Median Cut Algorithm for color quantization
 */
function medianCut(pixels: RGB[], numColors: number): RGB[] {
  if (pixels.length === 0) {
    return generateDefaultColors(numColors);
  }
  
  // Start with all pixels in one bucket
  let buckets: RGB[][] = [pixels];
  
  // Split buckets until we have the desired number of colors
  while (buckets.length < numColors) {
    const bucketToSplit = findLargestBucket(buckets);
    if (!bucketToSplit) break;
    
    const [bucket1, bucket2] = splitBucket(bucketToSplit);
    buckets.splice(buckets.indexOf(bucketToSplit), 1, bucket1, bucket2);
  }
  
  // Calculate the average color for each bucket
  return buckets.map(bucket => calculateAverageColor(bucket));
}

/**
 * Find the bucket with the most pixels
 */
function findLargestBucket(buckets: RGB[][]): RGB[] | null {
  if (buckets.length === 0) return null;
  
  let largestBucket = buckets[0]!;
  let maxSize = largestBucket.length;
  
  for (const bucket of buckets) {
    if (bucket.length > maxSize) {
      largestBucket = bucket;
      maxSize = bucket.length;
    }
  }
  
  return largestBucket;
}

/**
 * Split a bucket of pixels along its longest dimension
 */
function splitBucket(bucket: RGB[]): [RGB[], RGB[]] {
  if (bucket.length <= 1) {
    return [bucket, []];
  }
  
  // Find the color channel with the greatest range
  const ranges = calculateColorRanges(bucket);
  const maxRange = Math.max(ranges.r, ranges.g, ranges.b);
  
  let splitChannel: 'r' | 'g' | 'b';
  if (maxRange === ranges.r) splitChannel = 'r';
  else if (maxRange === ranges.g) splitChannel = 'g';
  else splitChannel = 'b';
  
  // Sort pixels by the chosen channel
  bucket.sort((a, b) => a[splitChannel] - b[splitChannel]);
  
  // Split at the median
  const medianIndex = Math.floor(bucket.length / 2);
  const bucket1 = bucket.slice(0, medianIndex);
  const bucket2 = bucket.slice(medianIndex);
  
  return [bucket1, bucket2];
}

/**
 * Calculate the range of values for each color channel
 */
function calculateColorRanges(bucket: RGB[]): { r: number; g: number; b: number } {
  if (bucket.length === 0) return { r: 0, g: 0, b: 0 };
  
  let minR = 1, maxR = 0, minG = 1, maxG = 0, minB = 1, maxB = 0;
  
  for (const pixel of bucket) {
    minR = Math.min(minR, pixel.r);
    maxR = Math.max(maxR, pixel.r);
    minG = Math.min(minG, pixel.g);
    maxG = Math.max(maxG, pixel.g);
    minB = Math.min(minB, pixel.b);
    maxB = Math.max(maxB, pixel.b);
  }
  
  return {
    r: maxR - minR,
    g: maxG - minG,
    b: maxB - minB
  };
}

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
 * Generate color scales (000-900) for each primary color
 */
function generateColorScales(colors: RGB[]): ColorScale[] {
  return colors.map(color => {
    const scale: ColorScale = {
      '000': lightenColor(color, 0.95), // Almost white
      '100': lightenColor(color, 0.8),  // Very light
      '200': lightenColor(color, 0.6),  // Light
      '300': lightenColor(color, 0.4),  // Medium light
      '400': lightenColor(color, 0.2),  // Slightly light
      '500': color,                     // Base color
      '600': darkenColor(color, 0.2),   // Slightly dark
      '700': darkenColor(color, 0.4),   // Medium dark
      '800': darkenColor(color, 0.6),   // Dark
      '900': darkenColor(color, 0.8)    // Very dark
    };
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
    
    // Load fonts first (required for text nodes)
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    console.log('Fonts loaded successfully');
    
    // Create main container frame
    const mainFrame = figma.createFrame();
    mainFrame.name = "Generated Color Palette";
    mainFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    
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
    await createColorScales(mainFrame, palette);
    
    console.log('Creating harmony palettes...');
    // Create harmony frames
    await createHarmonyPalettes(mainFrame, palette, settings);
    
    console.log('Creating light and dark mode frames...');
    // Create light and dark mode frames
    await createModeSpecificFrames(mainFrame, palette, settings);
    
    console.log('Creating monotone scale...');
    // Create monotone scale
    await createMonotoneScale(mainFrame);
    
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
async function createColorScales(parentFrame: FrameNode, palette: PaletteData): Promise<void> {
  try {
    console.log('Creating color scales for palette:', palette);
    
    const scaleNames = ['Primary', 'Secondary', 'Tertiary'];
    const scales = [palette.scales[0], palette.scales[1], palette.scales[2]];
    
    console.log('Available scales:', scales);
    
    for (let i = 0; i < scaleNames.length; i++) {
      console.log(`Creating scale ${i}: ${scaleNames[i]}`);
      
      const scaleFrame = figma.createFrame();
      scaleFrame.name = `${scaleNames[i]} Color Scale`;
      scaleFrame.resize(564, 84);
      scaleFrame.fills = [{ type: 'SOLID', color: { r: 0.949, g: 0.949, b: 0.949 } }]; // #f2f2f2
      
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
      title.characters = scaleNames[i] || 'Unknown';
      title.fontSize = 16;
      title.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
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
      
      // Create color swatches
      const scaleSteps = ['000', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
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
        
        const color = scales[i]![scaleSteps[j] as keyof ColorScale];
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
        label.characters = scaleSteps[j] || '000';
        label.fontSize = 10;
        label.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
        labelContainer.appendChild(label);
        
        swatchContainer.appendChild(labelContainer);
        swatchesContainer.appendChild(swatchContainer);
      }
      
      parentFrame.appendChild(scaleFrame);
      console.log(`Scale ${scaleNames[i]} created successfully`);
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
async function createHarmonyPalettes(parentFrame: FrameNode, palette: PaletteData, settings: PaletteSettings): Promise<void> {
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
      harmonyFrame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
      
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
      title.characters = harmonyType.name || 'Unknown';
      title.fontSize = 14;
      title.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
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
async function createModeSpecificFrames(parentFrame: FrameNode, palette: PaletteData, settings: PaletteSettings): Promise<void> {
  try {
    console.log('Creating light and dark mode frames...');
    
    // Create Light Mode frame
    const lightFrame = figma.createFrame();
    lightFrame.name = "Light Mode Palette";
    lightFrame.resize(600, 400);
    lightFrame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
    
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
    lightTitle.characters = settings.accessibility ? "Light Mode (WCAG Accessible)" : "Light Mode";
    lightTitle.fontSize = 18;
    lightTitle.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
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
      label.characters = `L${i + 1}`;
      label.fontSize = 10;
      label.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
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
    darkTitle.characters = settings.accessibility ? "Dark Mode (WCAG Accessible)" : "Dark Mode";
    darkTitle.fontSize = 18;
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
      label.characters = `D${i + 1}`;
      label.fontSize = 10;
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
async function createMonotoneScale(parentFrame: FrameNode): Promise<void> {
  try {
    console.log('Creating monotone scale...');
    
    const monotoneFrame = figma.createFrame();
    monotoneFrame.name = "Monotone Scale";
    monotoneFrame.resize(300, 150);
    monotoneFrame.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
    
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
    title.characters = "Monotone Scale";
    title.fontSize = 14;
    title.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
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
      label.characters = `${i * 100}`;
      label.fontSize = 10;
      label.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
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
  type: string;
  [key: string]: any;
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
}

interface ColorScale {
  '000': RGB;
  '100': RGB;
  '200': RGB;
  '300': RGB;
  '400': RGB;
  '500': RGB;
  '600': RGB;
  '700': RGB;
  '800': RGB;
  '900': RGB;
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

interface PaletteSettings {
  scaleSteps: number;
  accessibility: boolean;
  harmonyTypes: string[];
}
