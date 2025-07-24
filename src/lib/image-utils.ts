// Helper functions for handling image paths in the application

/**
 * Normalizes image paths to ensure they point to the correct location
 * @param imagePath The original image path
 * @returns A normalized image path that correctly points to the image
 */
export function normalizeImagePath(imagePath: string | null): string {
  if (!imagePath) {
    // If no image path is provided, use a fallback image
    return '/images/Simplified Logo.png';
  }
  
  // Handle absolute URLs (http/https) - return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Handle Whop asset URLs specifically
  if (imagePath.includes('assets.whop.com') || imagePath.includes('img-v2-prod.whop.com')) {
    return imagePath;
  }
  
  // Fix ONLY clearly broken paths that include 'public/images'
  if (imagePath.includes('public/images/')) {
    return imagePath.replace('/images/public/images/', '/images/').replace('public/images/', '/images/');
  }
  
  // Handle AVIF optimized files - prefer original if @avif suffix exists
  if (imagePath.includes('@avif')) {
    // For production compatibility, try the original file first (without @avif)
    const originalPath = imagePath.replace('@avif', '');
    console.log(`🖼️ Image has @avif suffix: ${imagePath} → trying original: ${originalPath}`);
    return originalPath;
  }
  
  // If path already starts with /images/ or /uploads/, preserve it exactly as is
  if (imagePath.startsWith('/images/') || imagePath.startsWith('/uploads/')) {
    return imagePath;
  }
  
  // Fix paths that include just 'images/' without leading slash
  if (imagePath.startsWith('images/')) {
    return `/${imagePath}`;
  }
  
  // For casino logo images, check if file exists in /images directory by name
  if (imagePath.includes('Logo') || imagePath.toLowerCase().includes('logo')) {
    // Try to use the correct path format for logo files
    const filename = imagePath.split('/').pop();
    if (filename) {
      // Handle both formats: with or without spaces, with or without .png extension
      const normalizedFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
      return `/images/${normalizedFilename}`;
    }
  }
  
  // For uploaded files, ensure they're in uploads directory
  if (imagePath.startsWith('/')) {
    // Path already has leading slash, return as is
    return imagePath;
  }
  
  // If it's just a filename, first try as a logo in images folder
  if (!imagePath.includes('/')) {
    const casinoName = imagePath.replace(/[^a-zA-Z0-9]/g, ''); // Remove non-alphanumeric chars
    
    // Try different variations of logo filename patterns
    const possibleLogoFiles = [
      `/images/${imagePath}.png`,
      `/images/${imagePath} Logo.png`,
      `/images/${casinoName} Logo.png`,
      `/images/${casinoName}Logo.png`
    ];
    
    // Default to first pattern, but in production you might want to check if files exist
    return possibleLogoFiles[0];
  }
  
  // If all else fails, assume it's in the uploads folder
  return `/uploads/${imagePath}`;
}

/**
 * Get alternative image paths to try when the primary image fails to load
 * @param imagePath The original image path
 * @returns Array of alternative paths to try
 */
export function getImageFallbackPaths(imagePath: string): string[] {
  if (!imagePath) {
    return ['/images/Simplified Logo.png'];
  }

  const fallbackPaths: string[] = [];
  
  // FIRST: If the path has @avif suffix, try without it first (most common production issue)
  if (imagePath.includes('@avif')) {
    const pathWithoutAvif = imagePath.replace('@avif', '');
    fallbackPaths.push(pathWithoutAvif);
    console.log(`🔄 Adding fallback without @avif: ${pathWithoutAvif}`);
  }
  
  // SECOND: Try the original normalized path
  const normalizedOriginal = normalizeImagePath(imagePath);
  if (!fallbackPaths.includes(normalizedOriginal)) {
    fallbackPaths.push(normalizedOriginal);
  }
  
  // THIRD: Always include the exact original path as stored in database
  if (!fallbackPaths.includes(imagePath)) {
    fallbackPaths.push(imagePath);
  }
  
  // FOURTH: For uploads paths, try additional variations
  if (imagePath.startsWith('/uploads/')) {
    // Try different extension variations
    const basePathWithoutExt = imagePath.replace(/\.[^/.]+$/, '').replace('@avif', '');
    const extensions = ['.webp', '.png', '.jpg', '.jpeg', '.avif'];
    
    extensions.forEach(ext => {
      const pathWithExt = `${basePathWithoutExt}${ext}`;
      if (!fallbackPaths.includes(pathWithExt)) {
        fallbackPaths.push(pathWithExt);
      }
    });
    
    // Try with @avif suffix if it doesn't have it
    if (!imagePath.includes('@avif')) {
      fallbackPaths.push(`${imagePath}@avif`);
    }
  }
  
  // FINAL: Default logo fallback
  fallbackPaths.push('/images/Simplified Logo.png');
  
  console.log(`🖼️ Generated ${fallbackPaths.length} fallback paths for: ${imagePath}`);
  return fallbackPaths;
}