/**
 * StatisticsDisplay - World statistics and distribution charts
 * 
 * Displays detailed world statistics including chunk count, biome distribution,
 * resource and structure counts, and height statistics. Provides
 * visual charts for biome distribution (pie chart) and resource counts (bar chart).
 */

import { DemoApp, AppState } from '../core/DemoApp';
import { BiomeType, ResourceType, StructureType } from '../../../src/index';

/**
 * StatisticsDisplay - Shows world statistics and distribution charts
 */
export class StatisticsDisplay {
  private container: HTMLElement | null = null;
  private app: DemoApp | null = null;
  
  // Statistic display elements
  private chunkCountElement: HTMLElement | null = null;
  private avgHeightElement: HTMLElement | null = null;
  private minHeightElement: HTMLElement | null = null;
  private maxHeightElement: HTMLElement | null = null;
  private microBiomeCountElement: HTMLElement | null = null;
  
  // Chart containers
  private biomeChartContainer: HTMLElement | null = null;
  private resourceChartContainer: HTMLElement | null = null;
  
  // Biome names mapping
  private readonly biomeNames: Record<BiomeType, string> = {
    [0]: 'Forest',
    [1]: 'Desert',
    [2]: 'Tundra',
    [3]: 'Grassland',
    [4]: 'Mountain',
    [5]: 'Ocean',
    [6]: 'Beach',
    [7]: 'Swamp'
  };
  
  // Biome colors for chart
  private readonly biomeColors: Record<BiomeType, string> = {
    [0]: '#228B22',  // Forest - Forest Green
    [1]: '#FFE4B5',  // Desert - Moccasin
    [2]: '#ADD8E6',  // Tundra - Light Blue
    [3]: '#90EE90',  // Grassland - Light Green
    [4]: '#8B4513',  // Mountain - Saddle Brown
    [5]: '#1E90FF',  // Ocean - Dodger Blue
    [6]: '#FFFACD',  // Beach - Lemon Chiffon
    [7]: '#2F4F2F'   // Swamp - Dark Slate Gray
  };
  
  // Resource names mapping
  private readonly resourceNames: Record<number, string> = {
    [ResourceType.IRON]: 'Iron',
    [ResourceType.GOLD]: 'Gold',
    [ResourceType.COAL]: 'Coal',
    [ResourceType.STONE]: 'Stone',
    [ResourceType.WOOD]: 'Wood'
  };
  
  // Resource colors for chart
  private readonly resourceColors: Record<number, string> = {
    [ResourceType.IRON]: '#C0C0C0',   // Silver
    [ResourceType.GOLD]: '#FFD700',   // Gold
    [ResourceType.COAL]: '#2F4F4F',   // Dark Slate Gray
    [ResourceType.STONE]: '#808080',  // Gray
    [ResourceType.WOOD]: '#8B4513'    // Saddle Brown
  };
  
  // Structure names mapping
  private readonly structureNames: Record<number, string> = {
    [StructureType.VILLAGE]: 'Village',
    [StructureType.RUINS]: 'Ruins',
    [StructureType.TOWER]: 'Tower'
  };

  /**
   * Initialize the statistics display
   */
  initialize(container: HTMLElement): void {
    this.container = container;
    
    // Create statistics UI
    this.createStatisticsUI();
    
    console.log('StatisticsDisplay initialized');
  }

  /**
   * Create the statistics UI structure
   */
  private createStatisticsUI(): void {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create header
    const header = document.createElement('h3');
    header.textContent = 'World Statistics';
    header.style.fontSize = '1.25rem';
    header.style.marginBottom = 'var(--spacing-lg)';
    this.container.appendChild(header);
    
    // Create sections
    this.createGeneralStatsSection();
    this.createHeightStatsSection();
    this.createBiomeSection();
    this.createMicroBiomeSection();
    this.createResourceSection();
    this.createStructureSection();
  }

  /**
   * Create general statistics section
   */
  private createGeneralStatsSection(): void {
    const section = this.createSection('General');
    
    this.chunkCountElement = this.createStatistic(section, 'Total Chunks', '0');
    
    this.container?.appendChild(section);
  }

