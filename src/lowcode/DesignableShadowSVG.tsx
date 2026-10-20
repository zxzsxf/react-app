import React, { useEffect, useRef } from 'react';

interface ShadowSVGProps {
  content?: string;
  width?: number | string;
  height?: number | string;
}

const cssSize = (value?: number | string) =>
  value !== undefined && /^[\d.]+$/.test(String(value)) ? `${value}px` : value;

export const DesignableShadowSVG: React.FC<ShadowSVGProps> = ({ content, width, height }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // React 18 StrictMode replays effects on the same host; Shadow Roots cannot be detached.
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.innerHTML = `<svg viewBox="0 0 1024 1024" style="width:${cssSize(width)};height:${cssSize(height)}">${content || ''}</svg>`;
  }, [content, width, height]);
  return <div ref={ref} />;
};
