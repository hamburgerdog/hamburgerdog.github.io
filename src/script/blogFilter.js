/**
 * 博客筛选器类
 * 负责处理博客列表的标签筛选和每日一句功能
 */
class BlogFilter {
  constructor() {
    this.selectors = {
      filterItems: '.filter_item',
      blogItems: '.item',
      starTitle: '#star-section-title',
      timelineTitle: '#timeline-section-title',
      starItems: '.star_list .item',
      timelineItems: '.detail .item',
      quote: '#quote',
    };

    this.elements = {};
  }

  /**
   * 初始化 DOM 元素引用
   */
  initElements() {
    this.elements.filterItems = document.querySelectorAll(this.selectors.filterItems);
    this.elements.blogItems = document.querySelectorAll(this.selectors.blogItems);
    this.elements.starTitle = document.querySelector(this.selectors.starTitle);
    this.elements.timelineTitle = document.querySelector(this.selectors.timelineTitle);
    this.elements.starItems = document.querySelectorAll(this.selectors.starItems);
    this.elements.timelineItems = document.querySelectorAll(this.selectors.timelineItems);
    this.elements.quote = document.querySelector(this.selectors.quote);
  }

  /**
   * 检查元素集合中是否有可见项
   * @param {NodeListOf<HTMLElement>} items - 要检查的元素集合
   * @returns {boolean} 是否有可见项
   */
  hasVisibleItems(items) {
    return Array.from(items).some((item) => item.style.display !== 'none');
  }

  /**
   * 更新章节标题的显示状态
   * 如果某个部分的所有文章都被隐藏，则隐藏对应的标题
   */
  updateSectionTitles() {
    if (!this.elements.starTitle || !this.elements.timelineTitle) {
      return;
    }

    const hasVisibleStarItems = this.hasVisibleItems(this.elements.starItems);
    this.elements.starTitle.style.display = hasVisibleStarItems ? 'block' : 'none';

    const hasVisibleTimelineItems = this.hasVisibleItems(this.elements.timelineItems);
    this.elements.timelineTitle.style.display = hasVisibleTimelineItems ? 'block' : 'none';
  }

  /**
   * 重置所有筛选状态
   * 显示所有文章和标题
   */
  resetFilter() {
    this.elements.blogItems.forEach((item) => {
      item.style.display = 'block';
    });

    if (this.elements.starTitle) {
      this.elements.starTitle.style.display = 'block';
    }
    if (this.elements.timelineTitle) {
      this.elements.timelineTitle.style.display = 'block';
    }
  }

  /**
   * 清除所有标签的选中状态
   */
  clearSelectedTags() {
    const selectedTags = document.querySelectorAll('.selected');
    selectedTags.forEach((tag) => {
      tag.classList.remove('selected');
    });
  }

  /**
   * 根据标签值筛选文章
   * @param {string} tagValue - 要筛选的标签值
   */
  filterByTag(tagValue) {
    this.elements.blogItems.forEach((item) => {
      const itemTags = (item.getAttribute('data-tags') || '').split(' ');
      item.style.display = itemTags.includes(tagValue) ? 'block' : 'none';
    });
  }

  /**
   * 处理标签点击事件
   * @param {HTMLElement} tagElement - 被点击的标签元素
   */
  handleTagClick(tagElement) {
    const isCancel = tagElement.classList.contains('selected');
    this.clearSelectedTags();

    if (isCancel) {
      this.resetFilter();
      return;
    }

    tagElement.classList.add('selected');
    const tagValue = tagElement.id;
    this.filterByTag(tagValue);
    this.updateSectionTitles();
  }

  /**
   * 初始化标签筛选功能
   */
  initTagFilter() {
    if (!this.elements.filterItems.length) {
      return;
    }

    this.elements.filterItems.forEach((tag) => {
      tag.addEventListener('click', () => {
        this.handleTagClick(tag);
      });
    });
  }

  /**
   * 加载并显示每日一句
   */
  async loadDailyQuote() {
    if (!this.elements.quote) {
      return;
    }

    try {
      const res = await fetch('https://v1.hitokoto.cn/');
      const data = await res.json();
      this.elements.quote.innerHTML = `「${data.from}」${data.hitokoto}`;
    } catch (error) {
      console.error('Failed to load daily quote:', error);
    }
  }

  /**
   * 初始化所有功能
   */
  init() {
    this.initElements();
    this.initTagFilter();
    this.loadDailyQuote();
  }
}

export default BlogFilter;
