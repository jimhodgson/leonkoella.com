$(document).ready(function () {
  var $grid = $('.home-grid');

  if (!$grid.length) {
    console.log("[masonry] no .home-grid found");
    return;
  }

  // Initialize Masonry
  $grid.masonry({
    itemSelector: '.home-card',
    columnWidth: '.home-card',
    percentPosition: true
  });

  // Important: make Masonry re-layout after images load
  $grid.imagesLoaded(function () {
    $grid.masonry('layout');
  });
});
