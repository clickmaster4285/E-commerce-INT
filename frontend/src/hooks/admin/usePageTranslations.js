"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { translatePage } from "@/apis/admin/translationApi";

/** Generate and save only current-page content in the active locale. */
export function usePageTranslations({ model, records, locale, ready, queryKey, queryClient, alreadyTranslated = false, fallbackAfterRetries = false }) {
  const completed = useRef(new Set());
  const attempted = useRef(new Set());
  const retryCounts = useRef(new Map());
  const previousSignature = useRef("");
  const mounted = useRef(false);
  const [completedSignatures, setCompletedSignatures] = useState(() => new Set());
  const [fallbackSignatures, setFallbackSignatures] = useState(() => new Set());
  const stableRecords = useMemo(
    () => (Array.isArray(records) ? records : []).map((doc) => ({
      id: String(doc?._id || ""),
      content: [doc?.name, doc?.description, doc?.customer_name, doc?.department, doc?.title, doc?.comment, doc?.notes,
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
  const translationsReady = locale === "en" || !stableRecords.length || alreadyTranslated || completedSignatures.has(signature) || (fallbackAfterRetries && fallbackSignatures.has(signature));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

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
      alreadyTranslated ||
      (fallbackAfterRetries && fallbackSignatures.has(signature)) ||
      !stableRecords.length ||
      completed.current.has(signature) ||
      attempted.current.has(signature)
    ) return;
    attempted.current.add(signature);
    let retryTimer;
    const scheduleRetry = () => {
      const retries = retryCounts.current.get(signature) || 0;
      if (retries >= 3) {
        if (fallbackAfterRetries && mounted.current) {
          setFallbackSignatures((previous) => {
            if (previous.has(signature)) return previous;
            const next = new Set(previous);
            next.add(signature);
            return next;
          });
        }
        return;
      }
      retryCounts.current.set(signature, retries + 1);
      retryTimer = window.setTimeout(() => {
        attempted.current.delete(signature);
        queryClient.invalidateQueries({ queryKey: JSON.parse(serializedQueryKey), exact: true });
      }, 5000);
    };
    (async () => {
      let succeeded = true;
      let refreshNeeded = false;
      const ids = stableRecords.map((doc) => doc.id);
      for (let offset = 0; offset < ids.length; offset += 50) {
        const result = await translatePage({ model, ids: ids.slice(offset, offset + 50), locale });
        const batchSize = ids.slice(offset, offset + 50).length;
        if (!result?.success || (model === "Brand" && result.processed !== batchSize)) {
          succeeded = false;
          break;
        }
        // A batch may persist valid translations while reporting other rows
        // as failed. Refresh those successful rows immediately instead of
        // keeping the entire page on stale pre-translation data until every
        // record in the batch succeeds.
        refreshNeeded = true;
        if (result.failed) {
          succeeded = false;
          console.warn(`[translation] ${model}/${locale}: ${result.failed} records need retry`);
        }
      }
      if (refreshNeeded) {
        await queryClient.invalidateQueries({ queryKey: JSON.parse(serializedQueryKey), exact: true });
      }
      if (succeeded) {
        if (mounted.current) {
          completed.current.add(signature);
          retryCounts.current.delete(signature);
          setCompletedSignatures((previous) => {
            if (previous.has(signature)) return previous;
            const next = new Set(previous);
            next.add(signature);
            return next;
          });
        }
      } else if (mounted.current) {
        scheduleRetry();
      }
    })()
      .catch((error) => {
        console.warn(`[translation] ${model} page translation failed:`, error?.response?.data?.message || error?.message);
        if (mounted.current) scheduleRetry();
      });
  }, [model, locale, ready, alreadyTranslated, fallbackAfterRetries, fallbackSignatures, signature, serializedQueryKey, stableRecords, queryClient]);

  return translationsReady;
}
