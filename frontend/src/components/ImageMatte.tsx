import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, ColorPicker, Segmented, Slider, Space, Spin, Typography, Upload } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { removeGeminiWatermarkFromBlob } from '../lib/geminiWatermark'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'
import StashableImage from './StashableImage'
import StashDropZone from './StashDropZone'
import { processDoubleBackground } from '../lib/doubleBackgroundMatte'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']
const IMAGE_MAX_MB = 20

async function imageToBlob(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png')
  })
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('load'))
    }
    img.src = url
  })
}

const GREEN: [number, number, number] = [0, 255, 0]
const BLUE: [number, number, number] = [0, 0, 255]

function rgbFromHex(hex: string): [number, number, number] {
  const m = hex.replace(/^#/, '').match(/.{2}/g)
  if (!m) return GREEN
  return [parseInt(m[0]!, 16), parseInt(m[1]!, 16), parseInt(m[2]!, 16)]
}

/** Canvas 2D 色度键，与取色使用相同像素源，避免色彩空间偏差 */
function chromaKeyCanvas(
  img: HTMLImageElement,
  keyColor: [number, number, number],
  tolerance: number,
  smoothness: number,
  spill: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const [kr, kg, kb] = keyColor
  const thresh = (tolerance / 100) * 100
  // 过渡带需足够宽，主体边缘混合像素的 RGB 距离约 80-150
  const smooth = 50 + (smoothness / 100) * 120
  const spillStr = spill / 100

  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i]!
    const g = data.data[i + 1]!
    const b = data.data[i + 2]!
    const dr = r - kr, dg = g - kg, db = b - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)

    let alpha: number
    if (dist <= thresh) {
      alpha = 0
    } else if (dist < thresh + smooth) {
      alpha = (dist - thresh) / smooth
      alpha = Math.min(1, alpha)
    } else {
      alpha = 1
    }

    // 抑色：去饱和度 + 针对绿/蓝幕的通道抑制（边缘溢色时 G/B 偏高，限制到 (R+B)/2 或 (R+G)/2）
    if (spillStr > 0 && alpha > 0) {
      const baseMask = Math.max(0, dist - thresh)
      const spillVal = Math.pow(Math.min(1, baseMask / Math.max(1, spillStr * 120)), 1.5)
      const gray = r * 0.2126 + g * 0.7152 + b * 0.0722
      let rr = gray * (1 - spillVal) + r * spillVal
      let gg = gray * (1 - spillVal) + g * spillVal
      let bb = gray * (1 - spillVal) + b * spillVal
      const strength = Math.min(1, spillStr * (1.2 - spillVal * 0.4))
      // 绿幕溢色：G 偏高，将 G 向 (R+B)/2 收紧
      if (kg >= kr && kg >= kb && g > Math.max(r, b)) {
        const limit = (rr + bb) / 2
        gg = gg - strength * (gg - limit)
      }
      // 蓝幕溢色：B 偏高，将 B 向 (R+G)/2 收紧
      if (kb >= kr && kb >= kg && b > Math.max(r, g)) {
        const limit = (rr + gg) / 2
        bb = bb - strength * (bb - limit)
      }
      data.data[i] = Math.round(Math.max(0, Math.min(255, rr)))
      data.data[i + 1] = Math.round(Math.max(0, Math.min(255, gg)))
      data.data[i + 2] = Math.round(Math.max(0, Math.min(255, bb)))
    }
    data.data[i + 3] = Math.round(alpha * 255)
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

/** Canvas 2D alpha 侵蚀：3×3 取最小 alpha，去除边缘绿痕/白边 */
function erodeAlphaOnCanvas(canvas: HTMLCanvasElement, passes: number): HTMLCanvasElement {
  if (passes <= 0) return canvas
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')!
  let read = ctx.getImageData(0, 0, w, h)
  let write = new ImageData(new Uint8ClampedArray(read.data), w, h)
  const dx = [-1, -1, -1, 0, 0, 1, 1, 1]
  const dy = [-1, 0, 1, -1, 1, -1, 0, 1]
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        write.data[i] = read.data[i]!
        write.data[i + 1] = read.data[i + 1]!
        write.data[i + 2] = read.data[i + 2]!
        let minA = read.data[i + 3]!
        for (let k = 0; k < 8; k++) {
          const nx = x + dx[k]!
          const ny = y + dy[k]!
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            minA = Math.min(minA, read.data[(ny * w + nx) * 4 + 3]!)
          }
        }
        write.data[i + 3] = minA
      }
    }
    ;[read, write] = [write, read]
  }
  ctx.putImageData(read, 0, 0)
  return canvas
}

