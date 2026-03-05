import p5 from 'p5';

const thumbnailInstances = [];

export function renderGallery(container, algorithms) {
  for (const AlgoClass of algorithms) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.addEventListener('click', () => {
      location.hash = `#/art/${AlgoClass.meta.slug}`;
    });

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'gallery-card-canvas';

    const info = document.createElement('div');
    info.className = 'gallery-card-info';
    info.innerHTML = `
      <h3>${AlgoClass.meta.name}</h3>
      <p>${AlgoClass.meta.description}</p>
    `;

    card.appendChild(canvasWrap);
    card.appendChild(info);
    container.appendChild(card);

    createThumbnail(canvasWrap, AlgoClass);
  }
}

function createThumbnail(container, AlgoClass) {
  const algo = new AlgoClass();
  const params = algo.getDefaultParams();
  const SIZE = 300;

  const sketch = (p) => {
    p.setup = () => {
      const canvas = p.createCanvas(SIZE, SIZE);
      canvas.parent(container);
      p.frameRate(15);
      algo.setup(p, params);
    };

    p.draw = () => {
      algo.draw(p, params);
    };
  };

  const instance = new p5(sketch);
  thumbnailInstances.push(instance);
}

export function destroyGallery() {
  for (const inst of thumbnailInstances) {
    inst.remove();
  }
  thumbnailInstances.length = 0;
}
