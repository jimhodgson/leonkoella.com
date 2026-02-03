$(function () {
  var $grids = $('.home-grid');

  if (!$grids.length) {
    console.log('[masonry] no .home-grid found');
    return;
  }

  $grids.each(function () {
    var $grid = $(this);

    // Wait for images inside THIS grid
    $grid.imagesLoaded(function () {
      console.log('[masonry] images loaded, initializing Masonry for one grid');

      $grid.masonry({
        itemSelector: '.home-card',
        columnWidth: '.grid-sizer',   // ✅ use the sizing element you already render
        gutter: '.gutter-sizer',      // ✅ use gutter-sizer instead of hardcoding 4
        percentPosition: true
      });

      // Helpful when fonts load late / mobile rotates / viewport changes
      $(window).on('resize orientationchange', function () {
        $grid.masonry('layout');
      });
    });
  });
});
