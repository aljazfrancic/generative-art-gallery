// p5.js 2.x assembled from only the modules the gallery draws with:
// roughly a third of the full build, which matters most on slow phones.
import p5 from 'p5/core';
import shape from 'p5/shape';
import color from 'p5/color';
import math from 'p5/math';

p5.registerAddon(shape);
p5.registerAddon(color);
p5.registerAddon(math);

// resizeCanvas() asks the accessibility module (not included here) whether it has
// screen-reader output to update; without that module there never is any.
p5.prototype._addAccsOutput ??= () => false;

export default p5;