  /**
   * Create height statistics section
   */
  private createHeightStatsSection(): void {
    const section = this.createSection('Height Statistics');
    
    this.avgHeightElement = this.createStatistic(section, 'Average', '0.00');
    this.minHeightElement = this.createStatistic(section, 'Minimum', '0.00');
    this.maxHeightElement = this.createStatistic(section, 'Maximum', '0.00');
    
    this.container?.appendChild(section);
  }

  /**
   * Create biome distribution section
   */
  private createBiomeSection(): void {
    const section = this.createSection('Biome Distribution');
    
    // Create chart container
    this.biomeChartContainer = document.createElement('div');
    this.biomeChartContainer.className = 'chart-container';
    this.biomeChartContainer.style.marginTop = 'var(--spacing-md)';
    this.biomeChartContainer.style.minHeight = '200px';
    section.appendChild(this.biomeChartContainer);
    
    this.container?.appendChild(section);
  }

  /**
   * Create micro-biome section
   */
  private createMicroBiomeSection(): void {
    const section = this.createSection('Micro-Biomes');
    
    this.microBiomeCountElement = this.createStatistic(section, 'Micro-Biomes Visible', '0');
    
    this.container?.appendChild(section);
  }

  /**
   * Create resource counts section
   */
  private createResourceSection(): void {
    const section = this.createSection('Resources');
    
    // Create chart container
    this.resourceChartContainer = document.createElement('div');
    this.resourceChartContainer.className = 'chart-container';
    this.resourceChartContainer.style.marginTop = 'var(--spacing-md)';
    this.resourceChartContainer.style.minHeight = '200px';
    section.appendChild(this.resourceChartContainer);
    
    this.container?.appendChild(section);
  }

  /**
   * Create structure counts section
   */
  private createStructureSection(): void {
    const section = this.createSection('Structures');
    section.id = 'structure-stats-section';
    
    this.container?.appendChild(section);
  }

  /**
   * Create a section container
   */
  private createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'stats-section';
    section.style.marginBottom = 'var(--spacing-lg)';
    section.style.paddingBottom = 'var(--spacing-lg)';
    section.style.borderBottom = '1px solid var(--border-color)';
    
    const heading = document.createElement('h4');
    heading.textContent = title;
    heading.style.fontSize = '0.875rem';
    heading.style.color = 'var(--text-secondary)';
    heading.style.marginBottom = 'var(--spacing-md)';
    heading.style.textTransform = 'uppercase';
    heading.style.letterSpacing = '0.05em';
    
    section.appendChild(heading);
    
