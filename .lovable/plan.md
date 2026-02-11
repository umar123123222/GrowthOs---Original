

## Fix Video Popup Not Playing on Live Sessions Page

### Problem
When clicking "Watch Now" on a completed live session, the video opens in a new tab instead of playing in the popup dialog. The code logic is correct but has a reliability issue: the iframe `src` is set via a `ref` in a `useEffect`, which can fail due to timing (ref not attached when effect runs).

### Solution
Change `VideoPreviewDialog.tsx` to set the iframe `src` directly as a prop instead of relying on `useEffect` + `ref`. This is more reliable and follows standard React patterns.

### Changes

**File: `src/components/VideoPreviewDialog.tsx`**

1. Compute the embed URL as a derived value (not in useEffect)
2. Pass it directly as the iframe `src` attribute instead of using `iframeRef.current.src`
3. Remove the `useRef` and the useEffect that sets `src` -- simplify the component
4. Keep the sanitization, embed conversion, and error handling logic as-is

The key change is replacing:
```tsx
// OLD: setting src via ref in useEffect (unreliable)
useEffect(() => {
  if (open && recordingUrl && iframeRef.current) {
    const embedUrl = convertToEmbedUrl(sanitizeVideoUrl(recordingUrl));
    iframeRef.current.src = embedUrl;
  }
}, [open, recordingUrl, iframeKey]);
```

With:
```tsx
// NEW: compute embed URL directly, pass as prop
const embedUrl = open && recordingUrl 
  ? convertToEmbedUrl(sanitizeVideoUrl(recordingUrl)) 
  : '';

// In JSX:
<iframe src={embedUrl} ... />
```

This ensures the iframe always gets the correct embed URL when the dialog opens, eliminating the timing issue.

### Technical Details
- Remove `useRef` for iframe
- Remove the `useEffect` that sets iframe src
- Keep the error-handling `useEffect` that checks for invalid URLs
- Keep `iframeKey` for the reload button functionality
- The `convertToEmbedUrl` function correctly handles YouTube URLs (converts to `/embed/` format which allows iframe embedding)

