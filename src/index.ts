import StackedAlphaVideo from './StackedAlphaVideo';
export default StackedAlphaVideo;

customElements.define('stacked-alpha-video', StackedAlphaVideo);

declare global {
  interface HTMLElementTagNameMap {
    'stacked-alpha-video': StackedAlphaVideo;
  }
}
