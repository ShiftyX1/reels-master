import './content.css';

console.log('Reels Master: Content script loaded');

interface ReelsControls {
  volumeSlider: HTMLInputElement | null;
  downloadButton: HTMLButtonElement | null;
  container: HTMLDivElement | null;
}

class ReelsMaster {
  private currentVideo: HTMLVideoElement | null = null;
  private controls: ReelsControls = {
    volumeSlider: null,
    downloadButton: null,
    container: null
  };
  private observer: MutationObserver | null = null;
  private storedVolume: number | null = null;
  private storedMuted: boolean = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  private start(): void {
    console.log('Reels Master: Starting...');
    this.checkForReels();
    this.observeUrlChanges();
    this.observeDOMChanges();
    window.addEventListener('scroll', () => {
      this.checkForReels();
    }, { passive: true });
  }

  private observeUrlChanges(): void {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('Reels Master: URL changed to', currentUrl);
        setTimeout(() => this.checkForReels(), 500);
      }
    }).observe(document.querySelector('body')!, { 
      subtree: true, 
      childList: true 
    });
  }

  private observeDOMChanges(): void {
    this.observer = new MutationObserver(() => {
      this.checkForReels();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private checkForReels(): void {
    if (!window.location.pathname.includes('/reels/')) {
      this.cleanup();
      return;
    }

    const video = this.getActiveVideo();
    if (!video || video === this.currentVideo) {
      return;
    }

    console.log('Reels Master: Found new video element');
    this.currentVideo = video;
    this.injectControls();
  }

  private getActiveVideo(): HTMLVideoElement | null {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;

    const center = window.innerHeight / 2;
    let closestVideo: HTMLVideoElement | null = null;
    let minDistance = Infinity;

    for (const video of videos) {
      const rect = video.getBoundingClientRect();
      if (rect.height === 0) continue;

      const videoCenter = rect.top + (rect.height / 2);
      const distance = Math.abs(center - videoCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestVideo = video;
      }
    }

    return closestVideo;
  }

  private injectControls(): void {
    if (!this.currentVideo) return;

    const actionButtons = this.findActionButtonsContainer();
    if (!actionButtons) {
      console.log('Reels Master: Action buttons container not found');
      setTimeout(() => this.injectControls(), 1000);
      return;
    }

    if (this.controls.container) {
      this.controls.container.remove();
    }

    this.controls.container = this.createControlsContainer();
    this.controls.volumeSlider = this.createVolumeSlider();
    this.controls.downloadButton = this.createDownloadButton();
    this.controls.container.appendChild(this.createVolumeControl());
    this.controls.container.appendChild(this.controls.downloadButton);
    actionButtons.insertBefore(this.controls.container, actionButtons.firstChild);

    if (this.storedVolume !== null && this.currentVideo) {
      this.currentVideo.volume = this.storedVolume;
    }
    if (this.currentVideo) {
      this.currentVideo.muted = this.storedMuted;
    }

    console.log('Reels Master: Controls injected');
  }

  private findActionButtonsContainer(): HTMLElement | null {
    const likeButton = document.querySelector('svg[aria-label="Like"]');
    if (likeButton) {
      let parent = likeButton.parentElement;
      while (parent) {
        const childDivs = parent.querySelectorAll(':scope > div');
        if (childDivs.length >= 3) {
          const hasLike = parent.querySelector('svg[aria-label="Like"]');
          const hasComment = parent.querySelector('svg[aria-label="Comment"]');
          const hasShare = parent.querySelector('svg[aria-label="Share"]');
          
          if (hasLike && hasComment && hasShare) {
            return parent as HTMLElement;
          }
        }
        parent = parent.parentElement;
      }
    }

    return null;
  }

  private createControlsContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'reels-master-controls';
    return container;
  }

  private createVolumeControl(): HTMLDivElement {
    const volumeControl = document.createElement('div');
    volumeControl.className = 'reels-master-volume';

    const volumeButton = document.createElement('button');
    volumeButton.className = 'reels-master-volume-button';
    volumeButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
    `;

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'reels-master-slider-container';
    
    this.controls.volumeSlider = this.createVolumeSlider();
    sliderContainer.appendChild(this.controls.volumeSlider);
    
    volumeButton.onclick = () => {
      if (this.currentVideo) {
        this.currentVideo.muted = !this.currentVideo.muted;
        this.storedMuted = this.currentVideo.muted;

        if (this.controls.volumeSlider) {
          this.controls.volumeSlider.value = this.currentVideo.muted ? '0' : String(this.currentVideo.volume * 100);
        }
        this.updateVolumeIcon(volumeButton);
      }
    };

    volumeControl.appendChild(sliderContainer);
    volumeControl.appendChild(volumeButton);

    return volumeControl;
  }

  private createVolumeSlider(): HTMLInputElement {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    
    let initialValue = '50';
    if (this.currentVideo) {
      if (this.currentVideo.muted) {
        initialValue = '0';
      } else {
        initialValue = String(this.currentVideo.volume * 100);
      }
    }
    slider.value = initialValue;
    
    slider.className = 'reels-master-volume-slider';

    slider.oninput = (e) => {
      if (this.currentVideo) {
        const value = parseInt((e.target as HTMLInputElement).value);
        this.currentVideo.volume = value / 100;
        this.currentVideo.muted = value === 0;
        
        this.storedVolume = this.currentVideo.volume;
        this.storedMuted = this.currentVideo.muted;
        
        const volumeControl = slider.closest('.reels-master-volume');
        const volumeButton = volumeControl?.querySelector('.reels-master-volume-button') as HTMLButtonElement;
        if (volumeButton) {
          this.updateVolumeIcon(volumeButton);
        }
      }
    };

    return slider;
  }

  private updateVolumeIcon(button: HTMLButtonElement): void {
    if (!this.currentVideo) return;

    const volume = this.currentVideo.muted ? 0 : this.currentVideo.volume;
    
    let icon = '';
    if (volume === 0) {
      icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>`;
    } else if (volume < 0.5) {
      icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 9v6h4l5 5V4l-5 5H7z"/>
      </svg>`;
    } else {
      icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>`;
    }
    
    button.innerHTML = icon;
  }

  private createDownloadButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'reels-master-download';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    `;
    button.title = 'Download Reel';
    
    button.onclick = () => this.downloadReel();

    return button;
  }

  private async downloadReel(): Promise<void> {
    if (!this.currentVideo) {
      console.error('Reels Master: No video found');
      return;
    }

    try {
      const videoUrl = this.currentVideo.src;
      
      if (!videoUrl) {
        alert('Unable to find video URL');
        return;
      }

      if (this.controls.downloadButton) {
        this.controls.downloadButton.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        `;
      }

      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `reel_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => {
        if (this.controls.downloadButton) {
          this.controls.downloadButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          `;
        }
      }, 2000);

    } catch (error) {
      console.error('Reels Master: Download failed', error);
      alert('Failed to download video. Please try again.');
      
      if (this.controls.downloadButton) {
        this.controls.downloadButton.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        `;
      }
    }
  }

  private cleanup(): void {
    if (this.controls.container) {
      this.controls.container.remove();
      this.controls.container = null;
      this.controls.volumeSlider = null;
      this.controls.downloadButton = null;
    }
    this.currentVideo = null;
  }
}

new ReelsMaster();
