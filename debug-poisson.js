const { poissonDiskSampling } = require('./dist/utils/poisson.js');
const points = poissonDiskSampling({ width: 16, height: 16, minDistance: 3, maxAttempts: 30, seed: 0 });
console.log('Points:', points);
for (let i = 0; i < points.length; i++) {
  for (let j = i + 1; j < points.length; j++) {
    const dx = points[i].x - points[j].x;
    const dy = points[i].y - points[j].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    console.log(`Distance between point ${i} and ${j}: ${dist}`);
  }
}
