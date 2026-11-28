"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Coins, Gift, HelpCircle, Percent, ShoppingBag, Sparkles, TicketPercent, Wallet, X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pointsForAmount, quoteRedemption } from "@/lib/loyalty";

const fmtRs = (v, locale) => `Rs ${Number(v || 0).toLocaleString(locale, { maximumFractionDigits: 2 })}`;
const fmtN = (v, locale) => Number(v || 0).toLocaleString(locale, { maximumFractionDigits: 2 });

/** Guide ka ek hissa — icon, title, wazahat, aur misaal ka box */
function Topic({ icon: Icon, title, children, example }) {
  return (
    <section className="border-b border-line px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <h3 className="text-[14px] font-semibold text-fg">{title}</h3>
      </div>
      <div className="mt-2 space-y-1.5 text-[13px] leading-[21px] text-fg-secondary">{children}</div>
      {example && (
        <div className="mt-2.5 rounded-lg border border-dashed border-line bg-card-alt px-3 py-2 text-[12.5px] leading-5 text-fg-secondary">
          <span className="font-semibold text-fg">Example: </span>{example}
        </div>
      )}
    </section>
  );
}

/**
 * Setup guide (readbook) — har field ka matlab + misaal, aur admin ki
 * apni maujooda settings ke saath ek poori customer kahani.
 *   payload → SettingsTab ka toPayload(form) (numbers)
 *   onApplyRecommended → recommended values form me bhar do
 */
