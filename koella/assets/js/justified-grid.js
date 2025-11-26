(function () {
  function init() {
    console.log("[justified-grid] init called");

    const container = document.querySelector(".home-grid");
    if (!container) {
      console.log("[justified-grid] no .home-grid found");
      return;
    }

    const images = Array.from(container.querySelectorAll(".home-card img"));
    console.log("[justified-grid] found", images.length, "images");
    if (!images.length) return;

    const TARGET_ROW_HEIGHT = 220; // base target
    const MIN_ROW_HEIGHT = 190;    // keep rows similar in height
    const MAX_ROW_HEIGHT = 240;    // small variation only
    const GAP = 16;                // px; roughly 1rem

    function computeAspect(img) {
      // Prefer natural size
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // Fallback: actual rendered box, in case natural* are 0
      if (!w || !h) {
        const rect = img.getBoundingClientRect();
        w = rect.width || 1;
        h = rect.height || 1;
      }

      let ar = w / h;
      if (!isFinite(ar) || ar <= 0) ar = 1;
      return ar;
    }

    function layout() {
      const containerWidth = container.clientWidth;
      console.log("[justified-grid] layout start, containerWidth =", containerWidth);
      containerWidth = containerWidth - 10;
      console.log("just took 10px off container width.")

      if (!containerWidth) return;

      // Reset inline sizing before measuring
      images.forEach((img) => {
        img.style.width = "";
        img.style.height = "";
      });

      let row = [];
      let rowAspectSum = 0;

      function flushRow(isLastRow) {
        if (!row.length) return;

        const totalGap = GAP * Math.max(0, row.length - 1);
        const rowWidthAtTarget = rowAspectSum * TARGET_ROW_HEIGHT + totalGap;

        // For non-last rows that are reasonably full, justify them
        const useJustify = !isLastRow && rowWidthAtTarget > containerWidth * 0.9;

        let rowHeight = TARGET_ROW_HEIGHT;
        if (useJustify) {
          rowHeight = (containerWidth - totalGap) / rowAspectSum;
        }

        const originalRowHeight = rowHeight;
        // Clamp so rows stay visually consistent
        if (rowHeight < MIN_ROW_HEIGHT) rowHeight = MIN_ROW_HEIGHT;
        if (rowHeight > MAX_ROW_HEIGHT) rowHeight = MAX_ROW_HEIGHT;

        console.log(
          "[justified-grid] flushRow",
          {
            count: row.length,
            rowAspectSum,
            useJustify,
            originalRowHeight,
            rowHeight,
          }
        );

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
        if (!ar || !isFinite(ar) || ar <= 0) {
          ar = computeAspect(img);
          img.dataset.aspect = ar;
        }

        row.push(img);
        rowAspectSum += ar;

        const isLast = idx === images.length - 1;
        const totalGap = GAP * Math.max(0, row.length - 1);
        const rowWidthAtTarget = rowAspectSum * TARGET_ROW_HEIGHT + totalGap;

        // Start a new row when we'd exceed the container
        if (rowWidthAtTarget >= containerWidth || isLast) {
          flushRow(isLast);
        }
      });

      console.log("[justified-grid] layout done");
    }

    function onAllImagesLoaded(callback) {
      let remaining = images.length;
      if (!remaining) {
        callback();
        return;
      }

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

    let resizeRafId = null;
    function onResize() {
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(layout);
    }

    onAllImagesLoaded(() => {
      console.log("[justified-grid] all images loaded, running layout");
      layout();
    });

    window.addEventListener("resize", onResize);
  }

  // Wait until DOM is ready before querying .home-grid
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
