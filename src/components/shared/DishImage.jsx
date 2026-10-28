import { useEffect, useState } from "react";
import { draftImageId, getImageRecord, isDraftImageRef, objectUrlFor } from "../../lib/imageStorage.js";
import { withBase } from "../../lib/urls.js";

export default function DishImage({
  item,
  category,
  className = "",
  width = 72,
  height = 72,
}) {
  const [src, setSrc] = useState(resolveInitial(item));
  const alt = item?.name ? `${item.name}` : "Menu item";

  useEffect(() => {
    let cancelled = false;
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
    setSrc(path ? withBase(path) : fallbackFor(item, category));
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
        event.currentTarget.onerror = null;
        event.currentTarget.src = fallbackFor(item, category);
      }}
    />
  );
}

function resolveInitial(item) {
  if (!item?.image || isDraftImageRef(item.image)) {
    return fallbackFor(item);
  }
  return withBase(item.image);
}

function fallbackFor(item, category) {
  const id = category?.id || item?.categoryId || "menu";
  return withBase(`/images/fallbacks/${id}.svg`);
}