export default function SetupGuide({ open, onClose, payload, onApplyRecommended }) {
  const { t, locale } = useTranslation();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const p = payload;
  const program = { ...p, enabled: true };
  const perPoint = p.redeem.redeemPoints > 0 ? p.redeem.redeemValue / p.redeem.redeemPoints : 0;
  const cashback = p.earn.spendUnit > 0 ? (p.earn.pointsPerUnit / p.earn.spendUnit) * perPoint * 100 : 0;

  // Kahani: naya customer → pehla order Rs 2,000 → doosra order Rs 3,000
  const bonus = p.signupBonus.enabled ? p.signupBonus.points : 0;
  const order1 = 2000;
  const q1 = p.redeem.enabled ? quoteRedemption(program, { balance: bonus, subtotal: order1, requested: bonus }) : { ok: false };
  const used1 = q1.ok ? q1.points : 0;
  const off1 = q1.ok ? q1.discount : 0;
  const earned1 = p.earn.enabled ? pointsForAmount(program, order1 - off1) : 0;
  const bal1 = bonus - used1 + earned1;
  const order2 = 3000;
  const q2 = p.redeem.enabled ? quoteRedemption(program, { balance: bal1, subtotal: order2, requested: bal1 }) : { ok: false };
  const off2 = q2.ok ? q2.discount : 0;

  const step = (n, text) => (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11.5px] font-semibold text-accent-fg">{n}</span>
      <span className="pt-0.5 text-[13px] leading-5 text-fg-secondary">{text}</span>
    </li>
  );

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t("admin.loyalty.guide.title")}>
      <button type="button" aria-label={t("admin.loyalty.common.close")} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-[520px] flex-col border-s border-line bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5" style={{ background: "linear-gradient(120deg, var(--accent-soft), transparent 70%)" }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: "var(--accent)" }}><BookOpen size={17} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-fg">{t("admin.loyalty.guide.title")}</p>
            <p className="text-[12px] text-fg-muted">{t("admin.loyalty.guide.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("admin.loyalty.common.close")} className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg">
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Basics */}
          <Topic icon={Coins} title={t("admin.loyalty.guide.whatTitle")}>
            <p>{t("admin.loyalty.guide.whatText")}</p>
          </Topic>

          {/* Field by field */}
          <Topic icon={Coins} title={`1 · ${t("admin.loyalty.settings.valueTitle")}`}
            example={t("admin.loyalty.guide.valueExample")}>
            <p>{t("admin.loyalty.guide.valueText")}</p>
            <p className="font-medium text-fg">{t("admin.loyalty.guide.yourValue", { points: fmtN(p.redeem.redeemPoints, locale), value: fmtRs(p.redeem.redeemValue, locale), one: fmtRs(perPoint, locale) })}</p>
          </Topic>

          <Topic icon={ShoppingBag} title={`2 · ${t("admin.loyalty.settings.earnRateLabel")}`}
            example={t("admin.loyalty.guide.earnExample")}>
            <p>{t("admin.loyalty.guide.earnText")}</p>
            <p className="font-medium text-fg">{t("admin.loyalty.guide.yourEarn", { points: fmtN(p.earn.pointsPerUnit, locale), spend: fmtRs(p.earn.spendUnit, locale), pct: fmtN(cashback, locale) })}</p>
          </Topic>

          <Topic icon={ShoppingBag} title={`2 · ${t("admin.loyalty.settings.minOrder")}`}
            example={t("admin.loyalty.guide.minOrderExample")}>
            <p>{t("admin.loyalty.guide.minOrderText")}</p>
          </Topic>

          <Topic icon={Gift} title={`3 · ${t("admin.loyalty.settings.signupTitle")}`}
            example={t("admin.loyalty.guide.bonusExample")}>
            <p>{t("admin.loyalty.guide.bonusText")}</p>
          </Topic>

          <Topic icon={Wallet} title={`4 · ${t("admin.loyalty.settings.minPoints")}`}
            example={t("admin.loyalty.guide.minPointsExample")}>
            <p>{t("admin.loyalty.guide.minPointsText")}</p>
          </Topic>

          <Topic icon={Percent} title={`4 · ${t("admin.loyalty.settings.maxPercent")}`}
            example={t("admin.loyalty.guide.maxExample")}>
            <p>{t("admin.loyalty.guide.maxText")}</p>
          </Topic>

          {/* Kahani — admin ki apni settings se */}
          <section className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--success-soft)", color: "var(--success-text)" }}><Sparkles size={15} /></span>
              <h3 className="text-[14px] font-semibold text-fg">{t("admin.loyalty.guide.storyTitle")}</h3>
            </div>
            <p className="mt-1.5 text-[12.5px] text-fg-muted">{t("admin.loyalty.guide.storyText")}</p>
            <ol className="mt-3 space-y-2.5">
              {step(1, bonus > 0 ? t("admin.loyalty.guide.s1", { points: fmtN(bonus, locale), value: fmtRs(bonus * perPoint, locale) }) : t("admin.loyalty.guide.s1none"))}
              {step(2, off1 > 0
                ? t("admin.loyalty.guide.s2use", { order: fmtRs(order1, locale), points: fmtN(used1, locale), off: fmtRs(off1, locale), pays: fmtRs(order1 - off1, locale) })
                : t("admin.loyalty.guide.s2nouse", { order: fmtRs(order1, locale) }))}
              {step(3, t("admin.loyalty.guide.s3", { points: fmtN(earned1, locale), value: fmtRs(earned1 * perPoint, locale), balance: fmtN(bal1, locale) }))}
              {step(4, off2 > 0
                ? t("admin.loyalty.guide.s4use", { order: fmtRs(order2, locale), off: fmtRs(off2, locale) })
                : t("admin.loyalty.guide.s4nouse", { order: fmtRs(order2, locale), min: fmtN(p.redeem.minPoints, locale) }))}
            </ol>
          </section>

          {/* Recommended */}
          <section className="border-b border-line px-5 py-4">
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
              <div className="flex items-center gap-2">
                <TicketPercent size={16} className="text-accent" />
                <p className="text-[14px] font-semibold text-fg">{t("admin.loyalty.guide.recTitle")}</p>
              </div>
              <ul className="mt-2 space-y-1 text-[12.5px] text-fg-secondary">
                <li>• {t("admin.loyalty.guide.rec1")}</li>
                <li>• {t("admin.loyalty.guide.rec2")}</li>
                <li>• {t("admin.loyalty.guide.rec3")}</li>
                <li>• {t("admin.loyalty.guide.rec4")}</li>
                <li>• {t("admin.loyalty.guide.rec5")}</li>
              </ul>
              <p className="mt-2 text-[12px] text-fg-muted">{t("admin.loyalty.guide.recResult")}</p>
              <button type="button" onClick={() => { onApplyRecommended(); onClose(); }}
                className="mt-3 inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-semibold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
                {t("admin.loyalty.guide.recApply")}
              </button>
            </div>
          </section>

          {/* FAQ */}
          <section className="px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--info-soft)", color: "var(--info-text)" }}><HelpCircle size={15} /></span>
              <h3 className="text-[14px] font-semibold text-fg">{t("admin.loyalty.guide.faqTitle")}</h3>
            </div>
            <dl className="mt-3 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <dt className="text-[13px] font-semibold text-fg">{t(`admin.loyalty.guide.faqQ${i}`)}</dt>
                  <dd className="mt-0.5 text-[12.5px] leading-5 text-fg-secondary">{t(`admin.loyalty.guide.faqA${i}`)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
