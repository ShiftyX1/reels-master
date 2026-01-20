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
  private storedVolume: number = 0.5;
  private storedMuted: boolean = false;
  private videoVolumeListeners: WeakMap<HTMLVideoElement, () => void> = new WeakMap();

  constructor() {
    this.init();
  }

  private init(): void {
    // Сразу начинаем следить за всеми видео для мгновенного применения громкости
    this.setupGlobalVideoInterceptor();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  // Перехватываем все видео сразу при их появлении и применяем сохраненную громкость
  private setupGlobalVideoInterceptor(): void {
    // Применяем к уже существующим видео
    this.applyVolumeToAllVideos();

    // Следим за новыми видео через MutationObserver
    const videoObserver = new MutationObserver((mutations) => {
      let hasNewVideo = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLVideoElement) {
            hasNewVideo = true;
            this.applyVolumeToVideo(node);
          } else if (node instanceof HTMLElement) {
            const videos = node.querySelectorAll('video');
            if (videos.length > 0) {
              hasNewVideo = true;
              videos.forEach(video => this.applyVolumeToVideo(video));
            }
          }
        }
      }
    });

    videoObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  private applyVolumeToAllVideos(): void {
    document.querySelectorAll('video').forEach(video => {
      this.applyVolumeToVideo(video);
    });
  }

  private applyVolumeToVideo(video: HTMLVideoElement): void {
    if (!window.location.pathname.includes('/reels/')) return;
    
    // Применяем сохраненную громкость
    video.volume = this.storedVolume;
    video.muted = this.storedMuted;

    // Добавляем слушатель на случай если Instagram перезапишет громкость
    if (!this.videoVolumeListeners.has(video)) {
      const listener = () => {
        // Если громкость изменилась не нами, восстанавливаем
        if (Math.abs(video.volume - this.storedVolume) > 0.01 || video.muted !== this.storedMuted) {
          video.volume = this.storedVolume;
          video.muted = this.storedMuted;
        }
      };
      
      // Слушаем первые несколько изменений громкости для борьбы с Instagram
      let volumeChangeCount = 0;
      const tempListener = () => {
        volumeChangeCount++;
        if (volumeChangeCount <= 5) {
          video.volume = this.storedVolume;
          video.muted = this.storedMuted;
        } else {
          video.removeEventListener('volumechange', tempListener);
        }
      };
      
      video.addEventListener('volumechange', tempListener);
      video.addEventListener('loadedmetadata', listener);
      video.addEventListener('play', listener);
      this.videoVolumeListeners.set(video, listener);
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
        // Сразу применяем громкость ко всем видео
        this.applyVolumeToAllVideos();
        setTimeout(() => this.checkForReels(), 300);
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
    
    // Убедимся что громкость применена к текущему видео
    this.applyVolumeToVideo(video);
    
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

    // Ищем контейнер кнопок рядом с ТЕКУЩИМ видео, а не глобально
    const actionButtons = this.findActionButtonsContainer(this.currentVideo);
    if (!actionButtons) {
      console.log('Reels Master: Action buttons container not found');
      setTimeout(() => this.injectControls(), 500);
      return;
    }

    // Проверяем, есть ли уже наши контролы в этом контейнере
    const existingControls = actionButtons.querySelector('.reels-master-controls');
    if (existingControls) {
      console.log('Reels Master: Controls already exist in this container');
      return;
    }

    // Удаляем старые контролы из предыдущего контейнера
    if (this.controls.container && this.controls.container.parentElement !== actionButtons) {
      this.controls.container.remove();
    }

    this.controls.container = this.createControlsContainer();
    this.controls.volumeSlider = this.createVolumeSlider();
    this.controls.downloadButton = this.createDownloadButton();
    this.controls.container.appendChild(this.createVolumeControl());
    this.controls.container.appendChild(this.controls.downloadButton);
    actionButtons.insertBefore(this.controls.container, actionButtons.firstChild);

    // Синхронизируем слайдер с текущей громкостью
    if (this.controls.volumeSlider) {
      this.controls.volumeSlider.value = String(this.storedVolume * 100);
    }

    console.log('Reels Master: Controls injected');
  }

  // Ищем контейнер кнопок относительно конкретного видео
  private findActionButtonsContainer(video: HTMLVideoElement): HTMLElement | null {
    // Ищем родительский контейнер рила для данного видео
    let reelContainer = video.closest('article') || video.closest('[role="presentation"]');
    
    if (!reelContainer) {
      // Пробуем найти родителя вверх по дереву
      let parent = video.parentElement;
      for (let i = 0; i < 10 && parent; i++) {
        if (parent.querySelector('svg[aria-label="Like"]')) {
          reelContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }

    if (!reelContainer) {
      reelContainer = document.body;
    }

    // Ищем кнопку лайка внутри контейнера текущего рила
    const likeButton = reelContainer.querySelector('svg[aria-label="Like"]');
    if (likeButton) {
      let parent = likeButton.parentElement;
      while (parent && parent !== reelContainer) {
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
        this.storedMuted = !this.storedMuted;
        
        // Применяем ко всем видео
        this.applyVolumeToAllVideos();

        if (this.controls.volumeSlider) {
          this.controls.volumeSlider.value = this.storedMuted ? '0' : String(this.storedVolume * 100);
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
    
    // Используем сохраненную громкость
    slider.value = String(this.storedVolume * 100);
    
    slider.className = 'reels-master-volume-slider';

    slider.oninput = (e) => {
      if (this.currentVideo) {
        const value = parseInt((e.target as HTMLInputElement).value);
        const newVolume = value / 100;
        const newMuted = value === 0;
        
        // Сохраняем настройки
        this.storedVolume = newVolume;
        this.storedMuted = newMuted;
        
        // Применяем ко всем видео сразу
        this.applyVolumeToAllVideos();
        
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
    const volume = this.storedMuted ? 0 : this.storedVolume;
    
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
