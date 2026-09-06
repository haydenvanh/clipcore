"use client";

import { useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { FAQ_ITEMS } from "./faq-items";


export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section className="w-full">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-center mb-8">
        Questions, answered straight
      </h2>

      <div className="divide-y divide-divider/40 border-y border-divider/40">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.q}>
              <button
                onClick={() => setOpen(isOpen ? -1 : index)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 py-4 text-left cursor-pointer group"
              >
                <span className="text-sm font-bold text-primary-text group-hover:text-primary transition-colors">
                  {item.q}
                </span>
                <FiChevronDown
                  className={`shrink-0 text-secondary-text transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-primary" : ""
                  }`}
                />
              </button>
              <div
                className={`grid transition-all duration-200 ${
                  isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
                }`}
              >
                <p className="overflow-hidden text-sm text-secondary-text leading-relaxed pr-8">
                  {item.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
