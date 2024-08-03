import StackedAlphaVideo from './StackedAlphaVideo.js';
export default StackedAlphaVideo;

customElements.define('stacked-alpha-video', StackedAlphaVideo);

declare global {
  interface HTMLElementTagNameMap {
    'stacked-alpha-video': StackedAlphaVideo;
  }
}
