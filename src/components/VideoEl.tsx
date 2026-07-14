import { forwardRef } from 'react';
import type { VideoHTMLAttributes } from 'react';
import { useVideoBlob } from '../utils/useVideoBlob';

interface Props extends Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  src: string;
}

// Drop-in <video> replacement that resolves src through the shared
// videoBlob cache. Bypasses the CDN's wrong Content-Type and dedupes
// network requests across all <VideoEl> instances with the same src.
const VideoEl = forwardRef<HTMLVideoElement, Props>(({ src, ...rest }, ref) => {
  const blobSrc = useVideoBlob(src);
  return <video ref={ref} src={blobSrc} {...rest} />;
});

VideoEl.displayName = 'VideoEl';
export default VideoEl;