    return section;
  }

  /**
   * Create a statistic display element
   */
  private createStatistic(
    parent: HTMLElement,
    label: string,
    initialValue: string
  ): HTMLElement {
    const stat = document.createElement('div');
    stat.className = 'statistic';
    stat.style.display = 'flex';
    stat.style.justifyContent = 'space-between';
    stat.style.alignItems = 'center';
    stat.style.marginBottom = 'var(--spacing-sm)';
    
    const labelElement = document.createElement('span');
    labelElement.className = 'stat-label';
    labelElement.textContent = label;
    labelElement.style.fontSize = '0.875rem';
    labelElement.style.color = 'var(--text-secondary)';
    
    const valueElement = document.createElement('span');
    valueElement.className = 'stat-value';
    valueElement.textContent = initialValue;
    valueElement.style.fontSize = '1rem';
    valueElement.style.fontWeight = '600';
    valueElement.style.color = 'var(--text-color)';
    
    stat.appendChild(labelElement);
    stat.appendChild(valueElement);
    parent.appendChild(stat);
    
    return valueElement;
  }

  /**
   * Update chunk count
   */
  updateChunkCount(count: number): void {
    if (this.chunkCountElement) {
      this.chunkCountElement.textContent = count.toString();
    }
  }

  /**
   * Update height statistics
   */
  updateHeightStats(avg: number, min: number, max: number): void {
    if (this.avgHeightElement) {
      this.avgHeightElement.textContent = avg.toFixed(2);
    }
    if (this.minHeightElement) {
      this.minHeightElement.textContent = min.toFixed(2);
    }
    if (this.maxHeightElement) {
      this.maxHeightElement.textContent = max.toFixed(2);
    }
  }

  /**
   * Update biome distribution and create pie chart
   */
  updateBiomeDistribution(distribution: Map<BiomeType, number>): void {
    if (!this.biomeChartContainer) return;
    
    // Calculate total tiles
    let total = 0;
    for (const count of distribution.values()) {
      total += count;
    }
    
    if (total === 0) {
      this.biomeChartContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No data available</p>';
      return;
    }
    
    // Create pie chart
    this.createBiomeChart(distribution, total);
  }

  /**
   * Create biome distribution pie chart
   */
  createBiomeChart(distribution: Map<BiomeType, number>, total: number): void {
    if (!this.biomeChartContainer) return;
    
    // Clear container
    this.biomeChartContainer.innerHTML = '';
    
    // Create SVG pie chart
    const size = 200;
    const radius = 80;
    const centerX = size / 2;
    const centerY = size / 2;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size.toString());
    svg.setAttribute('height', size.toString());
    svg.style.display = 'block';
    svg.style.margin = '0 auto';
    
    let currentAngle = 0;
    
    // Draw pie slices
    for (const [biome, count] of distribution.entries()) {
      const percentage = count / total;
      const angle = percentage * 2 * Math.PI;
      
      if (angle > 0) {
        const path = this.createPieSlice(centerX, centerY, radius, currentAngle, currentAngle + angle);
        path.setAttribute('fill', this.biomeColors[biome]);
        path.setAttribute('stroke', '#fff');
        path.setAttribute('stroke-width', '2');
        
        // Add tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${this.biomeNames[biome]}: ${(percentage * 100).toFixed(1)}%`;
        path.appendChild(title);
        
        svg.appendChild(path);
        currentAngle += angle;
      }
    }
    
    this.biomeChartContainer.appendChild(svg);
    
    // Create legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.style.marginTop = 'var(--spacing-md)';
    legend.style.display = 'grid';
    legend.style.gridTemplateColumns = 'repeat(2, 1fr)';
    legend.style.gap = 'var(--spacing-sm)';
    
    for (const [biome, count] of distribution.entries()) {
      const percentage = (count / total) * 100;
      
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.fontSize = '0.75rem';
      
      const colorBox = document.createElement('div');
      colorBox.style.width = '12px';
      colorBox.style.height = '12px';
      colorBox.style.backgroundColor = this.biomeColors[biome];
      colorBox.style.marginRight = 'var(--spacing-xs)';
      colorBox.style.flexShrink = '0';
      
      const label = document.createElement('span');
      label.textContent = `${this.biomeNames[biome]} (${percentage.toFixed(1)}%)`;
      label.style.color = 'var(--text-secondary)';
      
      item.appendChild(colorBox);
      item.appendChild(label);
      legend.appendChild(item);
    }
    
    this.biomeChartContainer.appendChild(legend);
  }

  /**
   * Create SVG path for pie slice
   */
  private createPieSlice(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): SVGPathElement {
    const startX = centerX + radius * Math.cos(startAngle - Math.PI / 2);
    const startY = centerY + radius * Math.sin(startAngle - Math.PI / 2);
    const endX = centerX + radius * Math.cos(endAngle - Math.PI / 2);
    const endY = centerY + radius * Math.sin(endAngle - Math.PI / 2);
    
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`,
      'Z'
    ].join(' ');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    
    return path;
  }

  /**
   * Update resource counts and create bar chart
   */
  updateResourceCounts(counts: Map<ResourceType, number>): void {
    if (!this.resourceChartContainer) return;
    
    // Create bar chart
    this.createResourceChart(counts);
  }

  /**
   * Create resource count bar chart
   */
  createResourceChart(counts: Map<ResourceType, number>): void {
    if (!this.resourceChartContainer) return;
    
    // Clear container
    this.resourceChartContainer.innerHTML = '';
    
    if (counts.size === 0) {
      this.resourceChartContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No resources generated</p>';
      return;
    }
    
    // Find max count for scaling
    let maxCount = 0;
    for (const count of counts.values()) {
      maxCount = Math.max(maxCount, count);
    }
    
    if (maxCount === 0) {
      this.resourceChartContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No resources found</p>';
      return;
    }
    
    // Create bar chart container
    const chartDiv = document.createElement('div');
    chartDiv.className = 'bar-chart';
    chartDiv.style.display = 'flex';
    chartDiv.style.flexDirection = 'column';
    chartDiv.style.gap = 'var(--spacing-sm)';
    
    // Create bars for each resource type
    for (const [resourceType, count] of counts.entries()) {
      const barContainer = document.createElement('div');
      barContainer.style.display = 'flex';
      barContainer.style.alignItems = 'center';
      barContainer.style.gap = 'var(--spacing-sm)';
      
      // Label
      const label = document.createElement('span');
      label.textContent = this.resourceNames[resourceType];
      label.style.fontSize = '0.75rem';
      label.style.color = 'var(--text-secondary)';
      label.style.minWidth = '60px';
      label.style.flexShrink = '0';
      
      // Bar background
      const barBg = document.createElement('div');
      barBg.style.flex = '1';
      barBg.style.height = '20px';
      barBg.style.backgroundColor = 'var(--bg-secondary, #f0f0f0)';
      barBg.style.borderRadius = '4px';
      barBg.style.position = 'relative';
      barBg.style.overflow = 'hidden';
      
      // Bar fill
      const barFill = document.createElement('div');
      const percentage = (count / maxCount) * 100;
      barFill.style.width = `${percentage}%`;
      barFill.style.height = '100%';
      barFill.style.backgroundColor = this.resourceColors[resourceType];
      barFill.style.transition = 'width 0.3s ease';
      
      // Count label
      const countLabel = document.createElement('span');
      countLabel.textContent = count.toString();
      countLabel.style.fontSize = '0.75rem';
      countLabel.style.color = 'var(--text-color)';
      countLabel.style.fontWeight = '600';
      countLabel.style.minWidth = '40px';
      countLabel.style.textAlign = 'right';
      countLabel.style.flexShrink = '0';
      
      barBg.appendChild(barFill);
      barContainer.appendChild(label);
      barContainer.appendChild(barBg);
      barContainer.appendChild(countLabel);
      chartDiv.appendChild(barContainer);
    }
    
    this.resourceChartContainer.appendChild(chartDiv);
  }

  /**
   * Update structure counts
   */
  updateStructureCounts(counts: Map<StructureType, number>): void {
    const section = document.getElementById('structure-stats-section');
    if (!section) return;
    
    // Remove existing structure stats and messages (keep only the heading)
    const existingStats = section.querySelectorAll('.statistic');
    existingStats.forEach(stat => stat.remove());
    
    // Remove existing "no structures" message if present
    const existingMessage = section.querySelector('p');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Add structure counts
    for (const [structureType, count] of counts.entries()) {
      this.createStatistic(section, this.structureNames[structureType], count.toString());
    }
    
    // If no structures, show message (only once)
    if (counts.size === 0) {
      // Check if message already exists to avoid duplicates
      if (!section.querySelector('p')) {
        const message = document.createElement('p');
        message.textContent = 'No structures generated';
        message.style.textAlign = 'center';
        message.style.color = 'var(--text-secondary)';
        message.style.fontSize = '0.875rem';
        section.appendChild(message);
      }
    }
  }

  /**
   * Update micro-biome count
   */
  updateMicroBiomeCount(count: number): void {
    if (this.microBiomeCountElement) {
      this.microBiomeCountElement.textContent = count.toString();
    }
  }

  /**
   * Refresh all statistics from app state
   */
  refresh(): void {
    if (!this.app) return;
    
    const state = this.app.getState();
    
    // Update all statistics
    this.updateChunkCount(state.loadedChunkCount);
    this.updateHeightStats(state.avgHeight, state.minHeight, state.maxHeight);
    this.updateBiomeDistribution(state.biomeDistribution);
    this.updateResourceCounts(state.resourceCounts);
    this.updateStructureCounts(state.structureCounts);
  }

  /**
   * Show the statistics display
   */
  show(): void {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
  }

  /**
   * Hide the statistics display
   */
  hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  /**
   * Set the app instance for state access
   */
  setApp(app: DemoApp): void {
    this.app = app;
    
    // Subscribe to state changes
    app.subscribeToState((state: AppState) => {
      this.updateChunkCount(state.loadedChunkCount);
      this.updateHeightStats(state.avgHeight, state.minHeight, state.maxHeight);
      this.updateBiomeDistribution(state.biomeDistribution);
      this.updateResourceCounts(state.resourceCounts);
      this.updateStructureCounts(state.structureCounts);
    });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.container = null;
    this.app = null;
    
    console.log('StatisticsDisplay disposed');
  }
}
