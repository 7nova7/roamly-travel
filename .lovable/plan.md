
# Background Video on Landing Page Hero

## What Changes

The uploaded bird's-eye-view travel video will play as a fullscreen looping background behind the hero section (headline + trip form). A dark overlay ensures text and form inputs remain readable. The video auto-plays muted, loops infinitely, and covers the entire hero area responsively on both desktop and mobile.

## Visual Effect

- Video fills the entire hero section behind the heading, subtitle, and trip form card
- A semi-transparent dark gradient overlay sits between the video and the content for contrast
- The existing blurred circle decorations are removed (the video replaces them)
- The trip form card gets a slightly stronger background blur so inputs stay crisp
- Heading and subtitle text switch to white/light colors for readability over the video

## Technical Details

### File: `public/videos/hero-bg.mp4`
- Copy the uploaded video to the public directory so it can be referenced via a simple URL path (video files are too large for ES module imports)

### File: `src/pages/LandingPage.tsx`
- Replace the existing decorative blur divs (lines 45-48) with a `<video>` element and overlay `<div>`
- Video element attributes: `autoPlay`, `muted`, `loop`, `playsInline` (critical for iOS), `preload="auto"`
- Styled with `object-cover` to fill the section without distortion, positioned absolutely with `inset-0` and `z-[-2]`
- Dark overlay div positioned absolutely with `inset-0`, `z-[-1]`, using `bg-black/50` for readability
- Update heading/subtitle text colors to white (`text-white`) so they pop against the dark video
- Add `backdrop-blur-md bg-white/10` or strengthen the existing card background to `bg-card/90 backdrop-blur-xl` for the form

### Responsive Considerations
- `object-cover` ensures the video crops gracefully on tall mobile screens
- `playsInline` prevents iOS from hijacking the video into fullscreen
- Video is muted so autoplay works on all browsers without user interaction (browser policy requirement)
- No performance impact on scrolling since the video is contained within the hero section only
