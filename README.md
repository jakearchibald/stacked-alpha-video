# <stacked-alpha-video>

A web component for rendering video with transparency, efficiently.

## Why?

Although VP9 and HEVC support alpha transparency natively, they're old codecs and their encoders perform poorly compared to AV1. This component lets you use AV1 if the video is encoded in a particular way (see below). The result is a file half the size or smaller than the VP9 equivalent, and waayyy smaller than the HEVC.

## Encoding the video

The resulting video is double the height of the original, with the YUV data (brightness and color) in the top half, and the alpha data (represented as brightness) in the bottom half.

To do that with [ffmpeg](https://ffmpeg.org/), the filter is:

```
-filter_complex "[0:v]format=pix_fmts=yuva444p[main]; [main]split[main][alpha]; [alpha]alphaextract[alpha]; [main][alpha]vstack"
```

Breaking it up step by step:

1. `[0:v]format=pix_fmts=yuva444p[main]` convert to a predictable format.
2. `[main]split[main][alpha]` fork the output.
3. `[alpha]alphaextract[alpha]` with the 'alpha' fork, pull the alpha data out to luma data, creating a black & white view of the transparency.
4. `[main][alpha]vstack` stack the 'main' and 'alpha' forks on top of each other.

### Encoding AV1

This is the ideal format, used by Chrome, Firefox, and Safari on iPhone 15 Pro or M3 MacBook Pro & newer.

```sh
INPUT="in.mov" OUTPUT="av1.mp4" CRF=45 CPU=3 bash -c 'ffmpeg -y -i "$INPUT" -filter_complex "[0:v]format=pix_fmts=yuva444p[main]; [main]split[main][alpha]; [alpha]alphaextract[alpha]; [main][alpha]vstack" -pix_fmt yuv420p -an -c:v libaom-av1 -cpu-used "$CPU" -crf "$CRF" -pass 1 -f null /dev/null && ffmpeg -y -i "$INPUT" -filter_complex "[0:v]format=pix_fmts=yuva444p[main]; [main]split[main][alpha]; [alpha]alphaextract[alpha]; [main][alpha]vstack" -pix_fmt yuv420p -an -c:v libaom-av1 -cpu-used "$CPU" -crf "$CRF" -pass 2 -movflags +faststart "$OUTPUT"'
```

- `CRF` (0-63): Lower values are higher quality, larger filesize.
- `CPU` (0-8): Weirdly, _lower_ values use more CPU, which improves quality, but encodes much slower. I wouldn't go lower than 3.

### Encoding HEVC

For Safari on other devices, they need a less-efficient HEVC.

```sh
INPUT="in.mov" OUTPUT="hevc.mp4" CRF=30 PRESET="veryslow" bash -c 'ffmpeg -y -i "$INPUT" -filter_complex "[0:v]format=pix_fmts=yuva444p[main]; [main]split[main][alpha]; [alpha]alphaextract[alpha]; [main][alpha]vstack" -pix_fmt yuv420p -an -c:v libx265 -preset "$PRESET" -crf "$CRF" -tag:v hvc1 -movflags +faststart "$OUTPUT"'
```

- `CRF` (0-63): Lower values are higher quality, larger filesize.
- `PRESET` (`medium`, `slow`, `slower`, `veryslow`): The slower you go, the better the output.

I find I have to go with a much lower CRF than with the AV1.

## Using the web component

If you're using a build script and NPM, install the package:

```sh
npm install stacked-alpha-video
```

And create a bundle with the component:

```js
import 'stacked-alpha-video';
```

With that script running on a page, you can use HTML like this:

```html
<stacked-alpha-video>
  <video autoplay crossorigin muted playsinline loop>
    <source
      src="av1.mp4"
      type="video/mp4; codecs=av01.0.08M.08.0.110.01.01.01.1"
    />
    <source src="hevc.mp4" type="video/mp4; codecs=hvc1.1.6.H120.b0" />
  </video>
</stacked-alpha-video>
```

The component just consumes frames from the inner `<video>`, so if you want to control playback, do that via the inner `<video>` element.

I also recommend including this bit of CSS to give the component a stable render before the JS loads:

```css
stacked-alpha-video {
  display: inline-block;
}

stacked-alpha-video video {
  display: none;
}
```

And as you would/should with `<video>`, give each `stacked-alpha-video` an [`aspect-ratio`](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio) so it reserves space for the video while it loads, avoiding a layout shift.

## Transparency looking too dark?

This happens if the color data is premultiplied with the alpha channel. Not to worry, there's an attribute for that!

```html
<stacked-alpha-video premultipliedalpha>
  …
</stacked-alpha-video>
```

Alternatively, you could unpremultiply the alpha channel when you encode the video. Here's the alternate filter:

```
-filter_complex "[0:v]format=pix_fmts=yuva444p[main]; [main]unpremultiply=inplace=1[main] [main]split[main][alpha]; [alpha]alphaextract[alpha]; [main][alpha]vstack"
```

## Want to give the component a different tag name?

Sure!

```js
import StackedAlphaVideo from 'stacked-alpha-video/StackedAlphaVideo';
customElements.define("whatever-you-want", StackedAlphaVideo);
```

## Don't want to use a web component?

Sure! The low-level parts are available too:

```js
import { setupGLContext, setPremultipliedAlpha, drawVideo } from 'stacked-alpha-video/gl-helpers';

const canvas = document.createElement('canvas');

// Append the canvas wherever you want
document.body.append(canvas);

const ctx = setupGLContext(canvas);

// This is the equivalent of using the premultipliedalpha attribute
// setPremultipliedAlpha(ctx, true);

// Get a reference to a <video>
const video = document.querySelector('video.my-video');

// Then call this whenever you want to render a frame of the video
drawVideo(ctx, video);
```
