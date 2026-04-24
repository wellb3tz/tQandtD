/**
 * StatisticsDisplay - Binds to existing HTML elements and updates values.
 * Does NOT create or clear any markup — all structure is in index.html.
 */

import { DemoApp, AppState } from '../core/DemoApp';
import { BiomeType, ResourceType, StructureType } from '../../../src/index';

export class StatisticsDisplay {
  private container: HTMLElement | null = null;
  private app: DemoApp | null = null;

  // Bound elements
  private chunkCountElement:    HTMLElement | null = null;
  private avgHeightElement:     HTMLElement | null = null;
  private minHeightElement:     HTMLElement | null = null;
  private maxHeightElement:     HTMLElement | null = null;
  private microBiomeCountElement: HTMLElement | null = null;
  private biomeChartContainer:  HTMLElement | null = null;
  private resourceChartContainer: HTMLElement | null = null;

  private readonly biomeNames: Record<BiomeType, string> = {
    [0]: 'Forest', [1]: 'Desert', [2]: 'Tundra', [3]: 'Grassland',
    [4]: 'Mountain', [5]: 'Ocean', [6]: 'Beach', [7]: 'Swamp'
  };

  private readonly biomeColors: Record<BiomeType, string> = {
    [0]: '#228B22', [1]: '#FFE4B5', [2]: '#ADD8E6', [3]: '#90EE90',
    [4]: '#8B4513', [5]: '#1E90FF', [6]: '#FFFACD', [7]: '#2F4F2F'
  };

  private readonly resourceNames: Record<number, string> = {
    [ResourceType.IRON]: 'Iron', [ResourceType.GOLD]: 'Gold',
    [ResourceType.COAL]: 'Coal', [ResourceType.STONE]: 'Stone',
    [ResourceType.WOOD]: 'Wood'
  };

  private readonly resourceColors: Record<number, string> = {
    [ResourceType.IRON]: '#C0C0C0', [ResourceType.GOLD]: '#FFD700',
    [ResourceType.COAL]: '#4a4a4a', [ResourceType.STONE]: '#808080',
    [ResourceType.WOOD]: '#8B4513'
  };

  private readonly structureNames: Record<number, string> = {
    [StructureType.VILLAGE]: 'Village',
    [StructureType.RUINS]: 'Ruins',
    [StructureType.TOWER]: 'Tower'
  };

  initialize(container: HTMLElement): void {
    this.container = container;

    // Bind to existing HTML elements by ID — no innerHTML modification
    this.chunkCountElement      = document.getElementById('stat-chunk-count');
    this.avgHeightElement       = document.getElementById('stat-height-avg');
    this.minHeightElement       = document.getElementById('stat-height-min');
    this.maxHeightElement       = document.getElementById('stat-height-max');
    this.microBiomeCountElement = document.getElementById('micro-biome-count');
    this.biomeChartContainer    = document.getElementById('stat-biome-chart');
    this.resourceChartContainer = document.getElementById('stat-resource-chart');

    console.log('StatisticsDisplay initialized');
  }

  updateChunkCount(count: number): void {
    if (this.chunkCountElement) this.chunkCountElement.textContent = count.toString();
  }

  updateHeightStats(avg: number, min: number, max: number): void {
    if (this.avgHeightElement) this.avgHeightElement.textContent = avg.toFixed(2);
    if (this.minHeightElement) this.minHeightElement.textContent = min.toFixed(2);
    if (this.maxHeightElement) this.maxHeightElement.textContent = max.toFixed(2);
  }

  updateMicroBiomeCount(count: number): void {
    if (this.microBiomeCountElement) this.microBiomeCountElement.textContent = count.toString();
  }

