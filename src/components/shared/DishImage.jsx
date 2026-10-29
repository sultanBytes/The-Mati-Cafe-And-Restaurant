import { useEffect, useRef, useState } from "react";
import { fetchFirebaseImage, isFirestoreImageRef } from "../../lib/firebaseMenu.js";
import { draftImageId, getImageRecord, isDraftImageRef, objectUrlFor } from "../../lib/imageStorage.js";
import { publicAssetUrl, withBase } from "../../lib/urls.js";

export default function DishImage({
  item,
  category,
  className = "",
  width = 72,
  height = 72,
}) {
  const [src, setSrc] = useState(() => resolveInitial(item, category));
  const attempt = useRef(0);
  const alt = item?.name ? `${item.name}` : "Menu item";

  useEffect(() => {
    let cancelled = false;
    attempt.current = 0;
    const path = item?.image;
    if (isDraftImageRef(path)) {
      const id = draftImageId(path);
      getImageRecord(id)
        .then((record) => {
          if (cancelled || !record?.blob) return;
          setSrc(objectUrlFor(id, record.blob));
        })
        .catch(() => {
          if (!cancelled) setSrc(fallbackFor(item, category));
        });
      return () => {
        cancelled = true;
      };
    }
    if (isFirestoreImageRef(path)) {
      fetchFirebaseImage(path)
        .then((dataUrl) => {
          if (cancelled) return;
          setSrc(dataUrl || fallbackFor(item, category));
        })
        .catch(() => {
          if (!cancelled) setSrc(fallbackFor(item, category));
        });
      return () => {
        cancelled = true;
      };
    }
    setSrc(path ? publicAssetUrl(path) : fallbackFor(item, category));
    return () => {
      cancelled = true;
    };
  }, [item, category]);

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={`bg-card object-cover ${className}`}
      onError={(event) => {
        const path = item?.image;
        if (attempt.current === 0 && path && path.startsWith("/images/")) {
          attempt.current = 1;
          event.currentTarget.src = withBase(path);
          return;
        }
        attempt.current = 2;
        event.currentTarget.onerror = null;
        event.currentTarget.src = fallbackFor(item, category);
      }}
    />
  );
}

function resolveInitial(item, category) {
  if (!item?.image || isDraftImageRef(item.image) || isFirestoreImageRef(item.image)) {
    return fallbackFor(item, category);
  }
  return publicAssetUrl(item.image);
}

function fallbackFor(item, category) {
  const id = category?.id || item?.categoryId || "menu";
  return withBase(`/images/fallbacks/${id}.svg`);
}
