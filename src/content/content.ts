import './content.css';

console.log('Reels Master: Content script loaded');

class ReelsMaster {
  private storedVolume: number = 0.5;
  private storedMuted: boolean = false;
  private processedContainers: WeakSet<HTMLElement> = new WeakSet();
  private videoVolumeListeners: WeakMap<HTMLVideoElement, boolean> = new WeakMap();
  private domObserver: MutationObserver | null = null;
  private processedOverlays: WeakSet<HTMLElement> = new WeakSet();
  private videoSeekingListeners: WeakMap<HTMLVideoElement, Set<HTMLInputElement>> = new WeakMap();

  constructor() {
    this.init();
  }

  private init(): void {
    this.loadSettings();
    
    this.setupVideoInterceptor();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  private loadSettings(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['volume', 'muted'], (result) => {
        if (result.volume !== undefined) {
          this.storedVolume = result.volume;
        }
        if (result.muted !== undefined) {
          this.storedMuted = result.muted;
        }
        this.applyVolumeToAllVideos();
        this.updateAllSliders();
      });
    }
  }

  private saveSettings(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        volume: this.storedVolume,
        muted: this.storedMuted
      });
    }
  }

  private start(): void {
    console.log('Reels Master: Starting...');
    this.injectControlsToAllContainers();
    this.injectSeekingToAllOverlays();
    this.setupDOMObserver();
  }

  private setupVideoInterceptor(): void {
    this.applyVolumeToAllVideos();

    const videoObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLVideoElement) {
            this.applyVolumeToVideo(node);
          } else if (node instanceof HTMLElement) {
            const videos = node.querySelectorAll('video');
            videos.forEach(video => this.applyVolumeToVideo(video));
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
    if (!window.location.pathname.includes('/reels/')) return;
    
    document.querySelectorAll('video').forEach(video => {
      this.applyVolumeToVideo(video);
    });
  }

  private applyVolumeToVideo(video: HTMLVideoElement): void {
    if (!window.location.pathname.includes('/reels/')) return;
    
    video.volume = this.storedVolume;
    video.muted = this.storedMuted;

    if (!this.videoVolumeListeners.has(video)) {
      this.videoVolumeListeners.set(video, true);
      
      let changeCount = 0;
      const maxChanges = 10;
      
      const enforceVolume = () => {
        changeCount++;
        if (changeCount <= maxChanges) {
          video.volume = this.storedVolume;
          video.muted = this.storedMuted;
        }
      };

      video.addEventListener('volumechange', enforceVolume);
      video.addEventListener('loadedmetadata', enforceVolume);
      video.addEventListener('play', enforceVolume);
      video.addEventListener('canplay', enforceVolume);
    }
  }

  private setupDOMObserver(): void {
    this.domObserver = new MutationObserver((mutations) => {
      if (!window.location.pathname.includes('/reels/')) return;
      
      let shouldCheck = false;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.querySelector('video') || node.querySelector('svg[aria-label="Like"]')) {
              shouldCheck = true;
              break;
            }
          }
        }
        if (shouldCheck) break;
      }
      
      if (shouldCheck) {
        requestAnimationFrame(() => {
          this.injectControlsToAllContainers();
          this.injectSeekingToAllOverlays();
        });
      }
    });

    this.domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private injectControlsToAllContainers(): void {
    if (!window.location.pathname.includes('/reels/')) return;

    const actionContainers = this.findAllActionContainers();
    
    console.log(`Reels Master: Found ${actionContainers.length} action containers`);

    for (const container of actionContainers) {
      this.injectControlsToContainer(container);
    }
  }

  private readonly LIKE_SELECTORS = [
    'svg[aria-label="Like"]',
    'svg[aria-label="Нравится"]',
    'svg[aria-label="Me gusta"]',
    'svg[aria-label="J\'aime"]',
    'svg[aria-label="Gefällt mir"]',
    'svg[aria-label="いいね！"]',
    'svg[aria-label="赞"]',
  ].join(',');

  private readonly COMMENT_SELECTORS = [
    'svg[aria-label="Comment"]',
    'svg[aria-label="Комментировать"]',
    'svg[aria-label="Comentar"]',
    'svg[aria-label="Commenter"]',
    'svg[aria-label="Kommentieren"]',
    'svg[aria-label="コメントする"]',
    'svg[aria-label="评论"]',
  ].join(',');

  private readonly SHARE_SELECTORS = [
    'svg[aria-label="Share"]',
    'svg[aria-label="Поделиться"]',
    'svg[aria-label="Сделать репост"]',
    'svg[aria-label="Compartir"]',
    'svg[aria-label="Partager"]',
    'svg[aria-label="Teilen"]',
    'svg[aria-label="シェア"]',
    'svg[aria-label="分享"]',
  ].join(',');

  private readonly SAVE_SELECTORS = [
    'svg[aria-label="Save"]',
    'svg[aria-label="Сохранить"]',
    'svg[aria-label="Guardar"]',
    'svg[aria-label="Enregistrer"]',
    'svg[aria-label="Speichern"]',
    'svg[aria-label="保存"]',
  ].join(',');

  private readonly FOLLOW_TEXTS = [
    'Follow',
    'Подписаться',
    'Seguir',
    'Suivre',
    'Folgen',
    'Following',
    'Подписки',
    'Siguiendo',
    'Abonné(e)',
    'Gefolgt',
    'Requested',
    'Запрос отправлен',
    'Solicitado',
    'Demandé',
    'Anfrage gesendet',
    'フォローする',
    '关注',
  ];

  private readonly AVATAR_SELECTORS = [
    'img[alt*="profile picture"]',
    'img[alt*="Фото профиля"]',
    'img[alt*="фото профиля"]',
    'img[alt*="Foto de perfil"]',
    'img[alt*="Photo de profil"]',
    'img[alt*="Profilbild"]',
    'img[alt*="プロフィール写真"]',
    'img[alt*="头像"]',
  ].join(',');
    
  private findAllActionContainers(): HTMLElement[] {
    const containers: HTMLElement[] = [];
    
    const likeButtons = document.querySelectorAll(this.LIKE_SELECTORS);
    
    for (const likeButton of likeButtons) {
      const container = this.findActionContainerFromLikeButton(likeButton);
      if (container && !containers.includes(container)) {
        containers.push(container);
      }
    }
    
    return containers;
  }

  private findActionContainerFromLikeButton(likeButton: Element): HTMLElement | null {
    let parent = likeButton.parentElement;
    
    while (parent) {
      const hasLike = parent.querySelector(this.LIKE_SELECTORS);
      const hasComment = parent.querySelector(this.COMMENT_SELECTORS);
      const hasShare = parent.querySelector(this.SHARE_SELECTORS);
      const hasSave = parent.querySelector(this.SAVE_SELECTORS);
      
      if (hasLike && hasComment && hasShare && hasSave) {
        const children = parent.children;
        if (children.length >= 4) {
          return parent as HTMLElement;
        }
      }
      
      parent = parent.parentElement;
      
      if (parent === document.body) break;
    }
    
    return null;
  }

  private injectControlsToContainer(container: HTMLElement): void {
    if (this.processedContainers.has(container)) {
      return;
    }

    if (container.querySelector('.reels-master-controls')) {
      this.processedContainers.add(container);
      return;
    }

    const controlsContainer = this.createControlsContainer();
    const volumeControl = this.createVolumeControl();
    const downloadButton = this.createDownloadButton(container);
    
    controlsContainer.appendChild(volumeControl);
    controlsContainer.appendChild(downloadButton);
    
    container.insertBefore(controlsContainer, container.firstChild);
    
    this.processedContainers.add(container);
    console.log('Reels Master: Controls injected to container');
  }

  private createControlsContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'reels-master-controls';
    return container;
  }

  private createVolumeControl(): HTMLDivElement {
    const volumeControl = document.createElement('div');
    volumeControl.className = 'reels-master-volume';

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'reels-master-slider-container';
    
    const slider = this.createVolumeSlider();
    sliderContainer.appendChild(slider);

    const volumeButton = document.createElement('button');
    volumeButton.className = 'reels-master-volume-button';
    this.updateVolumeIcon(volumeButton);

    volumeButton.onclick = () => {
      this.storedMuted = !this.storedMuted;
        
      this.saveSettings();
      this.applyVolumeToAllVideos();
      this.updateAllSliders();
      this.updateAllVolumeIcons();
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
    slider.value = this.storedMuted ? '0' : String(this.storedVolume * 100);
    slider.className = 'reels-master-volume-slider';

    slider.oninput = (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.storedVolume = value / 100;
      this.storedMuted = value === 0;
      
      this.saveSettings();
      this.applyVolumeToAllVideos();
      this.updateAllSliders();
      this.updateAllVolumeIcons();
    };

    return slider;
  }

  private updateAllSliders(): void {
    const sliders = document.querySelectorAll('.reels-master-volume-slider') as NodeListOf<HTMLInputElement>;
    const value = this.storedMuted ? '0' : String(this.storedVolume * 100);
    
    sliders.forEach(slider => {
      slider.value = value;
    });
  }

  private updateAllVolumeIcons(): void {
    const buttons = document.querySelectorAll('.reels-master-volume-button') as NodeListOf<HTMLButtonElement>;
    buttons.forEach(button => {
      this.updateVolumeIcon(button);
    });
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

  private createDownloadButton(actionContainer: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'reels-master-download';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    `;
    button.title = 'Download Reel';
    
    button.onclick = () => this.downloadReel(actionContainer, button);

    return button;
  }

  private findVideoForContainer(actionContainer: HTMLElement): HTMLVideoElement | null {
    let parent = actionContainer.parentElement;
    
    while (parent) {
      const video = parent.querySelector('video');
      if (video) {
        return video;
      }
      parent = parent.parentElement;
      
      if (parent === document.body) break;
    }
    
    return this.getClosestVideoToElement(actionContainer);
  }

  private getClosestVideoToElement(element: HTMLElement): HTMLVideoElement | null {
    const elementRect = element.getBoundingClientRect();
    const elementCenterY = elementRect.top + elementRect.height / 2;
    
    const videos = Array.from(document.querySelectorAll('video'));
    let closestVideo: HTMLVideoElement | null = null;
    let minDistance = Infinity;

    for (const video of videos) {
      const rect = video.getBoundingClientRect();
      if (rect.height === 0) continue;

      const videoCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elementCenterY - videoCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestVideo = video;
      }
    }

    return closestVideo;
  }

  private async downloadReel(actionContainer: HTMLElement, button: HTMLButtonElement): Promise<void> {
    const reelUrl = window.location.href;
    
    if (!reelUrl.includes('/reels/')) {
      alert('Unable to detect reel URL');
      return;
    }

    try {
      button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="reels-master-spinner">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/>
          <path d="M12 2v4c4.42 0 8 3.58 8 8h4c0-6.63-5.37-12-12-12z"/>
        </svg>
      `;

      console.log('Reels Master: Sending download request to background for', reelUrl);

      const response = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_REEL',
        url: reelUrl
      });

      console.log('Reels Master: Background response', response);

      if (!response.success) {
        throw new Error(response.error || 'Download failed');
      }

      button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      `;

      setTimeout(() => {
        button.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        `;
      }, 2000);

    } catch (error) {
      console.error('Reels Master: Download failed', error);
      alert('Failed to download video: ' + (error instanceof Error ? error.message : 'Unknown error'));
      
      button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
      `;
    }
  }
  private injectSeekingToAllOverlays(): void {
    if (!window.location.pathname.includes('/reels/')) return;

    const overlayContainers = this.findAllOverlayContainers();
    console.log(`Reels Master: Found ${overlayContainers.length} overlay containers`);

    for (const container of overlayContainers) {
      this.injectSeekingToOverlay(container);
    }
  }

  private findAllOverlayContainers(): HTMLElement[] {
    const containers: HTMLElement[] = [];
    
    const followButtons = document.querySelectorAll('[role="button"]');
    
    for (const button of followButtons) {
      const text = button.textContent?.trim();
      if (text && this.FOLLOW_TEXTS.includes(text)) {
        let parent = button.parentElement;
        let depth = 0;
        const maxDepth = 15;
        
        while (parent && depth < maxDepth) {
          const hasAvatar = parent.querySelector(this.AVATAR_SELECTORS);
          const hasFollow = parent.querySelector('[role="button"]');
          
          if (hasAvatar && hasFollow && parent.children.length >= 2) {
            if (!containers.includes(parent as HTMLElement)) {
              containers.push(parent as HTMLElement);
            }
            break;
          }
          
          parent = parent.parentElement;
          depth++;
        }
      }
    }
    
    return containers;
  }

  private injectSeekingToOverlay(overlayContainer: HTMLElement): void {
    if (this.processedOverlays.has(overlayContainer)) {
      return;
    }

    if (overlayContainer.querySelector('.reels-master-seeking')) {
      this.processedOverlays.add(overlayContainer);
      return;
    }

    const video = this.findVideoForOverlay(overlayContainer);
    if (!video) {
      console.log('Reels Master: Video not found for overlay');
      return;
    }

    const seekingControl = this.createSeekingControl(video);
    overlayContainer.appendChild(seekingControl);
    
    this.processedOverlays.add(overlayContainer);
    console.log('Reels Master: Seeking control injected to overlay');
  }

  private findVideoForOverlay(overlayContainer: HTMLElement): HTMLVideoElement | null {
    let parent = overlayContainer.parentElement;
    
    while (parent) {
      const video = parent.querySelector('video');
      if (video) {
        return video;
      }
      parent = parent.parentElement;
      
      if (parent === document.body) break;
    }
    
    return this.getClosestVideoToElement(overlayContainer);
  }

  private createSeekingControl(video: HTMLVideoElement): HTMLDivElement {
    const seekingContainer = document.createElement('div');
    seekingContainer.className = 'reels-master-seeking';

    seekingContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    seekingContainer.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    seekingContainer.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    });

    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'reels-master-time-display';
    
    const currentTimeSpan = document.createElement('span');
    currentTimeSpan.textContent = '0:00';
    
    const durationSpan = document.createElement('span');
    durationSpan.textContent = '0:00';
    
    timeDisplay.appendChild(currentTimeSpan);
    timeDisplay.appendChild(durationSpan);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';
    slider.className = 'reels-master-seeking-slider';

    slider.addEventListener('click', (e) => e.stopPropagation());
    slider.addEventListener('mousedown', (e) => e.stopPropagation());
    slider.addEventListener('mouseup', (e) => e.stopPropagation());
    slider.addEventListener('touchstart', (e) => e.stopPropagation());
    slider.addEventListener('touchend', (e) => e.stopPropagation());
    slider.addEventListener('touchmove', (e) => e.stopPropagation());

    const updateDuration = () => {
      if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
        slider.max = String(video.duration);
        durationSpan.textContent = this.formatTime(video.duration);
      }
    };

    const updateTime = () => {
      if (!isNaN(video.duration) && video.duration !== Infinity) {
        slider.value = String(video.currentTime);
        currentTimeSpan.textContent = this.formatTime(video.currentTime);
      }
    };

    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('timeupdate', updateTime);

    updateDuration();
    updateTime();

    let isSeeking = false;
    
    slider.addEventListener('input', (e) => {
      const time = parseFloat((e.target as HTMLInputElement).value);
      currentTimeSpan.textContent = this.formatTime(time);
      isSeeking = true;
    });

    slider.addEventListener('change', (e) => {
      const time = parseFloat((e.target as HTMLInputElement).value);
      video.currentTime = time;
      isSeeking = false;
    });

    if (!this.videoSeekingListeners.has(video)) {
      this.videoSeekingListeners.set(video, new Set());
    }
    this.videoSeekingListeners.get(video)!.add(slider);

    seekingContainer.appendChild(timeDisplay);
    seekingContainer.appendChild(slider);

    return seekingContainer;
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity) {
      return '0:00';
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }}

new ReelsMaster();