  updateBiomeDistribution(distribution: Map<BiomeType, number>): void {
    if (!this.biomeChartContainer) return;

    let total = 0;
    for (const count of distribution.values()) total += count;

    if (total === 0) {
      this.biomeChartContainer.innerHTML = '<span class="metric-label">No data available</span>';
      return;
    }

    this.biomeChartContainer.innerHTML = '';

    for (const [biome, count] of distribution.entries()) {
      const pct = (count / total * 100).toFixed(1);
      const row = document.createElement('div');
      row.className = 'metric';

      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${this.biomeColors[biome]};margin-right:6px;flex-shrink:0`;

      const lbl = document.createElement('span');
      lbl.className = 'metric-label';
      lbl.style.display = 'flex';
      lbl.style.alignItems = 'center';
      lbl.appendChild(dot);
      lbl.appendChild(document.createTextNode(this.biomeNames[biome]));

      const val = document.createElement('span');
      val.className = 'metric-value';
      val.textContent = `${pct}%`;

      row.appendChild(lbl);
      row.appendChild(val);
      this.biomeChartContainer.appendChild(row);
    }
  }

  updateResourceCounts(counts: Map<ResourceType, number>): void {
    if (!this.resourceChartContainer) return;

    if (counts.size === 0) {
      this.resourceChartContainer.innerHTML = '<span class="metric-label">No resources generated</span>';
      return;
    }

    let maxCount = 0;
    for (const c of counts.values()) maxCount = Math.max(maxCount, c);

    this.resourceChartContainer.innerHTML = '';

    for (const [type, count] of counts.entries()) {
      const row = document.createElement('div');
      row.className = 'metric';
      row.style.flexDirection = 'column';
      row.style.alignItems = 'stretch';
      row.style.gap = '4px';

      const top = document.createElement('div');
      top.style.cssText = 'display:flex;justify-content:space-between';

      const lbl = document.createElement('span');
      lbl.className = 'metric-label';
      lbl.textContent = this.resourceNames[type];

      const val = document.createElement('span');
      val.className = 'metric-value';
      val.textContent = count.toString();

      top.appendChild(lbl);
      top.appendChild(val);

      const track = document.createElement('div');
      track.style.cssText = 'height:4px;background:var(--border-secondary);border-radius:2px;overflow:hidden';

      const fill = document.createElement('div');
      fill.style.cssText = `height:100%;width:${(count / maxCount * 100).toFixed(1)}%;background:${this.resourceColors[type]};border-radius:2px;transition:width 0.3s`;

      track.appendChild(fill);
      row.appendChild(top);
      row.appendChild(track);
      this.resourceChartContainer.appendChild(row);
    }
  }

  updateStructureCounts(counts: Map<StructureType, number>): void {
    const section = document.getElementById('stat-structure-section');
    if (!section) return;

    // Remove everything except the h4 heading
    const children = Array.from(section.childNodes);
    for (const child of children) {
      if ((child as HTMLElement).tagName !== 'H4') {
        section.removeChild(child);
      }
    }

    if (counts.size === 0) {
      const msg = document.createElement('span');
      msg.className = 'metric-label';
      msg.textContent = 'No structures generated';
      section.appendChild(msg);
      return;
    }

    for (const [type, count] of counts.entries()) {
      const row = document.createElement('div');
      row.className = 'metric';

      const lbl = document.createElement('span');
      lbl.className = 'metric-label';
      lbl.textContent = this.structureNames[type];

      const val = document.createElement('span');
      val.className = 'metric-value';
      val.textContent = count.toString();

      row.appendChild(lbl);
      row.appendChild(val);
      section.appendChild(row);
    }
  }

  refresh(): void {
    if (!this.app) return;
    const s = this.app.getState();
    this.updateChunkCount(s.loadedChunkCount);
    this.updateHeightStats(s.avgHeight, s.minHeight, s.maxHeight);
    this.updateBiomeDistribution(s.biomeDistribution);
    this.updateResourceCounts(s.resourceCounts);
    this.updateStructureCounts(s.structureCounts);
  }

  setApp(app: DemoApp): void {
    this.app = app;
    app.subscribeToState((state: AppState) => {
      this.updateChunkCount(state.loadedChunkCount);
      this.updateHeightStats(state.avgHeight, state.minHeight, state.maxHeight);
      this.updateBiomeDistribution(state.biomeDistribution);
      this.updateResourceCounts(state.resourceCounts);
      this.updateStructureCounts(state.structureCounts);
    });
  }

  show():    void { this.container?.classList.remove('hidden'); }
  hide():    void { this.container?.classList.add('hidden'); }
  dispose(): void { this.container = null; this.app = null; }
}
