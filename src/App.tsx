import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import coffeeBeanImage from './assets/coffee-bean-3d.png'
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
    start: 0.18,
    end: 0.41,
  },
  {
    id: 'pour',
    label: 'THE POUR',
    title: <>Let the moment<br />take its time.</>,
    start: 0.43,
    end: 0.76,
  },
  {
    id: 'pause',
    label: 'THE PAUSE',
    title: <>Made for the<br />first sip.</>,
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
  const coffeeBeanRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const filmFeatureRef = useRef<HTMLElement>(null)
  const filmVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const progressRef = useRef(0)
  const scheduleDrawRef = useRef<(() => void) | null>(null)
  const [filmPlaying, setFilmPlaying] = useState(false)
  const [filmMuted, setFilmMuted] = useState(false)
  const progress = useScroll(sectionRef)
  const introProgress = clamp(progress / 0.16)

  useEffect(() => {
    const bean = coffeeBeanRef.current
    if (!bean) return

    let animationFrame = 0

    const updateBeanPosition = () => {
      if (animationFrame) return

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0

        const scrollRange = document.documentElement.scrollHeight - window.innerHeight
        const pageProgress = scrollRange > 0
          ? clamp(window.scrollY / scrollRange)
          : 0
        const startY = window.innerHeight * 0.13
        const finishY = window.innerHeight * 0.68
        const y = startY + (finishY - startY) * pageProgress
        const beanWidth = bean.getBoundingClientRect().width
        const startX = window.innerWidth - beanWidth - 16
        const finishX = (window.innerWidth - beanWidth) * 0.5
        const x = startX + (finishX - startX) * pageProgress +
          Math.sin(pageProgress * Math.PI) * window.innerWidth * 0.035
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const rotation = reducedMotion ? -22 : -22 + pageProgress * 430

        bean.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`
      })
    }

    updateBeanPosition()
    window.addEventListener('scroll', updateBeanPosition, { passive: true })
    window.addEventListener('resize', updateBeanPosition)

    const pageResizeObserver = new ResizeObserver(updateBeanPosition)
    if (pageRef.current) pageResizeObserver.observe(pageRef.current)

    return () => {
      window.removeEventListener('scroll', updateBeanPosition)
      window.removeEventListener('resize', updateBeanPosition)
      pageResizeObserver.disconnect()
      window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  useEffect(() => {
    progressRef.current = progress
    scheduleDrawRef.current?.()
  }, [progress])

  useEffect(() => {
    const feature = filmFeatureRef.current
    const video = filmVideoRef.current
    if (!feature || !video) return

    let disposed = false
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
        const startPlayback = async () => {
          try {
            await video.play()
            if (!disposed) setFilmMuted(video.muted)
          } catch {
            video.muted = true
            if (!disposed) setFilmMuted(true)
            try {
              await video.play()
            } catch {
              // Keep native controls available if the browser blocks muted autoplay too.
            }
          }
        }

        void startPlayback()
      } else {
        video.pause()
      }
    }, { threshold: [0, 0.35] })

    observer.observe(feature)
    return () => {
      disposed = true
      observer.disconnect()
    }
  }, [])

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
          .fromTo('.hero-title-inner', { yPercent: 115 }, { yPercent: 0, duration: 1.05, stagger: 0.11, ease: 'power4.out' }, '-=0.25')
          .fromTo('.scroll-cue', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7 }, '-=0.45')

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
          '.film-feature',
          { autoAlpha: 0, y: 42, scale: 0.985 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 1.05,
            ease: 'power3.out',
            scrollTrigger: { trigger: '.film-feature', start: 'top 84%', once: true },
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
      <div ref={coffeeBeanRef} className="coffee-bean-fall" aria-hidden="true">
        <img src={coffeeBeanImage} alt="" />
      </div>
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
            <h1 className="hero-title">
              <span className="hero-title-line"><span className="hero-title-inner">A finer kind</span></span>
              <span className="hero-title-line hero-title-accent"><span className="hero-title-inner">of everyday.</span></span>
            </h1>
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

          <section ref={filmFeatureRef} className="film-feature" aria-labelledby="film-title">
            <div className="film-heading">
              <div>
                <p className="film-kicker">THE COFFELIX FILM</p>
                <h2 id="film-title">A ritual in motion.</h2>
              </div>
              <p className="film-note">Sound on for the full Coffelix experience.</p>
            </div>
            <div
              className={`film-frame${filmPlaying ? ' film-frame-playing' : ''}`}
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect()
                event.currentTarget.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`)
                event.currentTarget.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`)
              }}
            >
              <video
                ref={filmVideoRef}
                className="film-video"
                controls
                playsInline
                preload="metadata"
                poster={storyImages[2]}
                aria-label="Coffelix espresso film with audio"
                onPlay={() => setFilmPlaying(true)}
                onPause={() => setFilmPlaying(false)}
                onVolumeChange={(event) => setFilmMuted(event.currentTarget.muted)}
              >
                <source src="/videos/coffelix%20ad.mp4" type="video/mp4" />
                Your browser does not support embedded video.
              </video>
              {filmMuted && (
                <button
                  className="film-sound-toggle"
                  type="button"
                  onClick={() => {
                    const video = filmVideoRef.current
                    if (!video) return
                    video.muted = false
                    setFilmMuted(false)
                    void video.play().catch(() => {
                      video.muted = true
                      setFilmMuted(true)
                    })
                  }}
                >
                  <span aria-hidden="true">♫</span> ENABLE SOUND
                </button>
              )}
              <span className="film-frame-caption" aria-hidden="true">COFFELIX · THE DAILY RITUAL</span>
            </div>
          </section>

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
            <div className="footer-social-contact">
              <div className="footer-social-logos" aria-label="Coffelix social media">
                <span className="footer-social-logo" role="img" aria-label="Instagram" title="Instagram">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <defs>
                      <linearGradient id="instagram-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#FFB13D" />
                        <stop offset="0.52" stopColor="#E1306C" />
                        <stop offset="1" stopColor="#833AB4" />
                      </linearGradient>
                    </defs>
                    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="url(#instagram-gradient)" />
                    <rect x="6.5" y="6.5" width="11" height="11" rx="3.2" fill="none" stroke="white" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="2.7" fill="none" stroke="white" strokeWidth="1.8" />
                    <circle cx="17.7" cy="6.6" r="1.15" fill="white" />
                  </svg>
                </span>
                <span className="footer-social-logo" role="img" aria-label="YouTube" title="YouTube">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#FF0033" d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.55 3.56 12 3.56 12 3.56s-7.55 0-9.4.52A3 3 0 0 0 .5 6.2C0 8.08 0 12 0 12s0 3.92.5 5.8a3 3 0 0 0 2.1 2.12c1.85.52 9.4.52 9.4.52s7.55 0 9.4-.52a3 3 0 0 0 2.1-2.12c.5-1.88.5-5.8.5-5.8s0-3.92-.5-5.8Z" />
                    <path fill="white" d="m9.55 15.5 6.25-3.5-6.25-3.5v7Z" />
                  </svg>
                </span>
                <span className="footer-social-logo" role="img" aria-label="Facebook" title="Facebook">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#0866FF" d="M24 12a12 12 0 1 0-13.88 11.86v-8.4H7.08V12h3.04V9.36c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.46h-2.79v8.4A12 12 0 0 0 24 12Z" />
                  </svg>
                </span>
                <span className="footer-social-logo" role="img" aria-label="TikTok" title="TikTok">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#25F4EE" d="M12.8 2h3.3c.2 1.8 1.2 3.3 2.9 4.1.9.5 1.9.7 3 .8v3.4a9.4 9.4 0 0 1-5.8-1.9v7.1a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v3.5a3 3 0 1 0 1.8 2.8V2Z" transform="translate(-1.5 0)" />
                    <path fill="#FE2C55" d="M12.8 2h3.3c.2 1.8 1.2 3.3 2.9 4.1.9.5 1.9.7 3 .8v3.4a9.4 9.4 0 0 1-5.8-1.9v7.1a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v3.5a3 3 0 1 0 1.8 2.8V2Z" transform="translate(.7 .5)" />
                    <path fill="#111" d="M12.8 2h3.3c.2 1.8 1.2 3.3 2.9 4.1.9.5 1.9.7 3 .8v3.4a9.4 9.4 0 0 1-5.8-1.9v7.1a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v3.5a3 3 0 1 0 1.8 2.8V2Z" />
                  </svg>
                </span>
              </div>
              <a className="footer-email" href="mailto:sales@coffelix.com">sales@coffelix.com</a>
              <a className="replay-link" href="#sequence">REPLAY THE POUR <span>↑</span></a>
            </div>
          </footer>
        </div>
      </section>
    </main>
  )
}

export default App
