import { drawVideo, setupGLContext, setPremultipliedAlpha } from './gl-helpers';

const styles = new CSSStyleSheet();
styles.replaceSync(`
  :host {
    display: inline-block;
    height: auto;
  }

  canvas {
    display: block;
    width: inherit;
    object-fit: inherit;
    aspect-ratio: inherit;
    height: inherit;
  }
`);

function videoIsPlaying(video: HTMLVideoElement): boolean {
  return !video.paused && !video.ended && video.readyState > 2;
}

interface State {
  videoPlaying: boolean;
  intersecting: boolean;
  connected: boolean;
}

export default class StackedAlphaVideo extends HTMLElement {
  static observedAttributes = ['premultipliedalpha'];

  #shadow = this.attachShadow({ mode: 'closed' });
  #canvas = document.createElement('canvas');
  #context: WebGLRenderingContext | null = null;
  #video: HTMLVideoElement | null = null;

  constructor() {
    super();
    this.#shadow.adoptedStyleSheets = [styles];
    this.#shadow.append(this.#canvas);

    try {
      this.#context = setupGLContext(this.#canvas);
    } catch (err) {
      console.warn("<stacked-alpha-video> Couldn't create GL context");
    }

    new IntersectionObserver(([entry]) => {
      this.#updateState({ intersecting: entry.isIntersecting });
    }).observe(this);

    new MutationObserver(() => {
      if (this.firstElementChild !== this.#video) {
        this.#videoChange(this.firstElementChild);
      }
    }).observe(this, {
      childList: true,
    });

    this.#videoChange(this.firstElementChild);
  }

  #frameHandle = 0;

  #frame = () => {
    if (!this.#context || !this.#video) return;
    drawVideo(this.#context, this.#video);
    this.#frameHandle = requestAnimationFrame(this.#frame);
  };

  #state: State = {
    videoPlaying: false,
    intersecting: false,
    connected: false,
  };

  #pendingStateUpdate = false;

  #updateState(newState: Partial<State>) {
    Object.assign(this.#state, newState);

    if (this.#pendingStateUpdate) return;
    this.#pendingStateUpdate = true;

    // Queue a microtask to pick up multiple state changes in one.
    queueMicrotask(() => {
      this.#pendingStateUpdate = false;
      const { videoPlaying, connected, intersecting } = this.#state;

      cancelAnimationFrame(this.#frameHandle);

      if (!connected || !videoPlaying || !intersecting || !this.#context) {
        return;
      }

      this.#frameHandle = requestAnimationFrame(this.#frame);
    });
  }

  #videoListenersController: AbortController | null = null;

  #videoChange(newVideo: Element | null) {
    if (this.#videoListenersController) this.#videoListenersController.abort();

    if (newVideo && !(newVideo instanceof HTMLVideoElement)) {
      console.warn('<stacked-alpha-video> Child must be a <video>');
      this.#video = null;
      this.#updateState({ videoPlaying: false });
      return;
    }

    this.#video = newVideo;

    if (!newVideo) {
      this.#updateState({ videoPlaying: false });
      return;
    }

    if (newVideo.autoplay) newVideo.play();

    const videoUpdate = () => {
      this.#updateState({ videoPlaying: videoIsPlaying(newVideo) });
    };

    videoUpdate();

    this.#videoListenersController = new AbortController();
    const signal = this.#videoListenersController.signal;

    for (const event of ['playing', 'stalled', 'emptied', 'ended', 'pause']) {
      newVideo.addEventListener(event, videoUpdate, { signal });
    }
  }

  connectedCallback() {
    this.#updateState({ connected: true });
  }

  disconnectedCallback() {
    this.#updateState({ connected: false });
  }

  attributeChangedCallback(name: string, _: string, newValue: string) {
    if (name === 'premultipliedalpha') {
      if (!this.#context) return;
      setPremultipliedAlpha(this.#context, newValue !== null);
    }
  }

  get premultipliedAlpha() {
    return this.hasAttribute('premultipliedalpha');
  }

  /**
   * Set whether the source video uses premultiplied alpha.
   *
   * Set this to `true` if semi-transparent areas or outlines look too dark.
   */
  set premultipliedAlpha(value) {
    if (value) {
      this.setAttribute('premultipliedalpha', '');
    } else {
      this.removeAttribute('premultipliedalpha');
    }
  }
}
