$(function () {
  var $grid = $('.home-grid');
  if (!$grid.length) {
    console.log('[masonry] no .home-grid found');
    return;
  }

  // Wait for all images inside .home-grid to load
  $grid.imagesLoaded(function () {
    console.log('[masonry] images loaded, initializing Masonry');

    $grid.masonry({
      itemSelector: '.home-card',
      columnWidth: '.home-card', // use card width as column width
      percentPosition: true
    });
  });
});

