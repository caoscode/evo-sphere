import { useEffect, useRef } from "react";

interface SparklineProps {
  data: number[];
  width: number;
  height: number;
  color: string;
  label: string;
  minY?: number;
  maxY?: number;
}

export function Sparkline({ data, width, height, color, label, minY, maxY }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const dataMin = minY ?? Math.min(...data);
    const dataMax = maxY ?? Math.max(...data);
    const range = dataMax - dataMin || 1;
    const pad = 2;
    const plotH = height - pad * 2;
    const plotW = width - pad * 2;

    const toX = (i: number) => pad + (i / (data.length - 1)) * plotW;
    const toY = (v: number) => pad + plotH - ((v - dataMin) / range) * plotH;

    // Filled gradient area
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color + "40");
    gradient.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.moveTo(toX(0), height);
    for (let i = 0; i < data.length; i++) {
      ctx.lineTo(toX(i), toY(data[i]));
    }
    ctx.lineTo(toX(data.length - 1), height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(toX(i), toY(data[i]));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Current value dot
    const lastX = toX(data.length - 1);
    const lastY = toY(data[data.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#999";
    ctx.textAlign = "left";
    ctx.fillText(label, 4, 11);

    // Current value
    const val = data[data.length - 1];
    const display =
      val >= 1000
        ? `${(val / 1000).toFixed(1)}k`
        : val < 10
          ? val.toFixed(2)
          : Math.round(val).toString();
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.fillText(display, width - 4, 11);
  }, [data, width, height, color, label, minY, maxY]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} />;
}
