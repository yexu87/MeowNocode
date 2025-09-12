import React, { useEffect, useRef } from 'react';

// Lightweight audio waveform visualizer for a live MediaStream
// Props:
// - stream: MediaStream | null
// - width, height: canvas size
// - className: optional classes
// - style: optional style
export default function AudioWaveform({ stream, width = 90, height = 20, className = '', style = {} }) {
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const rafRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    // teardown helper
    const cleanup = () => {
      try { cancelAnimationFrame(rafRef.current); } catch {}
      rafRef.current = null;
      try { sourceRef.current && sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
      try { audioCtxRef.current && audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
    };

    if (!stream) { cleanup(); return; }

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const dataArray = new Uint8Array(analyser.fftSize);
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      sourceRef.current = source;

      const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const c = canvas.getContext('2d');
        if (!c) return;
        const w = canvas.width, h = canvas.height;
        c.clearRect(0, 0, w, h);
        const analyser = analyserRef.current;
        const arr = dataArrayRef.current;
        if (!analyser || !arr) return;
        analyser.getByteTimeDomainData(arr);
        // draw as vertical bars
        const bars = 24;
        const step = Math.floor(arr.length / bars);
        const barWidth = Math.max(2, Math.floor((w - bars) / bars));
        for (let i = 0; i < bars; i++) {
          const idx = i * step;
          const v = arr[idx] / 128.0; // 0..2
          const amp = Math.max(1, Math.min(h, Math.floor((v - 1) * h * 0.9 + h * 0.5)));
          const x = i * (barWidth + 1);
          const y = Math.floor((h - amp) / 2);
          c.fillStyle = '#8b8b8b';
          c.fillRect(x, y, barWidth, amp);
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();

      return cleanup;
    } catch (e) {
      console.warn('AudioWaveform setup failed:', e);
    }
  }, [stream]);

  return (
    <canvas ref={canvasRef} width={width} height={height} className={className} style={style} />
  );
}

