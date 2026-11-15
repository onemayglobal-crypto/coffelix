import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './App.css'

const PRIMARY_FRAME_COUNT = 150
const CONTINUATION_FRAME_COUNT = 55
const BASE_SCROLL_DISTANCE_VH = 400
const VIEWPORT_HEIGHT_VH = 100
const CONTINUATION_SCROLL_MULTIPLIER = 2
const MAX_CANVAS_PIXEL_RATIO = 3
const PRIMARY_SCROLL_INTERVALS = PRIMARY_FRAME_COUNT - 1
const TOTAL_SCROLL_UNITS =
  PRIMARY_SCROLL_INTERVALS + CONTINUATION_FRAME_COUNT * CONTINUATION_SCROLL_MULTIPLIER
const SEQUENCE_HEIGHT_VH =
  VIEWPORT_HEIGHT_VH +
  BASE_SCROLL_DISTANCE_VH * (TOTAL_SCROLL_UNITS / PRIMARY_SCROLL_INTERVALS)

const primaryFrameFiles = import.meta.glob<string>('./assets/image/*.jpg', {
  eager: true,
  import: 'default',
  query: '?url',
})

const continuationFrameFiles = import.meta.glob<string>('./assets/image 2/*.jpg', {
  eager: true,
  import: 'default',
  query: '?url',
})

function sortFrameUrls(files: Record<string, string>) {
  return Object.entries(files)
    .sort(([first], [second]) => {
      const numberFromName = (path: string) =>
        Number(path.match(/\((\d+)\)\.jpg$/i)?.[1] ?? 0)

      return numberFromName(first) - numberFromName(second)
    })
    .map(([, url]) => url)
}

const frameUrls = [
  ...sortFrameUrls(primaryFrameFiles).slice(0, PRIMARY_FRAME_COUNT),
  ...sortFrameUrls(continuationFrameFiles).slice(0, CONTINUATION_FRAME_COUNT),
]

const storyChapters = [
  {
    id: 'form',
    label: 'THE FORM',
    title: <>Presence<br />with purpose.</>,
    description: 'Polished metal lines. A confident portafilter. Every detail belongs to the ritual.',
    start: 0.18,
    end: 0.41,
  },
  {
    id: 'pour',
    label: 'THE POUR',
    title: <>Let the moment<br />take its time.</>,
    description: 'Follow the extraction from its first thread to a crema-topped finish, frame by frame.',
    start: 0.43,
    end: 0.76,
  },
  {
    id: 'pause',
    label: 'THE PAUSE',
    title: <>Made for the<br />first sip.</>,
    description: 'One cup, one pause, and a little room to breathe.',
    start: 0.78,
    end: 0.99,
  },
]

const storyImages = [frameUrls[69], frameUrls[149], frameUrls[204]]

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function getChapterOpacity(progress: number, start: number, end: number) {
  const fadeIn = clamp((progress - start) / 0.035)
  const fadeOut = clamp((end - progress) / 0.045)
  return Math.min(fadeIn, fadeOut)
}

function getFrameIndex(progress: number) {
  const scrollPosition = Math.min(1, Math.max(0, progress)) * TOTAL_SCROLL_UNITS
  const primaryPosition = Math.min(scrollPosition, PRIMARY_SCROLL_INTERVALS)
  const continuationPosition = Math.max(0, scrollPosition - PRIMARY_SCROLL_INTERVALS)
  const framePosition = primaryPosition +
    continuationPosition / CONTINUATION_SCROLL_MULTIPLIER

  return Math.min(frameUrls.length - 1, Math.round(framePosition))
}

function useScroll(targetRef: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let animationFrame = 0

    const updateProgress = () => {
      if (animationFrame) return

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0
        const target = targetRef.current
        if (!target) return

        const scrollDistance = target.offsetHeight - window.innerHeight
        const distanceScrolled = -target.getBoundingClientRect().top
        const nextProgress = scrollDistance > 0
          ? Math.min(1, Math.max(0, distanceScrolled / scrollDistance))
          : 0

        setProgress(nextProgress)
      })
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)

    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [targetRef])

  return progress
}

