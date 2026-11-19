"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Store,
  FileText,
  Building,
  Globe,
  MapPin,
  Building2,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/utils/compressImage";

const BUSINESS_CATEGORIES = [
  "Electronics",
  "Fashion & Apparel",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Sports & Outdoors",
  "Grocery & Food",
  "Baby & Kids",
  "Automotive",
  "Health & Wellness",
  "Books & Stationery",
  "Services",
  "Other",
];

const COUNTRIES = [
  "Pakistan",
  "India",
  "Bangladesh",
  "Sri Lanka",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Oman",
  "Kuwait",
  "Bahrain",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "France",
  "Australia",
  "Turkey",
  "Malaysia",
  "Singapore",
  "Egypt",
];

const DOC_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_DOC_BYTES = 1.5 * 1024 * 1024;
const MAX_DOCUMENTS = 4;

const API = process.env.NEXT_PUBLIC_SERVERURL;
const API_ORIGIN = (API || "").replace(/\/api\/?$/, "");
const docUrl = (path) => (path?.startsWith("http") ? path : `${API_ORIGIN}${path}`);

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function StoreSetupPage() {
  return (
    <Suspense fallback={<StoreSetupFallback />}>
      <StoreSetupInner />
    </Suspense>
  );
}

function StoreSetupFallback() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#05070b] px-4 py-10 sm:px-6">
      <div className="w-full max-w-[560px] rounded-3xl border border-white/10 bg-[#0f172a]/80 p-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <div className="spinner mx-auto" aria-label="Loading store setup" />
      </div>
    </main>
  );
}

const inputCls =
  "w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 text-[14px] text-white placeholder:text-slate-500 outline-none transition focus:border-[#f57224]/60 focus:bg-white/[0.07]";
const selectCls = `${inputCls} appearance-none`;
const labelCls = "mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400";

function StoreSetupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = (params?.get("email") || "").trim().toLowerCase();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [status, setStatus] = useState("pending");
  const [infoMessage, setInfoMessage] = useState("");

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessType, setBusinessType] = useState("individual");
  const [country, setCountry] = useState("Pakistan");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [storeLogo, setStoreLogo] = useState("");
  const [logoPreview, setLogoPreview] = useState("");

  const [existingDocs, setExistingDocs] = useState([]); // kept
  const [removedDocs, setRemovedDocs] = useState([]); // urls removed from the form
  const [newDocs, setNewDocs] = useState([]); // { name, data } pending upload
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!email || !emailOk(email)) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }
      try {
        const res = await fetch(`${API}/seller/apply/setup?email=${encodeURIComponent(email)}`);
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body?.success) {
          setNotFound(true);
          return;
        }
        const d = body.data || {};
        setStoreName(d.store_name || "");
        setStoreDescription(d.store_description || "");
        setBusinessCategory(d.business_category || "");
        setBusinessType(d.business_type || "individual");
        setCountry(d.country || "Pakistan");
        setCity(d.city || "");
        setAddress(d.address || "");
        setZipCode(d.zip_code || "");
        setLogoPreview(d.logo?.img_url || "");
        setExistingDocs(d.documents || []);
        setStatus(d.status || "pending");
        setAlreadyDone(!!d.setup_completed);
        setInfoMessage(d.info_request_message || "");
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  const pickLogo = async (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    e.target.value = "";
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Logo must be a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image is too large — please pick one under 15MB.");
      return;
    }
    try {
      const compressed = await compressImage(file, { maxSize: 512, quality: 0.82 });
      setStoreLogo(compressed);
    } catch {
      toast.error("Logo could not be processed. Please try another image.");
    }
  };

  const readFile = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result || "") });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  const pickDocs = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_DOCUMENTS - existingDocs.length - newDocs.length;
    if (room <= 0) {
      toast.error(`You can keep at most ${MAX_DOCUMENTS} documents.`);
      return;
    }
    const accepted = [];
    for (const file of files.slice(0, room)) {
      if (!DOC_MIME.includes(file.type)) {
        toast.error(`${file.name}: only PDF, JPG, PNG or WEBP files are allowed.`);
        continue;
      }
      if (file.size > MAX_DOC_BYTES) {
        toast.error(`${file.name}: must be under 1.5MB.`);
        continue;
      }
      const parsed = await readFile(file);
      if (parsed) accepted.push(parsed);
    }
    if (accepted.length) setNewDocs((prev) => [...prev, ...accepted]);
  };

  const removeExistingDoc = (url) => {
    setExistingDocs((prev) => prev.filter((d) => d.url !== url));
    setRemovedDocs((prev) => [...prev, url]);
  };

  const removeNewDoc = (index) => setNewDocs((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!storeName.trim()) next.storeName = "Please enter your store name.";
    if (storeDescription.trim().length < 10) next.storeDescription = "Please describe your store (at least 10 characters).";
    if (!businessCategory) next.businessCategory = "Please select a business category.";
    if (!country) next.country = "Please select a country.";
    if (city.trim().length < 2) next.city = "Please enter your city.";
    if (address.trim().length < 5) next.address = "Please enter a complete store address.";
    if (existingDocs.length + newDocs.length === 0) next.documents = "Please upload at least one verification document.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/seller/apply/complete-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          storeName: storeName.trim(),
          storeDescription: storeDescription.trim(),
          businessCategory,
          businessType,
          country,
          city: city.trim(),
          address: address.trim(),
          zipCode: zipCode.trim(),
          ...(storeLogo ? { storeLogo } : {}),
          documents: newDocs,
          removeDocuments: removedDocs,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        if (body?.errors && typeof body.errors === "object") setErrors((prev) => ({ ...prev, ...body.errors }));
        toast.error(body?.message || "Could not submit store setup.");
        return;
      }
      toast.success("Store setup submitted!");
      router.replace(`/pending-approval?email=${encodeURIComponent(email)}`);
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <StoreSetupFallback />;

  const shell = (children) => (
    <main className="relative min-h-screen bg-[#05070b] px-4 py-10 text-white sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(255,106,31,0.16) 0%, transparent 60%)" }}
      />
      <div className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a]/80 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="border-b border-white/5 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f57224]/15 text-[#ff9a4d]">
              <Store size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-[17px] font-extrabold leading-tight tracking-tight text-white">Store setup</h1>
              <p className="text-[11px] text-slate-400">Confirm your details and upload verification documents</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-6 sm:px-8">{children}</div>
      </div>
    </main>
  );

  if (notFound) {
    return shell(
      <div className="text-center">
        <AlertCircle size={40} strokeWidth={1.75} className="mx-auto text-amber-400" aria-hidden="true" />
        <h2 className="mt-4 text-[18px] font-extrabold text-white">We couldn&apos;t find that application</h2>
        <p className="mt-2 text-[13px] leading-6 text-slate-400">
          {email ? (
            <>No seller application exists for <span className="font-semibold text-slate-200">{email}</span>. Double-check the email you used at signup.</>
          ) : (
            "This link is missing the email parameter. Open it from the email we sent you, or from the pending approval screen."
          )}
        </p>
        <a href="/landing/signup" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#f57224] px-6 text-[13px] font-bold text-white transition hover:brightness-110">
          Back to signup
        </a>
      </div>
    );
  }

  if (alreadyDone) {
    return shell(
      <div className="text-center">
        <CheckCircle2 size={40} strokeWidth={1.75} className="mx-auto text-emerald-400" aria-hidden="true" />
        <h2 className="mt-4 text-[18px] font-extrabold text-white">Your store setup is submitted</h2>
        <p className="mt-2 text-[13px] leading-6 text-slate-400">
          A Super Admin is reviewing your application. We&apos;ll email you as soon as it&apos;s approved.
        </p>
        <a href={`/pending-approval?email=${encodeURIComponent(email)}`} className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#f57224] px-6 text-[13px] font-bold text-white transition hover:brightness-110">
          View application status
        </a>
      </div>
    );
  }

  return shell(
    <>
      {status === "rejected" ? (
        <p className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[12px] font-medium leading-5 text-red-200">
          This application was rejected and can no longer be submitted.
        </p>
      ) : null}
      {infoMessage ? (
        <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[12px] leading-5 text-amber-200">
          <span className="font-bold">The review team requested:</span> {infoMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Store name */}
        <div>
          <label htmlFor="ss-store-name" className={labelCls}>Store name</label>
          <div className="relative">
            <Store size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="ss-store-name" type="text" value={storeName} onChange={(e) => { setStoreName(e.target.value); setErrors((p) => ({ ...p, storeName: "" })); }} placeholder="e.g. Ahmed Electronics" className={inputCls} />
          </div>
          {errors.storeName && <p className="mt-1 px-1 text-[11px] font-semibold text-red-400">{errors.storeName}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="ss-desc" className={labelCls}>What will you sell?</label>
          <div className="relative">
            <FileText size={15} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" aria-hidden="true" />
            <textarea id="ss-desc" rows={2} maxLength={2000} value={storeDescription} onChange={(e) => { setStoreDescription(e.target.value); setErrors((p) => ({ ...p, storeDescription: "" })); }} placeholder="Brief description of your store" className={`${inputCls} h-auto py-3`} />
          </div>
          {errors.storeDescription && <p className="mt-1 px-1 text-[11px] font-semibold text-red-400">{errors.storeDescription}</p>}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="ss-category" className={labelCls}>Category</label>
          <div className="relative">
            <Building size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <select id="ss-category" value={businessCategory} onChange={(e) => { setBusinessCategory(e.target.value); setErrors((p) => ({ ...p, businessCategory: "" })); }} className={selectCls}>
              <option value="">Select category</option>
              {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {errors.businessCategory && <p className="mt-1 px-1 text-[11px] font-semibold text-red-400">{errors.businessCategory}</p>}
        </div>

        {/* Country + city + zip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ss-country" className={labelCls}>Country</label>
            <div className="relative">
              <Globe size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <select id="ss-country" value={country} onChange={(e) => { setCountry(e.target.value); setErrors((p) => ({ ...p, country: "" })); }} className={selectCls}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {errors.country && <p className="mt-1 px-1 text-[11px] font-semibold text-red-400">{errors.country}</p>}
          </div>
          <div className="grid grid-cols-[1fr_84px] gap-2">
            <div>
              <label htmlFor="ss-city" className={labelCls}>City</label>
              <div className="relative">
                <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input id="ss-city" type="text" value={city} onChange={(e) => { setCity(e.target.value); setErrors((p) => ({ ...p, city: "" })); }} placeholder="Lahore" className={inputCls} />
              </div>
              {errors.city && <p className="mt-1 px-1 text-[11px] font-semibold text-red-400">{errors.city}</p>}
            </div>
            <div>
              <label htmlFor="ss-zip" className={labelCls}>ZIP</label>
              <input id="ss-zip" type="text" inputMode="numeric" maxLength={20} value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="54000" className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-[14px] text-white placeholder:text-slate-500 outline-none transition focus:border-[#f57224]/60" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="ss-address" className={labelCls}>Store address</label>
          <div className="relative">
            <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="ss-address" type="text" value={address} onChange={(e) => { setAddress(e.target.value); setErrors((p) => ({ ...p, address: "" })); }} placeholder="Street, area, Lahore" className={inputCls} />
          </div>
          {errors.address && <p className="mt-1 px-1 text-[11px] font-semibold text-red-400">{errors.address}</p>}
        </div>

        {/* Logo (optional replace) */}
        <div>
          <span className={labelCls}>Store logo <span className="normal-case text-slate-600">(optional)</span></span>
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-slate-500">
              {storeLogo || logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storeLogo || docUrl(logoPreview)} alt="Logo preview" className="h-full w-full object-contain" />
              ) : (
                <Building2 size={20} />
              )}
            </div>
            <div className="flex flex-col items-start gap-1">
              <label htmlFor="ss-logo" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] font-bold text-slate-200 transition hover:border-[#f57224]/60 hover:text-[#ff9a4d]">
                {storeLogo ? "Change logo" : "Upload logo"}
              </label>
              <p className="text-[9.5px] text-slate-500">JPG, PNG or WEBP — any size, we optimize it</p>
            </div>
            <input id="ss-logo" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={pickLogo} className="sr-only" />
          </div>
        </div>

        {/* Documents */}
        <div>
          <span className={labelCls}>Verification documents <span className="normal-case text-slate-600">(required — PDF/JPG/PNG/WEBP, max 1.5MB each, up to {MAX_DOCUMENTS})</span></span>
          <p className="mb-2 text-[10px] leading-4 text-slate-500">e.g. CNIC/registration certificate, business letterhead, bank statement — whatever proves your business is real.</p>

          {existingDocs.length > 0 && (
            <ul className="mb-2 space-y-2">
              {existingDocs.map((doc) => (
                <li key={doc.url} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <FileText size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <a href={docUrl(doc.url)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-200 hover:text-white" title={doc.name}>
                    {doc.name}
                  </a>
                  <button type="button" onClick={() => removeExistingDoc(doc.url)} aria-label={`Remove ${doc.name}`} className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {newDocs.length > 0 && (
            <ul className="mb-2 space-y-2">
              {newDocs.map((doc, idx) => (
                <li key={`${doc.name}-${idx}`} className="flex items-center gap-2 rounded-xl border border-[#f57224]/30 bg-[#f57224]/10 px-3 py-2">
                  <FileText size={15} className="shrink-0 text-[#ff9a4d]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-100" title={doc.name}>{doc.name}</span>
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#ff9a4d]">New</span>
                  <button type="button" onClick={() => removeNewDoc(idx)} aria-label={`Remove ${doc.name}`} className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label htmlFor="ss-docs" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 text-[12px] font-bold text-slate-300 transition hover:border-[#f57224]/60 hover:text-[#ff9a4d]">
            <Upload size={15} aria-hidden="true" /> Add documents
          </label>
          <input id="ss-docs" type="file" multiple accept=".pdf,application/pdf,image/jpeg,image/jpg,image/png,image/webp" onChange={pickDocs} className="sr-only" />
          {errors.documents && <p className="mt-1 px-1 text-[11px] font-semibold text-red-400">{errors.documents}</p>}
        </div>

        {/* Submit */}
        <button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f57224] text-[14px] font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Submitting…
            </>
          ) : (
            <>
              <ShieldCheck size={17} aria-hidden="true" /> Submit store setup
            </>
          )}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <Mail size={11} aria-hidden="true" /> We review your application after you submit — usually within 24 hours.
        </p>
      </form>
    </>
  );
}
