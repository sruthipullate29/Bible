import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"

interface QrCodeViewProps {
  url: string
  size?: number
  className?: string
}

export function QrCodeView({ url, size = 150, className }: QrCodeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !url) return
    setError(null)
    QRCode.toCanvas(
      canvasRef.current,
      url,
      {
        width: size,
        margin: 1.5,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      },
      (err) => {
        if (err) setError(err.message)
      }
    )
  }, [url, size])

  if (error) {
    return (
      <div className="flex size-32 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-[0.6875rem] text-destructive">
        QR generation error
      </div>
    )
  }

  return (
    <div className={`inline-flex flex-col items-center justify-center rounded-xl bg-white p-2 shadow-md ring-1 ring-black/5 dark:ring-white/10 ${className || ""}`}>
      <canvas ref={canvasRef} className="rounded" />
    </div>
  )
}