function App() {
  const pageRef = useRef<HTMLElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const progressRef = useRef(0)
  const scheduleDrawRef = useRef<(() => void) | null>(null)
  const progress = useScroll(sectionRef)
  const introProgress = clamp(progress / 0.16)

  useEffect(() => {
    progressRef.current = progress
    scheduleDrawRef.current?.()
  }, [progress])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let animationFrame = 0

    const drawFrame = () => {
      animationFrame = 0

      const bounds = canvas.getBoundingClientRect()
      const width = bounds.width
      const height = bounds.height
      if (!width || !height) return

      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        MAX_CANVAS_PIXEL_RATIO,
      )
      const pixelWidth = Math.round(width * pixelRatio)
      const pixelHeight = Math.round(height * pixelRatio)

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)

      const frames = imagesRef.current
      if (!frames.length) return

      const image = frames[getFrameIndex(progressRef.current)]
      if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return

      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const cinematicZoom = 1 + progressRef.current * 0.095
      const drawWidth = image.naturalWidth * scale * cinematicZoom
      const drawHeight = image.naturalHeight * scale * cinematicZoom
      const panX = width * (progressRef.current - 0.5) * -0.025
      const panY = height * (progressRef.current - 0.5) * -0.012
      const x = (width - drawWidth) / 2 + panX
      const y = (height - drawHeight) / 2 + panY

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, x, y, drawWidth, drawHeight)
    }

    const scheduleDraw = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(drawFrame)
      }
    }

    scheduleDrawRef.current = scheduleDraw

    const frames = frameUrls.map((url) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = scheduleDraw
      image.src = url
      return image
    })
    imagesRef.current = frames

    const resizeObserver = new ResizeObserver(scheduleDraw)
    resizeObserver.observe(canvas)
    window.addEventListener('resize', scheduleDraw)
    scheduleDraw()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleDraw)
      window.cancelAnimationFrame(animationFrame)
      scheduleDrawRef.current = null
      imagesRef.current = []
    }
  }, [])

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const motion = gsap.matchMedia()

    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })

        intro
          .fromTo('.brand-lockup', { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.7 })
          .fromTo('.hero-kicker', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.65 }, '-=0.25')
          .fromTo('.hero-title-inner', { yPercent: 115 }, { yPercent: 0, duration: 1.05, stagger: 0.11, ease: 'power4.out' }, '-=0.25')
          .fromTo('.hero-description, .scroll-cue', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 }, '-=0.45')

        gsap.fromTo(
          '.details-kicker, .details-title, .details-lede',
          { autoAlpha: 0, y: 36 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.12,
            ease: 'power3.out',
            scrollTrigger: { trigger: '.details-intro', start: 'top 78%', once: true },
          },
        )

        gsap.fromTo(
          '.highlight-card',
          { autoAlpha: 0, y: 42 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.85,
            stagger: 0.14,
            ease: 'power3.out',
            scrollTrigger: { trigger: '.highlight-grid', start: 'top 82%', once: true },
          },
        )

        gsap.fromTo(
          '.spec-row',
          { autoAlpha: 0, x: 24 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.7,
            stagger: 0.09,
            ease: 'power2.out',
            scrollTrigger: { trigger: '.spec-grid', start: 'top 84%', once: true },
          },
        )
      }, pageRef.current ?? undefined)

      return () => context.revert()
    })

    return () => motion.revert()
  }, [])

  return (
    <main ref={pageRef}>
      <section
        id="sequence"
        ref={sectionRef}
        className="animation-sequence"
        style={{ height: `${SEQUENCE_HEIGHT_VH}vh` }}
      >
        <div className="animation-sticky">
          <canvas
            ref={canvasRef}
            className="animation-canvas"
            role="img"
            aria-label="Coffelix espresso ritual, from machine to finished cup"
          />
          <div className="sequence-shade" aria-hidden="true" />

          <header className="brand-header">
            <a className="brand-lockup" href="#sequence" aria-label="Coffelix home">
              <span className="brand-monogram">C</span>
              <span className="brand-wordmark">COFFELIX<span>HOME ESPRESSO</span></span>
            </a>
            <a className="header-link" href="#product-details">THE COFFELIX STORY <span>↗</span></a>
          </header>

          <div
            className="hero-copy"
            style={{
              opacity: 1 - introProgress,
              transform: `translate3d(0, calc(-50% + var(--hero-text-drop) - ${30 * introProgress}px), 0)`,
            }}
          >
            <p className="hero-kicker"><span /> THE COFFELIX POINT OF VIEW</p>
            <h1 className="hero-title">
              <span className="hero-title-line"><span className="hero-title-inner">A finer kind</span></span>
              <span className="hero-title-line hero-title-accent"><span className="hero-title-inner">of everyday.</span></span>
            </h1>
            <p className="hero-description">
              The best coffee moments are never rushed. Coffelix puts the ritual in focus—
              considered form, the theater of the pour, and a beautiful finish in the cup.
            </p>
            <div className="scroll-cue" style={{ opacity: 1 - introProgress * 0.45 }}>
              <span className="scroll-cue-line" />
              <span>SCROLL TO EXPERIENCE</span>
            </div>
          </div>

          <div className="chapter-stage" aria-live="polite" aria-atomic="true">
            {storyChapters.map((chapter) => {
              const opacity = getChapterOpacity(progress, chapter.start, chapter.end)
              return (
                <div
                  className={`chapter-copy chapter-copy-${chapter.id}`}
                  key={chapter.id}
                  style={{
                    opacity,
                    '--chapter-lift': `${14 * (1 - opacity)}px`,
                    visibility: opacity > 0 ? 'visible' : 'hidden',
                  } as CSSProperties}
                  aria-hidden={opacity === 0}
                >
                  <p className="chapter-kicker">{chapter.label}</p>
                  <h2>{chapter.title}</h2>
                  <p className="chapter-description">{chapter.description}</p>
                </div>
              )
            })}
          </div>

          <div className="sequence-footer" aria-hidden="true">
            <div className="sequence-progress">
              <span className="sequence-progress-fill" style={{ transform: `scaleX(${progress})` }} />
            </div>
          </div>

        </div>
      </section>

      <section id="product-details" className="product-details">
        <div className="details-shell">
          <div className="details-intro">
            <p className="details-kicker">THE COFFELIX POINT OF VIEW</p>
            <h2 className="details-title">A finer kind<br />of <em>everyday.</em></h2>
            <p className="details-lede">
              The best coffee moments are never rushed. Coffelix puts the ritual in focus—
              considered form, the theater of the pour, and a beautiful finish in the cup.
            </p>
          </div>

          <div className="highlight-grid">
            <article className="highlight-card">
              <span className="card-index">THE FORM</span>
              <img className="card-photo" src={storyImages[0]} alt="Polished espresso grinder and portafilter" loading="lazy" />
              <span className="card-photo-shade" aria-hidden="true" />
              <h3>Presence<br />with purpose.</h3>
              <p>Polished metal lines and a confident portafilter make the machine part of the ritual.</p>
            </article>
            <article className="highlight-card highlight-card-featured">
              <span className="card-index">THE POUR</span>
              <img className="card-photo" src={storyImages[1]} alt="Espresso flowing from a polished portafilter" loading="lazy" />
              <span className="card-photo-shade" aria-hidden="true" />
              <h3>Let the moment<br />take its time.</h3>
              <p>Follow the extraction from its first thread to a crema-topped finish, frame by frame.</p>
            </article>
            <article className="highlight-card">
              <span className="card-index">THE PAUSE</span>
              <img className="card-photo" src={storyImages[2]} alt="A finished cup of espresso in warm morning light" loading="lazy" />
              <span className="card-photo-shade" aria-hidden="true" />
              <h3>Made for the<br />first sip.</h3>
              <p>A warmer, more considered start—one cup, one pause, and a little room to breathe.</p>
            </article>
          </div>

          <div className="spec-panel">
            <div className="spec-heading">
              <div>
                <p className="details-kicker">THE COFFELIX PROFILE</p>
                <h2>Specifications</h2>
              </div>
              <p className="spec-note">A visual profile of the product shown in this experience.</p>
            </div>
            <div className="spec-grid">
              <div className="spec-row"><span>Product type</span><strong>Home espresso machine</strong></div>
              <div className="spec-row"><span>Brew style</span><strong>Portafilter extraction</strong></div>
              <div className="spec-row"><span>Finish shown</span><strong>Polished metal</strong></div>
              <div className="spec-row"><span>Signature moment</span><strong>Crema-topped espresso</strong></div>
              <div className="spec-row"><span>Scroll story</span><strong>A slow, frame-by-frame pour</strong></div>
            </div>
            <p className="spec-footnote">Technical measurements were not included with the supplied product visuals.</p>
          </div>

          <footer className="detail-footer">
            <a className="footer-brand" href="#sequence">COFFELIX<span>HOME ESPRESSO</span></a>
            <div className="customer-care">
              <span>CUSTOMER CARE</span>
              <strong>1800 1890 15XX</strong>
            </div>
            <a className="replay-link" href="#sequence">REPLAY THE POUR <span>↑</span></a>
          </footer>
        </div>
      </section>
    </main>
  )
}

export default App