const WHITE_KEY_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`
const WHITE_KEY_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D tex;
uniform float tolerance;
uniform float smoothness;
void main() {
  vec4 c = texture2D(tex, vUv);
  float w = min(min(c.r, c.g), c.b);
  float a = 1.0 - smoothstep(tolerance - smoothness, tolerance + smoothness, w);
  gl_FragColor = vec4(c.rgb, c.a * a);
}
`
const ERODE_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D tex;
uniform vec2 texelSize;
void main() {
  vec4 c = texture2D(tex, vUv);
  float minA = c.a;
  minA = min(minA, texture2D(tex, vUv + vec2(-1., -1.) * texelSize).a);
  minA = min(minA, texture2D(tex, vUv + vec2( 0., -1.) * texelSize).a);
  minA = min(minA, texture2D(tex, vUv + vec2( 1., -1.) * texelSize).a);
  minA = min(minA, texture2D(tex, vUv + vec2(-1.,  0.) * texelSize).a);
  minA = min(minA, texture2D(tex, vUv + vec2( 1.,  0.) * texelSize).a);
  minA = min(minA, texture2D(tex, vUv + vec2(-1.,  1.) * texelSize).a);
  minA = min(minA, texture2D(tex, vUv + vec2( 0.,  1.) * texelSize).a);
  minA = min(minA, texture2D(tex, vUv + vec2( 1.,  1.) * texelSize).a);
  gl_FragColor = vec4(c.rgb, minA);
}
`

/** GLSL 白底抠图 + 边缘侵蚀，去除白边和白斑 */
function whiteKeyErodeGLSL(
  img: HTMLImageElement,
  tolerance: number,
  smoothness: number,
  erosion: number
): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const glRaw = canvas.getContext('webgl', { preserveDrawingBuffer: true })
  if (!glRaw) throw new Error('WebGL not supported')
  const gl = glRaw

  const quadBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  function createProgram(vert: string, frag: string): WebGLProgram {
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, vert)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs) || 'vert compile')
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, frag)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(fs) || 'frag compile')
    const p = gl.createProgram()!
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link')
    return p
  }

  const whiteKeyProg = createProgram(WHITE_KEY_VERT, WHITE_KEY_FRAG)
  const erodeProg = createProgram(WHITE_KEY_VERT, ERODE_FRAG)

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

  const fb = gl.createFramebuffer()!
  function createFboTex(): WebGLTexture {
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    return t
  }
  const texA = createFboTex()
  const texB = createFboTex()

  const tol = (tolerance / 100) * 0.4 + 0.55
  const smooth = (smoothness / 100) * 0.12 + 0.02
  const erodePasses = Math.floor((erosion / 100) * 5)

  function drawQuad(program: WebGLProgram) {
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  gl.viewport(0, 0, w, h)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.useProgram(whiteKeyProg)
  gl.uniform1i(gl.getUniformLocation(whiteKeyProg, 'tex')!, 0)
  gl.uniform1f(gl.getUniformLocation(whiteKeyProg, 'tolerance')!, tol)
  gl.uniform1f(gl.getUniformLocation(whiteKeyProg, 'smoothness')!, smooth)
  drawQuad(whiteKeyProg)

  let readTex: WebGLTexture = texA
  let writeTex: WebGLTexture = texB
  for (let p = 0; p < erodePasses; p++) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeTex, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, readTex)
    gl.useProgram(erodeProg)
    gl.uniform1i(gl.getUniformLocation(erodeProg, 'tex')!, 0)
    gl.uniform2f(gl.getUniformLocation(erodeProg, 'texelSize')!, 1 / w, 1 / h)
    drawQuad(erodeProg)
    ;[readTex, writeTex] = [writeTex, readTex]
  }

  const blitFrag = 'precision mediump float;varying vec2 vUv;uniform sampler2D tex;void main(){gl_FragColor=texture2D(tex,vUv);}'
  const blitProg = createProgram(WHITE_KEY_VERT, blitFrag)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, readTex)
  gl.useProgram(blitProg)
  gl.uniform1i(gl.getUniformLocation(blitProg, 'tex')!, 0)
  drawQuad(blitProg)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = w
  outCanvas.height = h
  outCanvas.getContext('2d')!.drawImage(canvas, 0, 0)
  return outCanvas
}

type AlgorithmType = 'chroma' | 'whiteErode' | 'doubleBg'

export default function ImageMatte() {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [fileBlack, setFileBlack] = useState<File | null>(null)
  const [fileWhite, setFileWhite] = useState<File | null>(null)
  const [urlBlack, setUrlBlack] = useState<string | null>(null)
  const [urlWhite, setUrlWhite] = useState<string | null>(null)
  const [keyColor, setKeyColor] = useState<[number, number, number]>(GREEN)
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('doubleBg')
  const [tolerance, setTolerance] = useState(35)
  const [smoothness, setSmoothness] = useState(34)
  const [spill, setSpill] = useState(75)
  const [erosion, setErosion] = useState(77)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [bgColorActive, setBgColorActive] = useState(true)
  const [bgColor, setBgColor] = useState('#37634d')
  const [sourceReady, setSourceReady] = useState(false)
  const [doubleBgBlackReady, setDoubleBgBlackReady] = useState(false)
  const [doubleBgWhiteReady, setDoubleBgWhiteReady] = useState(false)
  const [doubleBgProcessing, setDoubleBgProcessing] = useState(false)
  const [doubleBgTolerance, setDoubleBgTolerance] = useState(50)
  const [doubleBgEdgeContrast, setDoubleBgEdgeContrast] = useState(50)
  const [doubleBgZoom, setDoubleBgZoom] = useState(1)
  const [doubleBgPan, setDoubleBgPan] = useState({ x: 0, y: 0 })
  const [doubleBgDragging, setDoubleBgDragging] = useState(false)
  const doubleBgPanStartRef = useRef<{ x: number; y: number; startPan: { x: number; y: number } } | null>(null)
  const doubleBgPanRef = useRef(doubleBgPan)
  const doubleBgPreviewRef = useRef<HTMLDivElement | null>(null)
  doubleBgPanRef.current = doubleBgPan
  const doubleBgBlackCleanRef = useRef<HTMLImageElement | null>(null)
  const doubleBgWhiteCleanRef = useRef<HTMLImageElement | null>(null)
  const sourceImgRef = useRef<HTMLImageElement | null>(null)
  const blackImgRef = useRef<HTMLImageElement | null>(null)
  const whiteImgRef = useRef<HTMLImageElement | null>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const setAlgorithmAndClear = (v: AlgorithmType) => {
    setAlgorithm(v)
    setResultUrl(null)
    if (v !== 'doubleBg') {
      setFileBlack(null)
      setFileWhite(null)
      setUrlBlack(null)
      setUrlWhite(null)
      setDoubleBgBlackReady(false)
      setDoubleBgWhiteReady(false)
      blackImgRef.current = null
      whiteImgRef.current = null
      doubleBgBlackCleanRef.current = null
      doubleBgWhiteCleanRef.current = null
      setDoubleBgZoom(1)
      setDoubleBgPan({ x: 0, y: 0 })
      setDoubleBgDragging(false)
    } else {
      setFile(null)
      setOriginalUrl(null)
      setSourceReady(false)
      sourceImgRef.current = null
    }
  }

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setOriginalUrl(url)
      setSourceReady(false)
      setResultUrl(null)
      sourceImgRef.current = null
      return () => URL.revokeObjectURL(url)
    }
    setOriginalUrl(null)
    setSourceReady(false)
    setResultUrl(null)
    sourceImgRef.current = null
  }, [file])

  useEffect(() => {
    if (fileBlack) {
      const url = URL.createObjectURL(fileBlack)
      setUrlBlack(url)
      setDoubleBgBlackReady(false)
      blackImgRef.current = null
      doubleBgBlackCleanRef.current = null
      return () => URL.revokeObjectURL(url)
    }
    setUrlBlack(null)
    setDoubleBgBlackReady(false)
    blackImgRef.current = null
    doubleBgBlackCleanRef.current = null
    setDoubleBgZoom(1)
    setDoubleBgPan({ x: 0, y: 0 })
    setDoubleBgDragging(false)
  }, [fileBlack])

  useEffect(() => {
    if (fileWhite) {
      const url = URL.createObjectURL(fileWhite)
      setUrlWhite(url)
      setDoubleBgWhiteReady(false)
      whiteImgRef.current = null
      doubleBgWhiteCleanRef.current = null
      return () => URL.revokeObjectURL(url)
    }
    setUrlWhite(null)
    setDoubleBgWhiteReady(false)
    whiteImgRef.current = null
    doubleBgWhiteCleanRef.current = null
    setDoubleBgZoom(1)
    setDoubleBgPan({ x: 0, y: 0 })
    setDoubleBgDragging(false)
  }, [fileWhite])

  useEffect(() => {
    if (!originalUrl) return
    const img = document.createElement('img')
    img.src = originalUrl
    img.onload = () => {
      sourceImgRef.current = img
      setSourceReady(true)
    }
    img.onerror = () => message.error(t('chromaFailed'))
  }, [originalUrl, message, t])

  useEffect(() => {
    if (!urlBlack) return
    const img = document.createElement('img')
    img.src = urlBlack
    img.onload = () => {
      blackImgRef.current = img
      setDoubleBgBlackReady(true)
    }
    img.onerror = () => message.error(t('chromaFailed'))
  }, [urlBlack, message, t])

  useEffect(() => {
    if (!urlWhite) return
    const img = document.createElement('img')
    img.src = urlWhite
    img.onload = () => {
      whiteImgRef.current = img
      setDoubleBgWhiteReady(true)
    }
    img.onerror = () => message.error(t('chromaFailed'))
  }, [urlWhite, message, t])

  useEffect(() => {
    if (algorithm === 'doubleBg') {
      if (!doubleBgBlackReady || !doubleBgWhiteReady || !blackImgRef.current || !whiteImgRef.current) {
        setResultUrl(null)
        setDoubleBgProcessing(false)
        return
      }
      const black = blackImgRef.current!
      const white = whiteImgRef.current!
      if (black.naturalWidth !== white.naturalWidth || black.naturalHeight !== white.naturalHeight) {
        message.error(t('chromaDoubleBgSizeMismatch'))
        setResultUrl(null)
        setDoubleBgProcessing(false)
        return
      }
      const runSync = (bImg: HTMLImageElement, wImg: HTMLImageElement) => {
        const canvas = processDoubleBackground(bImg, wImg, doubleBgTolerance, doubleBgEdgeContrast)
        resultCanvasRef.current = canvas
        setResultUrl((old) => {
          if (old && old.startsWith('blob:')) URL.revokeObjectURL(old)
          return canvas.toDataURL('image/png')
        })
      }
      if (doubleBgBlackCleanRef.current && doubleBgWhiteCleanRef.current) {
        runSync(doubleBgBlackCleanRef.current, doubleBgWhiteCleanRef.current)
        setDoubleBgProcessing(false)
        return
      }
      setDoubleBgProcessing(true)
      const run = async () => {
        try {
          let blackImg: HTMLImageElement = black
          let whiteImg: HTMLImageElement = white
          try {
            const [blackBlob, whiteBlob] = await Promise.all([
              imageToBlob(black),
              imageToBlob(white),
            ])
            const [blackClean, whiteClean] = await Promise.all([
              removeGeminiWatermarkFromBlob(blackBlob),
              removeGeminiWatermarkFromBlob(whiteBlob),
            ])
            ;[blackImg, whiteImg] = await Promise.all([
              blobToImage(blackClean),
              blobToImage(whiteClean),
            ])
          } catch {
            blackImg = black
            whiteImg = white
          }
          doubleBgBlackCleanRef.current = blackImg
          doubleBgWhiteCleanRef.current = whiteImg
          runSync(blackImg, whiteImg)
        } catch (e) {
          message.error(t('chromaFailed') + ': ' + String(e))
          setResultUrl(null)
        } finally {
          setDoubleBgProcessing(false)
        }
      }
      void run()
      return
    }
    if (!sourceReady || !sourceImgRef.current) return
    const img = sourceImgRef.current
    try {
      let canvas: HTMLCanvasElement
      if (algorithm === 'chroma') {
        canvas = chromaKeyCanvas(img, keyColor, tolerance, smoothness, spill)
        const erodePasses = Math.floor((erosion / 100) * 5)
        if (erodePasses > 0) {
          canvas = erodeAlphaOnCanvas(canvas, erodePasses)
        }
      } else {
        canvas = whiteKeyErodeGLSL(img, tolerance, smoothness, erosion)
      }
      resultCanvasRef.current = canvas
      setResultUrl((old) => {
        if (old && old.startsWith('blob:')) URL.revokeObjectURL(old)
        return canvas.toDataURL('image/png')
      })
    } catch (e) {
      message.error(t('chromaFailed') + ': ' + String(e))
    }
  }, [algorithm, sourceReady, doubleBgBlackReady, doubleBgWhiteReady, doubleBgTolerance, doubleBgEdgeContrast, keyColor, tolerance, smoothness, spill, erosion, message, t])

  const download = () => {
    const canvas = resultCanvasRef.current
    if (!canvas) return
    const baseName =
      algorithm === 'doubleBg'
        ? (fileBlack?.name?.replace(/\.[^.]+$/, '') ?? fileWhite?.name?.replace(/\.[^.]+$/, '') ?? 'result')
        : (file?.name?.replace(/\.[^.]+$/, '') ?? 'result')
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = baseName + (algorithm === 'doubleBg' ? '_doublebg.png' : '_chroma.png')
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png', 0.95)
  }

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const rect = img.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (img.naturalWidth / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (img.naturalHeight / rect.height))
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const [r, g, b] = ctx.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data
    setKeyColor([r, g, b])
  }

  const doubleBgHandleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 2) return
    e.preventDefault()
    setDoubleBgDragging(true)
    doubleBgPanStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPan: { ...doubleBgPanRef.current },
    }
  }, [])


  const doubleBgHandleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    const el = doubleBgPreviewRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.15 : 0.15
      setDoubleBgZoom((z) => Math.max(0.1, Math.min(5, z + delta)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [algorithm, resultUrl])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!doubleBgPanStartRef.current) return
      const dx = e.clientX - doubleBgPanStartRef.current.x
      const dy = e.clientY - doubleBgPanStartRef.current.y
      setDoubleBgPan({
        x: doubleBgPanStartRef.current.startPan.x + dx,
        y: doubleBgPanStartRef.current.startPan.y + dy,
      })
    }
    const onMouseUp = () => {
      if (doubleBgPanStartRef.current) {
        doubleBgPanStartRef.current = null
        setDoubleBgDragging(false)
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const hintByAlgo =
    algorithm === 'doubleBg'
      ? t('chromaDoubleBgHint')
      : algorithm === 'whiteErode'
        ? t('chromaHintWhite')
        : t('chromaHint')

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Text type="secondary" style={{ display: 'block' }}>{hintByAlgo}</Text>
        {algorithm === 'doubleBg' && (
          <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12, lineHeight: 1.55 }}>
            {t('chromaDoubleBgAttributionLine')}
          </Text>
        )}
      </div>
      <Segmented
        value={algorithm}
        onChange={(v) => setAlgorithmAndClear(v as AlgorithmType)}
        options={[
          { label: t('chromaAlgoChroma'), value: 'chroma' },
          { label: t('chromaAlgoWhite'), value: 'whiteErode' },
          { label: t('chromaAlgoDoubleBg'), value: 'doubleBg' },
        ]}
      />
      {algorithm !== 'doubleBg' && (
        <Space wrap>
          <Button size="small" onClick={() => setKeyColor(GREEN)} style={{ background: '#00ff00', borderColor: '#00aa00' }}>
            {t('chromaGreen')}
          </Button>
          <Button size="small" onClick={() => setKeyColor(BLUE)} style={{ background: '#0000ff', borderColor: '#0000aa', color: '#fff' }}>
            {t('chromaBlue')}
          </Button>
          {algorithm === 'chroma' && (
          <span>
            <Text type="secondary" style={{ marginRight: 8 }}>{t('chromaColor')}:</Text>
            <ColorPicker
              value={`#${keyColor[0].toString(16).padStart(2, '0')}${keyColor[1].toString(16).padStart(2, '0')}${keyColor[2].toString(16).padStart(2, '0')}`}
              onChange={(_, hex) => setKeyColor(rgbFromHex(hex ?? '#00ff00'))}
              showText
            />
          </span>
          )}
        </Space>
      )}
      {algorithm === 'doubleBg' ? (
        <>
          {doubleBgProcessing && (
            <Space wrap align="center">
              <Spin size="small" />
              <Text type="secondary">{t('chromaDoubleBgProcessing')}</Text>
            </Space>
          )}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('chromaDoubleBgBlack')}</Text>
            <StashDropZone
              onStashDrop={(f) => setFileBlack(f)}
              maxSizeMB={IMAGE_MAX_MB}
              onSizeError={() => message.error(t('imageSizeError'))}
            >
              <Dragger
                accept={IMAGE_ACCEPT.join(',')}
                maxCount={1}
                fileList={fileBlack ? [{ uid: 'black', name: fileBlack.name } as UploadFile] : []}
                beforeUpload={(f) => {
                  if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
                    message.error(t('imageSizeError'))
                    return false
                  }
                  setFileBlack(f)
                  return false
                }}
                onRemove={() => setFileBlack(null)}
              >
                <p className="ant-upload-text">{t('imageUploadHint')}</p>
                <p className="ant-upload-hint">{t('imageFormats')}</p>
              </Dragger>
            </StashDropZone>
            {urlBlack && <img src={urlBlack} alt="" style={{ maxWidth: '100%', maxHeight: 160, marginTop: 8, display: 'block', borderRadius: 4 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('chromaDoubleBgWhite')}</Text>
            <StashDropZone
              onStashDrop={(f) => setFileWhite(f)}
              maxSizeMB={IMAGE_MAX_MB}
              onSizeError={() => message.error(t('imageSizeError'))}
            >
              <Dragger
                accept={IMAGE_ACCEPT.join(',')}
                maxCount={1}
                fileList={fileWhite ? [{ uid: 'white', name: fileWhite.name } as UploadFile] : []}
                beforeUpload={(f) => {
                  if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
                    message.error(t('imageSizeError'))
                    return false
                  }
                  setFileWhite(f)
                  return false
                }}
                onRemove={() => setFileWhite(null)}
              >
                <p className="ant-upload-text">{t('imageUploadHint')}</p>
                <p className="ant-upload-hint">{t('imageFormats')}</p>
              </Dragger>
            </StashDropZone>
            {urlWhite && <img src={urlWhite} alt="" style={{ maxWidth: '100%', maxHeight: 160, marginTop: 8, display: 'block', borderRadius: 4 }} />}
          </div>
        </div>
        </>
      ) : (
      <StashDropZone
        onStashDrop={(f) => setFile(f)}
        maxSizeMB={IMAGE_MAX_MB}
        onSizeError={() => message.error(t('imageSizeError'))}
      >
        <Dragger
          accept={IMAGE_ACCEPT.join(',')}
          maxCount={1}
          fileList={file ? [{ uid: '1', name: file.name } as UploadFile] : []}
          beforeUpload={(f) => {
            if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
              message.error(t('imageSizeError'))
              return false
            }
            setFile(f)
            return false
          }}
          onRemove={() => setFile(null)}
        >
          <p className="ant-upload-text">{t('imageUploadHint')}</p>
          <p className="ant-upload-hint">{t('imageFormats')}</p>
        </Dragger>
      </StashDropZone>
      )}
      {algorithm !== 'doubleBg' && file && originalUrl && (
        <>
          <Text strong style={{ display: 'block' }}>{t('imgOriginalPreview')} <Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>({t('chromaPickHint')})</Text></Text>
          <div
            style={{
              padding: 16,
              background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
              borderRadius: 8,
              border: '1px solid #9a8b78',
              display: 'inline-block',
            }}
          >
            <img
              ref={imgRef}
              src={originalUrl}
              alt=""
              style={{ maxWidth: 320, maxHeight: 240, display: 'block', imageRendering: 'auto', cursor: 'crosshair' }}
              onClick={handleImageClick}
            />
          </div>
        </>
      )}
      <Space wrap>
        {resultUrl && (
          <>
            <Button icon={<DownloadOutlined />} onClick={download}>
              {t('imgDownload')}
            </Button>
            <Button type={bgColorActive ? 'primary' : 'default'} size="small" onClick={() => setBgColorActive((v) => !v)}>
              {t('chromaBgBtn')}
            </Button>
            {bgColorActive && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('chromaBgColor')}:</Text>
                <ColorPicker value={bgColor} onChange={(_, hex) => setBgColor(hex ?? '#ffffff')} showText size="small" />
              </span>
            )}
          </>
        )}
      </Space>
      {resultUrl && (
        <>
          <Text strong style={{ display: 'block' }}>{t('imgPreview')}</Text>
          <div
            style={{
              position: 'relative',
              padding: 16,
              background: bgColorActive ? bgColor : 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
              borderRadius: 8,
              border: '1px solid #9a8b78',
              width: algorithm === 'doubleBg' ? '100%' : undefined,
              display: algorithm === 'doubleBg' ? 'block' : 'inline-block',
              minWidth: algorithm === 'doubleBg' ? 0 : undefined,
            }}
          >
            {algorithm === 'doubleBg' ? (
            <div
              ref={doubleBgPreviewRef}
              style={{
                width: '100%',
                height: 'min(600px, 60vh)',
                minHeight: 400,
                overflow: 'hidden',
                cursor: doubleBgDragging ? 'grabbing' : 'grab',
                position: 'relative',
                userSelect: 'none',
              }}
              onMouseDown={doubleBgHandleMouseDown}
              onContextMenu={doubleBgHandleContextMenu}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `translate(${doubleBgPan.x}px, ${doubleBgPan.y}px) scale(${doubleBgZoom})`,
                  transformOrigin: 'center center',
                }}
              >
                <StashableImage src={resultUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', imageRendering: 'auto' }} />
              </div>
            </div>
            ) : (
            <StashableImage src={resultUrl} alt="" style={{ maxWidth: '100%', maxHeight: 400, display: 'block', imageRendering: 'auto' }} />
            )}
            {algorithm === 'doubleBg' && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.75)',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('chromaDoubleBgTolerance')}</Text>
                  <Slider min={50} max={100} value={doubleBgTolerance} onChange={setDoubleBgTolerance} style={{ flex: 1, margin: '0 4px' }} />
                  <Text style={{ color: '#aaa', fontSize: 10, width: 20, textAlign: 'right' }}>{doubleBgTolerance}</Text>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('chromaDoubleBgEdgeContrast')}</Text>
                  <Slider min={50} max={100} value={doubleBgEdgeContrast} onChange={setDoubleBgEdgeContrast} style={{ flex: 1, margin: '0 4px' }} />
                  <Text style={{ color: '#aaa', fontSize: 10, width: 20, textAlign: 'right' }}>{doubleBgEdgeContrast}</Text>
                </span>
              </div>
            </div>
            )}
            {algorithm !== 'doubleBg' && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.75)',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('chromaTolerance')}</Text>
                  <Slider min={5} max={100} value={tolerance} onChange={setTolerance} style={{ flex: 1, margin: '0 4px' }} />
                  <Text style={{ color: '#aaa', fontSize: 10, width: 20, textAlign: 'right' }}>{tolerance}</Text>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('chromaSmoothness')}</Text>
                  <Slider min={5} max={100} value={smoothness} onChange={setSmoothness} style={{ flex: 1, margin: '0 4px' }} />
                  <Text style={{ color: '#aaa', fontSize: 10, width: 20, textAlign: 'right' }}>{smoothness}</Text>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {algorithm === 'chroma' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                    <Text style={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('chromaSpill')}</Text>
                    <Slider min={5} max={100} value={spill} onChange={setSpill} style={{ flex: 1, margin: '0 4px' }} />
                    <Text style={{ color: '#aaa', fontSize: 10, width: 20, textAlign: 'right' }}>{spill}</Text>
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('chromaErosion')}</Text>
                  <Slider min={0} max={100} value={erosion} onChange={setErosion} style={{ flex: 1, margin: '0 4px' }} />
                  <Text style={{ color: '#aaa', fontSize: 10, width: 20, textAlign: 'right' }}>{erosion}</Text>
                </span>
              </div>
            </div>
            )}
          </div>
        </>
      )}
    </Space>
  )
}
