"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

import { ChevronLeft, ChevronRight } from "lucide-react";

import banners from "@/data/banners";

export default function HeroSection() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setActive((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
  };

  const previousSlide = () => {
    setActive((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const slide = banners[active];

  return (
    <section
      className="
px-5
pt-5
bg-[#020d08]
"
    >
      <div
        className="
max-w-[1400px]
mx-auto
relative
overflow-hidden
rounded-3xl
min-h-[390px]
bg-gradient-to-r
from-[#071b12]
to-[#020805]
border
border-white/10
"
      >
        <div
          className="
grid
md:grid-cols-2
items-center
px-10
py-12
gap-5
"
        >
          {/* CONTENT */}

          <div>
            <p
              className="
text-[#d4af37]
text-xs
tracking-[5px]
uppercase
mb-4
"
            >
              {slide.small}
            </p>

            <h1
              className="
text-4xl
md:text-6xl
font-black
text-white
leading-tight
uppercase
"
            >
              {slide.title}
            </h1>

            <p
              className="
mt-5
text-gray-400
max-w-md
text-base
"
            >
              {slide.description}
            </p>

            <Link
              href={slide.link}
              className="
inline-block
mt-8
bg-[#d4af37]
text-black
px-8
py-3
rounded-xl
font-bold
hover:bg-yellow-300
transition
"
            >
              {slide.button}
            </Link>
          </div>

          {/* PRODUCT IMAGE */}

          <div
            className="
flex
justify-center
items-center
relative
h-[300px] 
"
          >
            <div
              className="
relative
w-[420px]
h-[320px]
"
            >
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                priority
                className="
object-contain
drop-shadow-2xl
scale-110
"
              />
            </div>
          </div>
        </div>

        {/* LEFT BUTTON */}

        <button
          onClick={previousSlide}
          className="
absolute
left-5
top-1/2
-translate-y-1/2
w-10
h-10
rounded-full
bg-black/40
text-white
flex
items-center
justify-center
hover:bg-[#d4af37]
hover:text-black
transition
"
        >
          <ChevronLeft size={22} />
        </button>

        {/* RIGHT BUTTON */}

        <button
          onClick={nextSlide}
          className="
absolute
right-5
top-1/2
-translate-y-1/2
w-10
h-10
rounded-full
bg-black/40
text-white
flex
items-center
justify-center
hover:bg-[#d4af37]
hover:text-black
transition
"
        >
          <ChevronRight size={22} />
        </button>

        {/* DOTS */}

        <div
          className="
absolute
bottom-5
left-1/2
-translate-x-1/2
flex
gap-2
"
        >
          {banners.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setActive(index)}
              className={`
h-2
rounded-full
transition-all

${active === index ? "w-8 bg-[#d4af37]" : "w-2 bg-white/40"}

`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
