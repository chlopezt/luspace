import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Quote,
  MessageCircle,
} from "lucide-react";
import { approvedTestimonials } from "../shared/testimonials.js";
import "./testimonials.css";
type Testimonial = {
  name: string;
  role: string;
  category: string;
  quote: string;
  rating: number;
  avatar?: string;
};
export default function Testimonials({
  items = approvedTestimonials,
}: {
  items?: Testimonial[];
}) {
  const track = useRef<HTMLDivElement>(null),
    [active, setActive] = useState(0),
    [pages, setPages] = useState(1);
  useEffect(() => {
    const el = track.current;
    if (!el || !items.length) return;
    const update = () => {
      const card = el.firstElementChild as HTMLElement;
      const step = card.getBoundingClientRect().width + 20;
      setPages(
        Math.max(1, Math.round((el.scrollWidth - el.clientWidth) / step) + 1),
      );
      setActive(Math.round(el.scrollLeft / step));
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [items.length]);
  function move(index: number) {
    const el = track.current;
    if (!el) return;
    const step =
      (el.firstElementChild as HTMLElement).getBoundingClientRect().width + 20;
    el.scrollTo({
      left: Math.max(0, Math.min(pages - 1, index)) * step,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  return (
    <section
      className="lp-section lp-wrap lp-testimonials"
      aria-labelledby="testimonials-title"
      aria-roledescription={items.length ? "carrusel" : undefined}
    >
      <p className="lp-eyebrow">CUIDADO COMPARTIDO</p>
      <h2 id="testimonials-title">
        {items.length
          ? "Lo que dicen las familias y profesionales que confían en LuSpace"
          : "Cada experiencia de cuidado cuenta"}
      </h2>
      <p className="lp-section-intro">
        {items.length
          ? "Historias reales de organización, tranquilidad y cuidado pediátrico compartido."
          : "¿LuSpace te ha ayudado a organizar el cuidado? Nos encantará conocer tu experiencia."}
      </p>
      {!items.length ? (
        <div className="testimonial-empty">
          <MessageCircle size={28} />
          <p>
            Este espacio reunirá las experiencias de familias y profesionales
            que quieran compartir su historia.
          </p>
        </div>
      ) : (
        <>
          <div
            className="testimonial-track"
            ref={track}
            tabIndex={0}
            aria-label="Testimonios. Desliza para explorar."
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                move(active + (e.key === "ArrowRight" ? 1 : -1));
              }
            }}
          >
            {items.map((t, i) => (
              <article
                className="testimonial-card"
                key={t.name + i}
                aria-label={`Testimonio ${i + 1} de ${items.length}`}
              >
                <span className="testimonial-category">{t.category}</span>
                <div className="testimonial-avatar" aria-hidden="true">
                  {t.avatar ? (
                    <img src={t.avatar} alt="" />
                  ) : (
                    t.name
                      .replace("Dr. ", "")
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                  )}
                </div>
                <div
                  className="testimonial-stars"
                  aria-label={`Calificación: ${Math.max(0, Math.min(5, t.rating))} de 5 estrellas`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={17}
                      fill={n <= t.rating ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                <h3>{t.name}</h3>
                <p className="testimonial-role">{t.role}</p>
                <Quote
                  size={23}
                  className="testimonial-quote-icon"
                  aria-hidden="true"
                />
                <blockquote>{t.quote}</blockquote>
              </article>
            ))}
          </div>
          <div className="testimonial-controls">
            <button
              type="button"
              aria-label="Testimonios anteriores"
              disabled={active === 0}
              onClick={() => move(active - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="testimonial-dots">
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  className={active === i ? "active" : ""}
                  aria-label={`Ir a la posición ${i + 1} de testimonios`}
                  aria-current={active === i ? "true" : undefined}
                  onClick={() => move(i)}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Testimonios siguientes"
              disabled={active === pages - 1}
              onClick={() => move(active + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
