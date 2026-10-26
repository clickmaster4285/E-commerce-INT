"use client";

import { useEffect, useMemo, useRef } from "react";
import { translatePage } from "@/apis/admin/translationApi";

/** Generate and save only current-page content in the active locale. */
export function usePageTranslations({ model, records, locale, ready, queryKey, queryClient }) {
  const completed = useRef(new Set());
  const attempted = useRef(new Set());
  const retryCounts = useRef(new Map());
  const previousSignature = useRef("");
  const stableRecords = useMemo(
    () => (Array.isArray(records) ? records : []).map((doc) => ({
      id: String(doc?._id || ""),
      content: [doc?.name, doc?.description, doc?.title, doc?.comment, doc?.notes,
        doc?.cancel_reason, doc?.product_name, doc?.variant_title, doc?.reason, doc?.explanation,
        doc?.company_name, doc?.address, doc?.city, doc?.state, doc?.country,
        doc?.storeResponse?.message, doc?.eyebrow, doc?.heading, doc?.altText,
        doc?.primaryButton?.text, doc?.secondaryButton?.text,
        ...(Array.isArray(doc?.values) ? doc.values.map((option) => option?.label || "") : [])]
        .map((value) => String(value || "")).join("\u001f"),
    })).filter((doc) => doc.id),
    [records]
  );
  const signature = `${model}|${locale}|${stableRecords.map(({ id, content }) => `${id}:${content}`).join("|")}`;
  const serializedQueryKey = JSON.stringify(queryKey);

  // Page badalne ke baad failed page ko dobara kholne par retry allow karo.
  useEffect(() => {
    if (previousSignature.current && previousSignature.current !== signature) {
      attempted.current.delete(previousSignature.current);
    }
    previousSignature.current = signature;
  }, [signature]);

  useEffect(() => {
    if (
      !ready ||
      locale === "en" ||
      !stableRecords.length ||
      completed.current.has(signature) ||
      attempted.current.has(signature)
    ) return;
    attempted.current.add(signature);
    let active = true;
    let retryTimer;
    const scheduleRetry = () => {
      const retries = retryCounts.current.get(signature) || 0;
      if (retries >= 1) return;
      retryCounts.current.set(signature, retries + 1);
      retryTimer = window.setTimeout(() => {
        attempted.current.delete(signature);
        queryClient.invalidateQueries({ queryKey: JSON.parse(serializedQueryKey), exact: true });
      }, 5000);
    };
    (async () => {
      let succeeded = true;
      const ids = stableRecords.map((doc) => doc.id);
      for (let offset = 0; offset < ids.length; offset += 50) {
        const result = await translatePage({ model, ids: ids.slice(offset, offset + 50), locale });
        if (!result?.success) {
          succeeded = false;
          break;
        }
        if (result.failed) {
          succeeded = false;
          console.warn(`[translation] ${model}/${locale}: ${result.failed} records need retry`);
        }
      }
      if (active && succeeded) {
        completed.current.add(signature);
        retryCounts.current.delete(signature);
      } else if (active) {
        scheduleRetry();
      }
      if (active && succeeded) queryClient.invalidateQueries({ queryKey: JSON.parse(serializedQueryKey), exact: true });
    })()
      .catch((error) => {
        console.warn(`[translation] ${model} page translation failed:`, error?.response?.data?.message || error?.message);
        if (active) scheduleRetry();
      });
    return () => { active = false; };
  }, [model, locale, ready, signature, serializedQueryKey, stableRecords, queryClient]);
}
