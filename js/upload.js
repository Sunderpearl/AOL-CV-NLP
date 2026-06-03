// ========================================
// FreshScan GPT — Image Upload Handler
// ========================================

class ImageUploader {
  constructor() {
    this.maxSizeMB = 10;
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    this.currentFile = null;
    this.currentPreviewUrl = null;
  }

  // Validate the file
  validate(file) {
    if (!file) return { valid: false, error: 'No file selected' };
    
    if (!this.allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Please upload an image (JPG, PNG, WebP, or GIF)' };
    }
    
    if (file.size > this.maxSizeMB * 1024 * 1024) {
      return { valid: false, error: `Image must be smaller than ${this.maxSizeMB}MB` };
    }
    
    return { valid: true };
  }

  // Create preview URL
  createPreview(file) {
    if (this.currentPreviewUrl) {
      URL.revokeObjectURL(this.currentPreviewUrl);
    }
    this.currentFile = file;
    this.currentPreviewUrl = URL.createObjectURL(file);
    return this.currentPreviewUrl;
  }

  // Read file as data URL (for display in chat)
  readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // Compress image if too large
  async compress(file, maxWidth = 1200) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // If already small enough, return original
        if (img.width <= maxWidth && file.size <= 2 * 1024 * 1024) {
          resolve(file);
          return;
        }

        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          const compressed = new File([blob], file.name, { type: 'image/jpeg' });
          resolve(compressed);
        }, 'image/jpeg', 0.85);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  // Clear current file
  clear() {
    if (this.currentPreviewUrl) {
      URL.revokeObjectURL(this.currentPreviewUrl);
    }
    this.currentFile = null;
    this.currentPreviewUrl = null;
  }

  // Setup drag and drop on an element
  setupDragDrop(dropZone, onDrop) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(event => {
      dropZone.addEventListener(event, () => {
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, () => {
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onDrop(files[0]);
      }
    });
  }
}

// Global instance
const imageUploader = new ImageUploader();
