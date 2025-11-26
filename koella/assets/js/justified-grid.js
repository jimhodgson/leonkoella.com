(function () {
  const container = document.querySelector(".home-grid");
  if (!container) return;

  const images = Array.from(
    container.querySelectorAll(".home-card img")
  );

  if (!images.length) return;

  const TARGET_ROW_HEIGHT = 220; // px, tweak to taste
  const GAP = 16; // px; should roughly match your CSS gap (1rem ≈ 16px)

  function computeAspect(img) {
    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    return w / h;
  }

  function layout() {
    const containerWidth = container.clientWidth;
    if (!containerWidth) return;

    // Reset any previous inline sizing
    images.forEach((img) => {
      img.style.width = "";
      img.style.height = "";
    });

    let row = [];
    let rowAspectSum = 0;

    function flushRow(isLastRow) {
      if (!row.length) return;

      // Width that this row would take at target height
      const totalGap = GAP * (row.length - 1);
      const rowWidthAtTarget = rowAspectSum * TARGET_ROW_HEIGHT + totalGap;

      // Scale height so the row fits the container width
      // For the last row, you can choose to keep target height instead
      const useJustify = !isLastRow && rowWidthAtTarget > containerWidth * 0.8;
      const rowHeight = useJustify
        ? (containerWidth - totalGap) / rowAspectSum
        : TARGET_ROW_HEIGHT;

      row.forEach((img) => {
        const ar = parseFloat(img.dataset.aspect) || 1;
        const w = rowHeight * ar;
        img.style.height = rowHeight + "px";
        img.style.width = w + "px";
      });

      row = [];
      rowAspectSum = 0;
    }

    images.forEach((img, idx) => {
      let ar = parseFloat(img.dataset.aspect);
      if (!ar || !isFinite(ar)) {
        ar = computeAspect(img);
        img.dataset.aspect = ar;
      }

      row.push(img);
      rowAspectSum += ar;

      const isLast = idx === images.length - 1;
      const totalGap = GAP * (row.length - 1);
      const rowWidthAtTarget = rowAspectSum * TARGET_ROW_HEIGHT + totalGap;

      if (rowWidthAtTarget >= containerWidth || isLast) {
        flushRow(isLast);
      }
    });
  }

  function onAllImagesLoaded(callback) {
    let remaining = images.length;
    if (!remaining) return callback();

    images.forEach((img) => {
      if (img.complete && img.naturalWidth) {
        remaining -= 1;
        if (remaining === 0) callback();
      } else {
        img.addEventListener("load", () => {
          remaining -= 1;
          if (remaining === 0) callback();
        });
        img.addEventListener("error", () => {
          remaining -= 1;
          if (remaining === 0) callback();
        });
      }
    });
  }

  let resizeTimeout = null;
  function onResize() {
    if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
    resizeTimeout = requestAnimationFrame(layout);
  }

  onAllImagesLoaded(layout);
  window.addEventListener("resize", onResize);
})();
